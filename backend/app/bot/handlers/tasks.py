import logging
import re
import hashlib
import time
import uuid
from datetime import date, datetime, timedelta
from html import escape
from typing import TypedDict
from zoneinfo import ZoneInfo

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm import selectinload

from app.bot.callbacks import (
    ALL_DEPARTMENTS_TOKEN,
    TaskBackToListCallback,
    TaskCardCallback,
    TaskListCallback,
    TaskListFilter,
    TaskListScope,
    TaskRefreshListCallback,
)
from app.bot.keyboards import (
    TASK_FILTER_LABELS,
    task_actions_keyboard,
    task_card_keyboard,
    task_list_keyboard,
)
from app.config import settings
from app.db.models import Task, TeamMember
from app.db.repositories import DepartmentRepository, TaskRepository, TeamMemberRepository
from app.services.ai_service import AIService
from app.services.notification_service import NotificationService
from app.services.permission_service import PermissionService
from app.services.telegram_target_access_service import is_chat_allowed_for_incoming_tasks
from app.services.task_service import TaskService
from app.services.task_visibility_service import (
    can_access_task,
    get_default_department_id,
    resolve_visible_department_ids,
)

logger = logging.getLogger(__name__)

router = Router()

task_service = TaskService()
task_repo = TaskRepository()
member_repo = TeamMemberRepository()
department_repo = DepartmentRepository()
ai_service = AIService()
TASKS_PER_PAGE = 8
TASK_BACK_CALLBACK_PREFIX = "tbk"
LEGACY_TASK_BACK_CALLBACK_PREFIX = "task_back"
LEGACY_TASK_FILTER_ALIASES = {
    TaskListFilter.ACTIVE: TaskListFilter.ALL,
}

TaskListContext = tuple[TaskListScope, TaskListFilter, int, str]

PRIORITY_EMOJI = {
    "urgent": "🔴",
    "high": "⚡",
    "medium": "🔵",
    "low": "⚪",
}

STATUS_EMOJI = {
    "new": "🆕",
    "in_progress": "▶️",
    "review": "👀",
    "done": "✅",
    "cancelled": "❌",
}

STATUS_LABELS = {
    "new": "Новая",
    "in_progress": "В работе",
    "review": "На согласовании",
    "done": "Готово",
    "cancelled": "Отменена",
}

PRIORITY_LABELS = {
    "urgent": "Urgent",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
}

TASK_LIST_TITLE_LIMIT = 64
GROUP_CHAT_TYPES = {"group", "supergroup"}


STATUS_USAGE_TEXT = (
    "Использование: /status <id> <статус>\n\n"
    "Статусы: new, in_progress, review, done, cancelled\n"
    "Пример: /status 42 in_progress"
)

TASK_EDIT_USAGE_TEXT = (
    "Использование: /edit <id>\n"
    "Пример: /edit 42\n"
    "Можно использовать #42"
)

TASK_EDIT_FIELD_LABELS = {
    "title": "📌 Название",
    "description": "📝 Описание",
    "priority": "⚡ Приоритет",
    "deadline": "📅 Дедлайн",
    "assignee": "👤 Исполнитель",
}

TASK_EDIT_CLEAR_VALUES = {"-", "none", "null", "clear", "нет", "очистить"}
TASK_REMINDER_CLEAR_VALUES = TASK_EDIT_CLEAR_VALUES
TASK_PRIORITY_ALIASES = {
    "low": "low",
    "medium": "medium",
    "high": "high",
    "urgent": "urgent",
    "низкий": "low",
    "средний": "medium",
    "высокий": "high",
    "срочный": "urgent",
}
AI_PRIORITY_VALUES = {"low", "medium", "high", "urgent"}
INLINE_REMINDER_PATTERN = re.compile(
    r"\bнапомни(?:ть)?\b[,:\s]*"
    r"(?P<date>сегодня|завтра|послезавтра|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)"
    r"\s*(?:в|во)?\s*(?P<time>\d{1,2}:\d{2})",
    re.IGNORECASE,
)
MENTION_USERNAME_PATTERN = re.compile(r"(?<!\w)@([A-Za-z0-9_]{5,32})")
GROUP_TASK_MENTION_DEDUP_SECONDS = 20
GROUP_TASK_MENTION_CACHE_LIMIT = 2048
_recent_group_task_mentions: dict[str, float] = {}


class ParsedTextTaskPayload(TypedDict):
    title: str
    description: str | None
    assignee_name: str | None
    priority: str
    deadline: date | None
    reminder_at: datetime | None
    reminder_comment: str | None


class TaskCommandFSM(StatesGroup):
    waiting_new_text = State()
    waiting_done_id = State()
    waiting_status_payload = State()


class TaskEditFSM(StatesGroup):
    waiting_value = State()


class TaskReminderFSM(StatesGroup):
    waiting_datetime = State()
    waiting_comment = State()


NEW_TASK_PROMPT_TEXT = (
    "📝 Введите задачу обычным текстом — выделю заголовок, дедлайн и напоминание.\n"
    "Можно использовать модификаторы: !urgent !high !low @ДД.ММ\n"
    "Для отмены отправьте /cancel"
)


async def start_new_task_flow(message: Message, state: FSMContext) -> None:
    """Enter FSM state for creating a text task."""
    await state.set_state(TaskCommandFSM.waiting_new_text)
    await message.answer(NEW_TASK_PROMPT_TEXT)


def _parse_short_id(raw_value: str) -> int | None:
    try:
        return int(raw_value.strip().lstrip("#"))
    except ValueError:
        return None


def _normalize_telegram_username(raw_value: str | None) -> str | None:
    if not raw_value:
        return None
    normalized = raw_value.strip().lstrip("@").lower()
    return normalized or None


def _extract_username_mentions(raw_text: str | None) -> list[str]:
    if not raw_text:
        return []
    mentions = [m.group(1).lower() for m in MENTION_USERNAME_PATTERN.finditer(raw_text)]
    return list(dict.fromkeys(mentions))


def _extract_text_mention_user_ids(message: Message) -> list[int]:
    user_ids: list[int] = []
    for entity in message.entities or []:
        if entity.type != "text_mention" or not entity.user:
            continue
        if entity.user.id not in user_ids:
            user_ids.append(entity.user.id)
    return user_ids


def _message_mentions_bot(
    message: Message,
    *,
    bot_username: str | None,
    bot_user_id: int | None,
) -> bool:
    username_mentions = _extract_username_mentions(message.text)
    if bot_username and bot_username in username_mentions:
        return True

    if bot_user_id is None:
        return False

    for user_id in _extract_text_mention_user_ids(message):
        if user_id == bot_user_id:
            return True
    return False


def _strip_bot_username_mentions(raw_text: str, bot_username: str | None) -> str:
    cleaned = raw_text
    if bot_username:
        cleaned = re.sub(
            rf"(?i)(?<!\w)@{re.escape(bot_username)}\b",
            " ",
            cleaned,
        )
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip(" \t\n\r,.;:!-")


def _group_task_dedupe_key(chat_id: int, sender_id: int, task_text: str) -> str:
    normalized = " ".join((task_text or "").lower().split())
    digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()
    return f"{chat_id}:{sender_id}:{digest}"


def _is_recent_group_task_duplicate(chat_id: int, sender_id: int, task_text: str) -> bool:
    key = _group_task_dedupe_key(chat_id, sender_id, task_text)
    now = time.time()
    last_seen = _recent_group_task_mentions.get(key)
    _recent_group_task_mentions[key] = now

    if len(_recent_group_task_mentions) > GROUP_TASK_MENTION_CACHE_LIMIT:
        threshold = now - GROUP_TASK_MENTION_DEDUP_SECONDS
        stale_keys = [
            cache_key
            for cache_key, seen_at in _recent_group_task_mentions.items()
            if seen_at < threshold
        ]
        for stale_key in stale_keys:
            _recent_group_task_mentions.pop(stale_key, None)

    return bool(last_seen and (now - last_seen) < GROUP_TASK_MENTION_DEDUP_SECONDS)


def _task_editable_fields(member: TeamMember, task: Task) -> list[str]:
    allowed = PermissionService.allowed_task_edit_fields(member, task)
    fields: list[str] = []
    for field in ("title", "description", "priority", "deadline"):
        if field in allowed:
            fields.append(field)
    if "assignee_id" in allowed:
        fields.append("assignee")
    return fields


def _task_edit_fields_keyboard(short_id: int, fields: list[str]) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for field in fields:
        rows.append([
            InlineKeyboardButton(
                text=TASK_EDIT_FIELD_LABELS[field],
                callback_data=f"task_edit_field:{short_id}:{field}",
            )
        ])
    rows.append([
        InlineKeyboardButton(
            text="ℹ️ Подсказка по форматам",
            callback_data=f"task_edit_help:{short_id}",
        )
    ])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _task_edit_assignee_keyboard(
    short_id: int,
    *,
    members: list[TeamMember],
    current_assignee_id: uuid.UUID | None,
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for member in members:
        label = f"{'✓ ' if member.id == current_assignee_id else ''}{member.full_name}"
        rows.append([
            InlineKeyboardButton(
                text=label,
                callback_data=f"task_edit_assign:{short_id}:{member.id}",
            )
        ])
    rows.append([
        InlineKeyboardButton(
            text="➖ Снять исполнителя",
            callback_data=f"task_edit_assign:{short_id}:none",
        )
    ])
    rows.append([
        InlineKeyboardButton(
            text="↩️ К полям",
            callback_data=f"task_edit_fields:{short_id}",
        )
    ])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _task_edit_prompt_text(field: str) -> str:
    prompts = {
        "title": "📌 Введите новое название задачи:",
        "description": (
            "📝 Введите новое описание.\n"
            "Чтобы очистить описание: <code>-</code>, <code>none</code> или <code>нет</code>."
        ),
        "priority": (
            "⚡ Введите приоритет: <code>low</code>, <code>medium</code>, "
            "<code>high</code>, <code>urgent</code>."
        ),
        "deadline": (
            "📅 Введите дедлайн: <code>ДД.ММ</code> или <code>ДД.ММ.ГГГГ</code>.\n"
            "Чтобы снять дедлайн: <code>-</code>, <code>none</code> или <code>нет</code>."
        ),
    }
    return prompts.get(field, "Введите новое значение:")


def _normalize_priority_input(raw_value: str) -> str | None:
    value = raw_value.strip().lower()
    return TASK_PRIORITY_ALIASES.get(value)


def _parse_deadline_input(raw_value: str) -> tuple[date | None, bool]:
    value = raw_value.strip().lower()
    if value in TASK_EDIT_CLEAR_VALUES:
        return None, True

    match = re.match(r"^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$", value)
    if not match:
        return None, False

    day = int(match.group(1))
    month = int(match.group(2))
    year_str = match.group(3)

    if year_str:
        year = int(year_str)
        if year < 100:
            year += 2000
    else:
        year = date.today().year
        try:
            candidate = date(year, month, day)
            if candidate < date.today():
                year += 1
        except ValueError:
            pass

    try:
        return date(year, month, day), True
    except ValueError:
        return None, False


def _format_task_reminder_datetime(reminder_at: datetime | None) -> str:
    if reminder_at is None:
        return "—"
    try:
        tz = ZoneInfo(settings.TIMEZONE)
    except Exception:
        tz = ZoneInfo("Europe/Moscow")
    local_dt = reminder_at.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz)
    return local_dt.strftime("%d.%m.%Y %H:%M")


def _parse_reminder_datetime_input(raw_value: str) -> tuple[datetime | None, bool]:
    value = (raw_value or "").strip().lower()
    if value in TASK_REMINDER_CLEAR_VALUES:
        return None, True

    match = re.match(
        r"^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s+(\d{1,2}):(\d{2})$",
        value,
    )
    if not match:
        return None, False

    day = int(match.group(1))
    month = int(match.group(2))
    year_str = match.group(3)
    hour = int(match.group(4))
    minute = int(match.group(5))

    if not (0 <= hour < 24 and 0 <= minute < 60):
        return None, False

    if year_str:
        year = int(year_str)
        if year < 100:
            year += 2000
    else:
        year = date.today().year

    try:
        local_tz = ZoneInfo(settings.TIMEZONE)
    except Exception:
        local_tz = ZoneInfo("Europe/Moscow")

    try:
        local_dt = datetime(year, month, day, hour, minute, tzinfo=local_tz)
    except ValueError:
        return None, False

    if not year_str and local_dt <= datetime.now(local_tz):
        try:
            local_dt = datetime(year + 1, month, day, hour, minute, tzinfo=local_tz)
        except ValueError:
            return None, False

    reminder_at = local_dt.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    if reminder_at <= datetime.utcnow() + timedelta(seconds=30):
        return None, False
    return reminder_at, True


def _normalize_reminder_comment(raw_value: str | None) -> str | None:
    if raw_value is None:
        return None
    normalized = raw_value.strip()
    return normalized or None


def _normalize_assignee_name(raw_value: str | None) -> str | None:
    if not raw_value:
        return None
    normalized = " ".join(raw_value.strip().split())
    return normalized or None


def _member_matches_name(member: TeamMember, normalized_name: str) -> bool:
    full_name = " ".join((member.full_name or "").lower().split())
    if normalized_name == full_name:
        return True

    first_name = full_name.split(" ", maxsplit=1)[0] if full_name else ""
    if first_name and normalized_name == first_name:
        return True

    for variant in member.name_variants or []:
        if normalized_name == " ".join((variant or "").lower().split()):
            return True
    return False


def _find_members_by_name(name: str | None, members: list[TeamMember]) -> list[TeamMember]:
    normalized_name = _normalize_assignee_name(name)
    if not normalized_name:
        return []
    normalized_name = normalized_name.lower()
    return [member for member in members if _member_matches_name(member, normalized_name)]


def _resolve_group_task_assignee(
    *,
    creator: TeamMember,
    team_members: list[TeamMember],
    explicit_usernames: list[str],
    explicit_text_mention_ids: list[int],
    parsed_assignee_name: str | None,
) -> tuple[uuid.UUID, str, str | None]:
    members_by_id = {member.id: member for member in team_members}
    members_by_telegram_id = {
        member.telegram_id: member
        for member in team_members
        if member.telegram_id is not None
    }
    members_by_username = {
        _normalize_telegram_username(member.telegram_username): member
        for member in team_members
        if _normalize_telegram_username(member.telegram_username)
    }

    explicit_candidates: list[TeamMember] = []
    explicit_candidate_ids: set[uuid.UUID] = set()
    for telegram_id in explicit_text_mention_ids:
        candidate = members_by_telegram_id.get(telegram_id)
        if candidate and candidate.id not in explicit_candidate_ids:
            explicit_candidates.append(candidate)
            explicit_candidate_ids.add(candidate.id)

    for username in explicit_usernames:
        candidate = members_by_username.get(username)
        if candidate and candidate.id not in explicit_candidate_ids:
            explicit_candidates.append(candidate)
            explicit_candidate_ids.add(candidate.id)

    if len(explicit_candidates) == 1:
        assignee = explicit_candidates[0]
        return assignee.id, assignee.full_name, None

    if len(explicit_candidates) > 1:
        return (
            creator.id,
            creator.full_name,
            "Указано несколько исполнителей. Назначил задачу автору — уточните одного исполнителя.",
        )

    if explicit_text_mention_ids or explicit_usernames:
        return (
            creator.id,
            creator.full_name,
            "Упомянутый исполнитель не найден среди зарегистрированных участников. "
            "Назначил задачу автору.",
        )

    if parsed_assignee_name:
        matches = _find_members_by_name(parsed_assignee_name, team_members)
        if len(matches) == 1:
            assignee = matches[0]
            return assignee.id, assignee.full_name, None
        if len(matches) > 1:
            return (
                creator.id,
                creator.full_name,
                "Исполнитель по имени определён неоднозначно. Назначил задачу автору.",
            )
        return (
            creator.id,
            creator.full_name,
            f"Исполнитель «{parsed_assignee_name}» не найден. Назначил задачу автору.",
        )

    creator_full_name = creator.full_name
    if creator.id in members_by_id:
        creator_full_name = members_by_id[creator.id].full_name
    return creator.id, creator_full_name, None


def _normalize_ai_priority(raw_value: str | None) -> str | None:
    if not raw_value:
        return None
    normalized = raw_value.strip().lower()
    return normalized if normalized in AI_PRIORITY_VALUES else None


def _parse_iso_deadline(raw_value: str | None) -> date | None:
    if not raw_value:
        return None
    value = raw_value.strip()
    if not value:
        return None
    if "T" in value:
        value = value.split("T", 1)[0]
    elif " " in value:
        value = value.split(" ", 1)[0]
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _parse_date_token(raw_value: str) -> date | None:
    token = (raw_value or "").strip().lower()
    if not token:
        return None
    if token == "сегодня":
        return date.today()
    if token == "завтра":
        return date.today() + timedelta(days=1)
    if token == "послезавтра":
        return date.today() + timedelta(days=2)

    parsed_deadline, ok = _parse_deadline_input(token)
    if ok and parsed_deadline:
        return parsed_deadline
    return None


def _extract_inline_reminder(raw_text: str) -> tuple[str, datetime | None]:
    match = INLINE_REMINDER_PATTERN.search(raw_text or "")
    if not match:
        return raw_text, None

    reminder_date = _parse_date_token(match.group("date"))
    if not reminder_date:
        return raw_text, None

    reminder_raw = f"{reminder_date.strftime('%d.%m.%Y')} {match.group('time')}"
    reminder_at, ok = _parse_reminder_datetime_input(reminder_raw)
    if not ok or reminder_at is None:
        return raw_text, None

    cleaned = f"{raw_text[:match.start()]} {raw_text[match.end():]}"
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;")
    return cleaned, reminder_at


def _parse_ai_reminder_datetime(raw_value: str | None) -> datetime | None:
    if not raw_value:
        return None
    value = raw_value.strip()
    if not value:
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        parsed_dt = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed_dt.tzinfo is None:
        try:
            local_tz = ZoneInfo(settings.TIMEZONE)
        except Exception:
            local_tz = ZoneInfo("Europe/Moscow")
        parsed_dt = parsed_dt.replace(tzinfo=local_tz)

    reminder_at = parsed_dt.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    if reminder_at <= datetime.utcnow() + timedelta(seconds=30):
        return None
    return reminder_at


async def _parse_task_creation_payload(
    *,
    raw_text: str,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> ParsedTextTaskPayload:
    text_without_inline_reminder, inline_reminder_at = _extract_inline_reminder(raw_text)
    fallback = TaskService.parse_task_text(text_without_inline_reminder)

    payload: ParsedTextTaskPayload = {
        "title": (fallback.get("title") or "").strip(),
        "description": None,
        "assignee_name": None,
        "priority": fallback.get("priority") or "medium",
        "deadline": fallback.get("deadline"),
        "reminder_at": inline_reminder_at,
        "reminder_comment": None,
    }

    try:
        async with session_maker() as session:
            team_members = await member_repo.get_all_active(session)
            parsed = await ai_service.parse_task_from_text(
                session,
                raw_text,
                member.full_name,
                PermissionService.can_create_task_for_others(member),
                team_members,
            )
    except Exception as exc:
        logger.warning("AI parse failed for text task, fallback parser is used: %s", exc)
        return payload

    ai_title = (parsed.title or "").strip()
    if ai_title:
        payload["title"] = ai_title

    payload["description"] = _normalize_reminder_comment(parsed.description)
    payload["assignee_name"] = _normalize_assignee_name(parsed.assignee_name)

    ai_priority = _normalize_ai_priority(parsed.priority)
    if ai_priority:
        payload["priority"] = ai_priority

    ai_deadline = _parse_iso_deadline(parsed.deadline)
    if ai_deadline:
        payload["deadline"] = ai_deadline

    ai_reminder_at = _parse_ai_reminder_datetime(parsed.reminder_at)
    if ai_reminder_at:
        payload["reminder_at"] = ai_reminder_at

    ai_reminder_comment = _normalize_reminder_comment(parsed.reminder_comment)
    if ai_reminder_comment:
        payload["reminder_comment"] = ai_reminder_comment

    if payload["reminder_at"] is None:
        payload["reminder_comment"] = None

    return payload


def _format_task_edit_panel(task: Task, *, editable_fields: list[str]) -> str:
    lines = [
        f"✏️ Редактирование задачи <b>#{task.short_id}</b>",
        "",
        f"<b>{escape(task.title)}</b>",
        "",
        "Доступные поля:",
    ]
    for field in editable_fields:
        lines.append(f"• {TASK_EDIT_FIELD_LABELS[field]}")
    lines.append("")
    lines.append("Выберите поле кнопкой ниже.")
    return "\n".join(lines)


async def _load_task_for_edit(
    *,
    session,
    member: TeamMember,
    short_id: int,
) -> tuple[Task | None, list[str], str | None]:
    task = await task_service.get_task_by_short_id(session, short_id)
    if not task:
        return None, [], "not_found"
    if not await can_access_task(session, member, task):
        return None, [], "no_access"

    editable_fields = _task_editable_fields(member, task)
    if not editable_fields:
        return task, [], "forbidden"
    return task, editable_fields, None


def _default_department_token(member: TeamMember) -> str:
    department_id = get_default_department_id(member)
    return department_id.hex if department_id else ALL_DEPARTMENTS_TOKEN


def _coalesce_department_token(department_token: str | None, member: TeamMember) -> str:
    token = (department_token or "").strip().lower()
    return token if token else _default_department_token(member)


def _decode_department_token(department_token: str | None) -> tuple[uuid.UUID | None, bool]:
    token = (department_token or "").strip().lower()
    if not token:
        return None, False
    if token == ALL_DEPARTMENTS_TOKEN:
        return None, True
    try:
        if len(token) == 32:
            return uuid.UUID(hex=token), True
        return uuid.UUID(token), True
    except ValueError:
        return None, False


def _department_token_from_id(department_id: uuid.UUID | None) -> str:
    return department_id.hex if department_id else ALL_DEPARTMENTS_TOKEN


def _is_group_chat(message: Message) -> bool:
    return message.chat.type in GROUP_CHAT_TYPES


async def _send_private_task_controls(
    *,
    bot: Bot,
    member: TeamMember,
    task: Task,
    is_moderator: bool,
) -> bool:
    if not member.telegram_id:
        return False
    try:
        await bot.send_message(
            member.telegram_id,
            f"🔒 Управление задачей #{task.short_id} · {task.title}",
            reply_markup=task_actions_keyboard(task.short_id, is_moderator),
        )
        return True
    except Exception:
        logger.warning(
            "Failed to send private task controls to member_id=%s tg_id=%s task_id=%s",
            member.id,
            member.telegram_id,
            task.id,
            exc_info=True,
        )
        return False


async def _create_task_for_member(
    *,
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    raw_text: str,
    assignee_id: uuid.UUID | None = None,
) -> bool:
    parsed = await _parse_task_creation_payload(
        raw_text=raw_text,
        member=member,
        session_maker=session_maker,
    )
    if not parsed["title"]:
        await message.answer("❌ Текст задачи не может быть пустым")
        return False

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.create_task(
                session,
                title=parsed["title"],
                creator=member,
                assignee_id=assignee_id,
                description=parsed["description"],
                priority=parsed["priority"],
                deadline=parsed["deadline"],
                reminder_at=parsed["reminder_at"],
                reminder_comment=parsed["reminder_comment"],
                source="text",
            )

            notification_service = NotificationService(bot)
            await notification_service.notify_task_created(session, task, member)

    is_mod = PermissionService.is_moderator(member)
    prio = PRIORITY_EMOJI.get(task.priority, "")
    deadline_str = f"\n📅 Дедлайн: {task.deadline.strftime('%d.%m.%Y')}" if task.deadline else ""
    reminder_str = (
        f"\n⏰ Напоминание: {_format_task_reminder_datetime(task.reminder_at)}"
        if task.reminder_at
        else ""
    )

    response_text = (
        "✅ Задача создана:\n\n"
        f"#{task.short_id} · {task.title}\n"
        f"{prio} {task.priority}{deadline_str}{reminder_str}"
    )

    if _is_group_chat(message):
        controls_sent = await _send_private_task_controls(
            bot=bot,
            member=member,
            task=task,
            is_moderator=is_mod,
        )
        privacy_note = (
            "\n\n🔒 Кнопки управления отправил в личные сообщения."
            if controls_sent
            else "\n\nℹ️ Не удалось отправить кнопки в личку. Напишите боту /start в личном чате."
        )
        await message.answer(response_text + privacy_note)
        return True

    await message.answer(
        response_text,
        reply_markup=task_actions_keyboard(task.short_id, is_mod),
    )
    return True


async def _complete_task_by_short_id(
    *,
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    short_id: int,
) -> bool:
    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return False

            if task.status == "done":
                await message.answer(f"Задача #{short_id} уже завершена")
                return False

            try:
                old_status = task.status
                task = await task_service.complete_task(session, task, member)
            except PermissionError as e:
                await message.answer(f"❌ {e}")
                return False

            notification_service = NotificationService(bot)
            await notification_service.notify_task_completed(session, task, member)
            await notification_service.notify_status_changed(
                session, task, member, old_status, "done"
            )

    await message.answer(f"✅ Задача #{task.short_id} завершена!\n{task.title}")
    return True


async def _update_task_status(
    *,
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    short_id: int,
    new_status: str,
) -> bool:
    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return False

            old_status = task.status

            try:
                task = await task_service.update_status(session, task, member, new_status)
            except (PermissionError, ValueError) as e:
                await message.answer(f"❌ {e}")
                return False

            notification_service = NotificationService(bot)
            await notification_service.notify_status_changed(
                session, task, member, old_status, new_status
            )
            if new_status == "done":
                await notification_service.notify_task_completed(session, task, member)

    status_em = STATUS_EMOJI.get(new_status, "🔄")
    await message.answer(
        f"{status_em} Статус задачи #{task.short_id} изменён:\n"
        f"{old_status} → {new_status}\n"
        f"{task.title}"
    )
    return True


def _format_task_detail(task) -> str:
    """Format task details."""
    prio = PRIORITY_EMOJI.get(task.priority, "")
    status_em = STATUS_EMOJI.get(task.status, "")
    source_icon = "🎤 " if task.source == "voice" else ""
    assignee_name = task.assignee.full_name if task.assignee else "—"
    creator_name = task.created_by.full_name if task.created_by else "—"
    deadline_str = task.deadline.strftime("%d.%m.%Y") if task.deadline else "—"
    reminder_str = _format_task_reminder_datetime(task.reminder_at)

    text = (
        f"{source_icon}<b>#{task.short_id} · {task.title}</b>\n\n"
        f"{status_em} Статус: {task.status}\n"
        f"{prio} Приоритет: {task.priority}\n"
        f"👤 Исполнитель: {assignee_name}\n"
        f"📝 Создал: {creator_name}\n"
        f"📅 Дедлайн: {deadline_str}\n"
        f"⏰ Напоминание: {reminder_str}\n"
        f"📆 Создана: {task.created_at.strftime('%d.%m.%Y %H:%M')}"
    )
    if task.reminder_comment:
        text += f"\n💬 Комментарий: {task.reminder_comment}"
    if task.reminder_sent_at:
        text += "\n✅ Напоминание отправлено"
    if task.description:
        text += f"\n\n📋 {task.description}"
    return text


def _format_task_reminder_panel(task: Task) -> str:
    lines = [
        f"⏰ <b>Напоминание по задаче #{task.short_id}</b>",
        "",
        f"<b>{escape(task.title)}</b>",
        "",
        f"Текущее время: <b>{_format_task_reminder_datetime(task.reminder_at)}</b>",
    ]
    if task.reminder_comment:
        lines.append(f"Комментарий: {escape(task.reminder_comment)}")
    lines.extend([
        "",
        "Укажи дату/время и комментарий (опционально).",
    ])
    return "\n".join(lines)


def _normalize_task_filter(task_filter: TaskListFilter) -> TaskListFilter:
    """Map legacy filter values to current UI filter set."""
    return LEGACY_TASK_FILTER_ALIASES.get(task_filter, task_filter)


def _is_task_overdue(task) -> bool:
    if not task.deadline:
        return False
    if task.status in ("done", "cancelled"):
        return False
    return task.deadline < date.today()


def _filter_tasks(tasks: list, task_filter: TaskListFilter) -> list:
    normalized = _normalize_task_filter(task_filter)
    if normalized == TaskListFilter.ALL:
        return list(tasks)
    if normalized in (TaskListFilter.NEW, TaskListFilter.IN_PROGRESS, TaskListFilter.REVIEW):
        return [task for task in tasks if task.status == normalized.value]
    if normalized == TaskListFilter.OVERDUE:
        return [task for task in tasks if _is_task_overdue(task)]
    if normalized in (TaskListFilter.DONE, TaskListFilter.CANCELLED):
        return [task for task in tasks if task.status == normalized.value]
    return list(tasks)


def _paginate_tasks(tasks: list, page: int) -> tuple[list, int, int]:
    total_pages = max(1, (len(tasks) + TASKS_PER_PAGE - 1) // TASKS_PER_PAGE)
    safe_page = min(max(1, page), total_pages)
    start = (safe_page - 1) * TASKS_PER_PAGE
    end = start + TASKS_PER_PAGE
    return tasks[start:end], safe_page, total_pages


def _scope_title(scope: TaskListScope) -> str:
    if scope == TaskListScope.MY:
        return "Мои задачи"
    return "Задачи компании"


def _truncate_text(value: str, limit: int) -> str:
    compact = " ".join((value or "").split())
    if len(compact) <= limit:
        return compact
    return f"{compact[: max(0, limit - 1)].rstrip()}…"


def _format_task_list_item(task) -> str:
    title = escape(_truncate_text(task.title, TASK_LIST_TITLE_LIMIT) or "Без названия")
    status_icon = STATUS_EMOJI.get(task.status, "•")
    status_label = STATUS_LABELS.get(task.status, task.status.replace("_", " ").title())
    priority_icon = PRIORITY_EMOJI.get(task.priority, "•")
    priority_label = PRIORITY_LABELS.get(task.priority, task.priority.title())
    deadline_str = task.deadline.strftime("%d.%m") if task.deadline else "—"
    return (
        f"• <b>#{task.short_id}</b> {title}\n"
        f"  {status_icon} {status_label} · {priority_icon} {priority_label} · 📅 {deadline_str}"
    )


def _format_list_caption(
    scope: TaskListScope,
    member: TeamMember,
    task_filter: TaskListFilter,
    department_label: str | None,
    page: int,
    total_pages: int,
    total_tasks: int,
    page_tasks: list,
) -> str:
    filter_label = TASK_FILTER_LABELS.get(task_filter, task_filter.value)
    title = _scope_title(scope)
    if scope == TaskListScope.TEAM and not PermissionService.is_moderator(member):
        title = "Задачи отдела"
    lines = [
        f"<b>📋 {title}</b>",
    ]
    if scope == TaskListScope.TEAM:
        lines.append(f"Отдел: <b>{department_label or 'Без отдела'}</b>")
    lines.extend([
        f"Фильтр: <b>{filter_label}</b>",
        f"Страница: {page}/{total_pages} · Всего: {total_tasks}",
        "",
    ])
    if page_tasks:
        lines.append("Список задач на этой странице:")
        lines.append("")
        for index, task in enumerate(page_tasks):
            lines.append(_format_task_list_item(task))
            if index < len(page_tasks) - 1:
                lines.append("")
        lines.extend([
            "",
            "Нажми кнопку с номером задачи ниже, чтобы открыть карточку.",
        ])
    else:
        lines.append("По этому фильтру задач нет.")
    return "\n".join(lines)


async def _resolve_department_scope_state(
    *,
    scope: TaskListScope,
    member: TeamMember,
    session,
    department_token: str | None,
) -> tuple[uuid.UUID | None, str, list[tuple[str, str]], str | None]:
    effective_token = _coalesce_department_token(department_token, member)
    if scope != TaskListScope.TEAM:
        return None, effective_token, [], None

    departments = await department_repo.get_all(session)
    departments_by_id = {department.id: department for department in departments}

    if PermissionService.is_moderator(member):
        requested_department_id, is_token_valid = _decode_department_token(effective_token)
        default_department_id = (
            member.department_id if member.department_id in departments_by_id else None
        )
        if not is_token_valid:
            selected_department_id = default_department_id
        elif requested_department_id is None:
            selected_department_id = None
        elif requested_department_id in departments_by_id:
            selected_department_id = requested_department_id
        else:
            selected_department_id = default_department_id

        selected_token = _department_token_from_id(selected_department_id)
        selected_label = (
            departments_by_id[selected_department_id].name
            if selected_department_id is not None
            else "Все отделы"
        )
        options = [(ALL_DEPARTMENTS_TOKEN, "Все отделы")]
        options.extend((department.id.hex, department.name) for department in departments)
        return selected_department_id, selected_token, options, selected_label

    visible_department_ids = await resolve_visible_department_ids(session, member)
    allowed_department_ids = [
        department_id
        for department_id in (visible_department_ids or [])
        if department_id in departments_by_id
    ]
    requested_department_id, is_token_valid = _decode_department_token(effective_token)
    default_department_id = get_default_department_id(member)
    if default_department_id not in allowed_department_ids:
        default_department_id = allowed_department_ids[0] if allowed_department_ids else None

    if requested_department_id in allowed_department_ids:
        selected_department_id = requested_department_id
    elif requested_department_id is None and is_token_valid:
        selected_department_id = default_department_id
    else:
        selected_department_id = default_department_id

    selected_token = _department_token_from_id(selected_department_id)
    if selected_department_id is None:
        return None, selected_token, [], "Без отдела"

    selected_department_name = departments_by_id[selected_department_id].name
    department_options = [
        (department_id.hex, departments_by_id[department_id].name)
        for department_id in allowed_department_ids
    ]
    return (
        selected_department_id,
        selected_token,
        department_options,
        selected_department_name,
    )


async def _load_scope_tasks(
    *,
    session,
    scope: TaskListScope,
    member: TeamMember,
    department_id: uuid.UUID | None,
) -> list:
    if scope == TaskListScope.MY:
        return await task_service.get_my_tasks(session, member.id)

    if department_id is not None:
        stmt = (
            select(Task)
            .options(selectinload(Task.assignee), selectinload(Task.created_by))
            .join(Task.assignee)
            .where(
                TeamMember.department_id == department_id,
                Task.status.notin_(["done", "cancelled"]),
            )
            .order_by(Task.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    if PermissionService.is_moderator(member):
        return await task_service.get_all_active_tasks(session)

    return await task_service.get_visible_active_tasks(session, member)


async def _build_task_list_view(
    session_maker: async_sessionmaker,
    scope: TaskListScope,
    member: TeamMember,
    task_filter: TaskListFilter,
    page: int,
    department_token: str | None = None,
) -> tuple[str, InlineKeyboardMarkup]:
    normalized_filter = _normalize_task_filter(task_filter)
    async with session_maker() as session:
        (
            selected_department_id,
            selected_department_token,
            department_options,
            department_label,
        ) = await _resolve_department_scope_state(
            scope=scope,
            member=member,
            session=session,
            department_token=department_token,
        )
        tasks = await _load_scope_tasks(
            session=session,
            scope=scope,
            member=member,
            department_id=selected_department_id,
        )

    filtered_tasks = _filter_tasks(tasks, normalized_filter)
    page_tasks, safe_page, total_pages = _paginate_tasks(filtered_tasks, page)

    text = _format_list_caption(
        scope=scope,
        member=member,
        task_filter=normalized_filter,
        department_label=department_label,
        page=safe_page,
        total_pages=total_pages,
        total_tasks=len(filtered_tasks),
        page_tasks=page_tasks,
    )
    keyboard = task_list_keyboard(
        page_tasks,
        scope=scope,
        current_filter=normalized_filter,
        page=safe_page,
        total_pages=total_pages,
        department_token=selected_department_token,
        department_options=department_options,
    )
    return text, keyboard


async def _safe_edit_text(
    message: Message,
    text: str,
    reply_markup: InlineKeyboardMarkup | None = None,
    parse_mode: str | None = None,
) -> None:
    try:
        await message.edit_text(
            text=text,
            parse_mode=parse_mode,
            reply_markup=reply_markup,
        )
    except TelegramBadRequest as exc:
        if "message is not modified" not in str(exc).lower():
            raise
        if reply_markup is None:
            return
        try:
            await message.edit_reply_markup(reply_markup=reply_markup)
        except TelegramBadRequest as markup_exc:
            if "message is not modified" not in str(markup_exc).lower():
                raise


def _parse_list_context_parts(
    parts: list[str],
    *,
    scope_index: int,
    task_filter_index: int,
    page_index: int,
    department_index: int,
) -> tuple[TaskListScope, TaskListFilter, int, str | None] | None:
    if len(parts) <= page_index:
        return None

    try:
        scope = TaskListScope(parts[scope_index])
        task_filter = _normalize_task_filter(TaskListFilter(parts[task_filter_index]))
        page = max(1, int(parts[page_index]))
    except (TypeError, ValueError):
        return None

    department_token = parts[department_index] if len(parts) > department_index else None
    if department_token == "":
        department_token = None
    return scope, task_filter, page, department_token


def _parse_task_list_callback_data(
    callback_data: str,
) -> tuple[TaskListScope, TaskListFilter, int, str | None] | None:
    try:
        parsed = TaskListCallback.unpack(callback_data)
        return (
            parsed.scope,
            _normalize_task_filter(parsed.task_filter),
            max(1, parsed.page),
            parsed.department_token or None,
        )
    except ValueError:
        parts = callback_data.split(":")
        if not parts or parts[0] != "tlst":
            return None
        return _parse_list_context_parts(
            parts,
            scope_index=1,
            task_filter_index=2,
            page_index=3,
            department_index=4,
        )


def _parse_task_refresh_list_callback_data(
    callback_data: str,
) -> tuple[TaskListScope, TaskListFilter, int, str | None] | None:
    try:
        parsed = TaskRefreshListCallback.unpack(callback_data)
        return (
            parsed.scope,
            _normalize_task_filter(parsed.task_filter),
            max(1, parsed.page),
            parsed.department_token or None,
        )
    except ValueError:
        parts = callback_data.split(":")
        if not parts or parts[0] != "tref":
            return None
        return _parse_list_context_parts(
            parts,
            scope_index=1,
            task_filter_index=2,
            page_index=3,
            department_index=4,
        )


def _parse_task_back_to_list_callback_data(
    callback_data: str,
) -> tuple[TaskListScope, TaskListFilter, int, str | None] | None:
    try:
        parsed = TaskBackToListCallback.unpack(callback_data)
        return (
            parsed.scope,
            _normalize_task_filter(parsed.task_filter),
            max(1, parsed.page),
            parsed.department_token or None,
        )
    except ValueError:
        parts = callback_data.split(":")
        if not parts or parts[0] != "tback":
            return None
        return _parse_list_context_parts(
            parts,
            scope_index=1,
            task_filter_index=2,
            page_index=3,
            department_index=4,
        )


def _parse_task_card_callback_data(
    callback_data: str,
) -> tuple[int, TaskListScope, TaskListFilter, int, str | None] | None:
    try:
        parsed = TaskCardCallback.unpack(callback_data)
        return (
            parsed.short_id,
            parsed.scope,
            _normalize_task_filter(parsed.task_filter),
            max(1, parsed.page),
            parsed.department_token or None,
        )
    except ValueError:
        parts = callback_data.split(":")
        if len(parts) < 5 or parts[0] != "tcard":
            return None
        try:
            short_id = int(parts[1])
        except ValueError:
            return None
        parsed = _parse_list_context_parts(
            parts,
            scope_index=2,
            task_filter_index=3,
            page_index=4,
            department_index=5,
        )
        if not parsed:
            return None
        scope, task_filter, page, department_token = parsed
        return short_id, scope, task_filter, page, department_token


def _extract_list_context_from_markup(
    markup: InlineKeyboardMarkup | None,
    member: TeamMember,
) -> TaskListContext | None:
    if not markup:
        return None

    for row in markup.inline_keyboard:
        for button in row:
            data = button.callback_data or ""
            if data.startswith("tback:"):
                parsed = _parse_task_back_to_list_callback_data(data)
                if not parsed:
                    continue
                scope, task_filter, page, department_token = parsed
                return (
                    scope,
                    task_filter,
                    page,
                    _coalesce_department_token(department_token, member),
                )

            # Back callback from reassignment flow may carry list context.
            if data.startswith(f"{TASK_BACK_CALLBACK_PREFIX}:") or data.startswith(
                f"{LEGACY_TASK_BACK_CALLBACK_PREFIX}:"
            ):
                try:
                    _, context = _parse_task_back_callback_data(data, member)
                except (IndexError, ValueError):
                    continue
                if context:
                    return context
    return None


def _task_back_callback_data(
    short_id: int,
    context: TaskListContext | None = None,
) -> str:
    if not context:
        return f"{TASK_BACK_CALLBACK_PREFIX}:{short_id}"
    scope, task_filter, page, department_token = context
    return (
        f"{TASK_BACK_CALLBACK_PREFIX}:{short_id}:{scope.value}:"
        f"{task_filter.value}:{page}:{department_token}"
    )


def _parse_task_back_callback_data(
    callback_data: str,
    member: TeamMember,
) -> tuple[int, TaskListContext | None]:
    parts = callback_data.split(":")
    if len(parts) < 2 or parts[0] not in (
        TASK_BACK_CALLBACK_PREFIX,
        LEGACY_TASK_BACK_CALLBACK_PREFIX,
    ):
        raise ValueError("Unsupported task_back callback prefix")

    short_id = int(parts[1])
    parsed = _parse_list_context_parts(
        parts,
        scope_index=2,
        task_filter_index=3,
        page_index=4,
        department_index=5,
    )
    if not parsed:
        return short_id, None

    scope, task_filter, page, department_token = parsed
    return (
        short_id,
        (
            scope,
            task_filter,
            page,
            _coalesce_department_token(department_token, member),
        ),
    )


def _task_detail_keyboard(
    task_id: int,
    is_moderator: bool,
    context: TaskListContext | None = None,
) -> InlineKeyboardMarkup:
    if not context:
        return task_actions_keyboard(task_id, is_moderator)
    scope, task_filter, page, department_token = context
    return task_card_keyboard(
        task_id=task_id,
        is_moderator=is_moderator,
        scope=scope,
        current_filter=task_filter,
        page=page,
        department_token=department_token,
    )


def _task_reminder_keyboard(
    *,
    short_id: int,
    has_reminder: bool,
    context: TaskListContext | None = None,
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = [
        [
            InlineKeyboardButton(
                text="📅 Дата и время",
                callback_data=f"task_reminder_set:{short_id}",
            )
        ],
        [
            InlineKeyboardButton(
                text="💬 Комментарий",
                callback_data=f"task_reminder_comment:{short_id}",
            )
        ],
    ]
    if has_reminder:
        rows.append([
            InlineKeyboardButton(
                text="🗑 Удалить напоминание",
                callback_data=f"task_reminder_clear:{short_id}",
            )
        ])
    rows.append([
        InlineKeyboardButton(
            text="↩️ Назад",
            callback_data=_task_back_callback_data(short_id, context),
        )
    ])
    return InlineKeyboardMarkup(inline_keyboard=rows)


# ── /tasks — Мои задачи ──


@router.message(Command("tasks"))
async def cmd_tasks(message: Message, member: TeamMember, session_maker: async_sessionmaker) -> None:
    text, keyboard = await _build_task_list_view(
        session_maker=session_maker,
        scope=TaskListScope.MY,
        member=member,
        task_filter=TaskListFilter.ALL,
        page=1,
        department_token=_default_department_token(member),
    )
    await message.answer(text, parse_mode="HTML", reply_markup=keyboard)


# ── /all — Задачи отдела / компании ──


@router.message(Command("all"))
async def cmd_all(message: Message, member: TeamMember, session_maker: async_sessionmaker) -> None:
    text, keyboard = await _build_task_list_view(
        session_maker=session_maker,
        scope=TaskListScope.TEAM,
        member=member,
        task_filter=TaskListFilter.ALL,
        page=1,
        department_token=_default_department_token(member),
    )
    await message.answer(text, parse_mode="HTML", reply_markup=keyboard)


@router.callback_query(F.data.startswith("tlst:"))
async def cb_task_list(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    parsed = _parse_task_list_callback_data(callback.data or "")
    if not parsed:
        await callback.answer("Некорректный callback", show_alert=True)
        return
    scope, task_filter, page, department_token = parsed

    text, keyboard = await _build_task_list_view(
        session_maker=session_maker,
        scope=scope,
        member=member,
        task_filter=task_filter,
        page=page,
        department_token=_coalesce_department_token(department_token, member),
    )
    await _safe_edit_text(callback.message, text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data.startswith("tref:"))
async def cb_task_list_refresh(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    parsed = _parse_task_refresh_list_callback_data(callback.data or "")
    if not parsed:
        await callback.answer("Некорректный callback", show_alert=True)
        return
    scope, task_filter, page, department_token = parsed

    text, keyboard = await _build_task_list_view(
        session_maker=session_maker,
        scope=scope,
        member=member,
        task_filter=task_filter,
        page=page,
        department_token=_coalesce_department_token(department_token, member),
    )
    await _safe_edit_text(callback.message, text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer("Обновлено")


@router.callback_query(F.data.startswith("tcard:"))
async def cb_task_card_open(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    parsed = _parse_task_card_callback_data(callback.data or "")
    if not parsed:
        await callback.answer("Некорректный callback", show_alert=True)
        return
    short_id, scope, task_filter, page, department_token = parsed
    department_token = _coalesce_department_token(department_token, member)
    normalized_filter = _normalize_task_filter(task_filter)

    async with session_maker() as session:
        task = await task_service.get_task_by_short_id(session, short_id)
        if task and not await can_access_task(session, member, task):
            task = None

    if not task:
        await callback.answer("Задача недоступна в вашей зоне видимости", show_alert=True)
        text, keyboard = await _build_task_list_view(
            session_maker=session_maker,
            scope=scope,
            member=member,
            task_filter=normalized_filter,
            page=page,
            department_token=department_token,
        )
        await _safe_edit_text(callback.message, text, reply_markup=keyboard, parse_mode="HTML")
        return

    is_mod = PermissionService.is_moderator(member)
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=task_card_keyboard(
            task_id=task.short_id,
            is_moderator=is_mod,
            scope=scope,
            current_filter=normalized_filter,
            page=max(1, page),
            department_token=department_token,
        ),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("tback:"))
async def cb_task_back_to_list(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    parsed = _parse_task_back_to_list_callback_data(callback.data or "")
    if not parsed:
        await callback.answer("Некорректный callback", show_alert=True)
        return
    scope, task_filter, page, department_token = parsed

    text, keyboard = await _build_task_list_view(
        session_maker=session_maker,
        scope=scope,
        member=member,
        task_filter=task_filter,
        page=page,
        department_token=_coalesce_department_token(department_token, member),
    )
    await _safe_edit_text(callback.message, text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer()


# ── /new <текст> — Создать задачу себе ──


@router.message(Command("new"))
async def cmd_new(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    args = (message.text or "").split(maxsplit=1)
    if len(args) < 2:
        await start_new_task_flow(message, state)
        return

    await state.clear()
    await _create_task_for_member(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        raw_text=args[1].strip(),
    )


@router.message(TaskCommandFSM.waiting_new_text, Command("cancel"))
async def fsm_cancel_new(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Создание задачи отменено")


@router.message(TaskCommandFSM.waiting_new_text)
async def fsm_new_text(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    raw_text = message.text.strip() if message.text else ""
    if not raw_text:
        await message.answer("❌ Текст задачи не может быть пустым. Попробуйте ещё раз или /cancel")
        return

    if await _create_task_for_member(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        raw_text=raw_text,
    ):
        await state.clear()


# ── Group mentions: "@bot <text>" -> create task ──


@router.message(F.chat.type.in_(GROUP_CHAT_TYPES), F.text, ~F.text.startswith("/"))
async def handle_group_task_by_mention(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
) -> None:
    if not message.text:
        return
    if not await is_chat_allowed_for_incoming_tasks(session_maker, message.chat.id):
        return

    raw_text = message.text.strip()
    if not raw_text or raw_text.startswith("/"):
        return

    bot_username = _normalize_telegram_username(settings.TELEGRAM_BOT_USERNAME)
    bot_user_id = getattr(bot, "id", None)
    if not _message_mentions_bot(
        message,
        bot_username=bot_username,
        bot_user_id=bot_user_id,
    ):
        return

    task_text = _strip_bot_username_mentions(raw_text, bot_username)
    if not task_text:
        await message.reply("Укажи текст задачи после упоминания бота.")
        return

    sender_id = message.from_user.id if message.from_user else 0
    if sender_id and _is_recent_group_task_duplicate(message.chat.id, sender_id, task_text):
        return

    parsed = await _parse_task_creation_payload(
        raw_text=task_text,
        member=member,
        session_maker=session_maker,
    )
    if not parsed["title"]:
        await message.reply("❌ Текст задачи не может быть пустым")
        return

    explicit_usernames = [
        username
        for username in _extract_username_mentions(raw_text)
        if username != bot_username
    ]
    explicit_text_mention_ids = [
        user_id
        for user_id in _extract_text_mention_user_ids(message)
        if bot_user_id is None or user_id != bot_user_id
    ]

    can_assign_to_others = PermissionService.can_create_task_for_others(member)
    assignee_id = member.id
    assignee_name = member.full_name
    assignee_note: str | None = None

    if can_assign_to_others:
        async with session_maker() as session:
            async with session.begin():
                team_members = await member_repo.get_all_active(session)
                assignee_id, assignee_name, assignee_note = _resolve_group_task_assignee(
                    creator=member,
                    team_members=team_members,
                    explicit_usernames=explicit_usernames,
                    explicit_text_mention_ids=explicit_text_mention_ids,
                    parsed_assignee_name=parsed["assignee_name"],
                )

                task = await task_service.create_task(
                    session,
                    title=parsed["title"],
                    creator=member,
                    assignee_id=assignee_id,
                    description=parsed["description"],
                    priority=parsed["priority"],
                    deadline=parsed["deadline"],
                    reminder_at=parsed["reminder_at"],
                    reminder_comment=parsed["reminder_comment"],
                    source="text",
                )

                notification_service = NotificationService(bot)
                await notification_service.notify_task_created(session, task, member)
    else:
        if explicit_usernames or explicit_text_mention_ids or parsed["assignee_name"]:
            assignee_note = (
                "Назначение другим участникам недоступно для вашей роли. "
                "Задачу назначил на автора."
            )
        async with session_maker() as session:
            async with session.begin():
                task = await task_service.create_task(
                    session,
                    title=parsed["title"],
                    creator=member,
                    assignee_id=member.id,
                    description=parsed["description"],
                    priority=parsed["priority"],
                    deadline=parsed["deadline"],
                    reminder_at=parsed["reminder_at"],
                    reminder_comment=parsed["reminder_comment"],
                    source="text",
                )

                notification_service = NotificationService(bot)
                await notification_service.notify_task_created(session, task, member)

    is_mod = PermissionService.is_moderator(member)
    prio = PRIORITY_EMOJI.get(task.priority, "")
    deadline_str = f"\n📅 Дедлайн: {task.deadline.strftime('%d.%m.%Y')}" if task.deadline else ""
    reminder_str = (
        f"\n⏰ Напоминание: {_format_task_reminder_datetime(task.reminder_at)}"
        if task.reminder_at
        else ""
    )

    response_lines = [
        "✅ Задача создана:",
        f"#{task.short_id} · {task.title}",
        f"👤 Исполнитель: {assignee_name}",
        f"{prio} {task.priority}{deadline_str}{reminder_str}",
    ]
    if assignee_note:
        response_lines.append(f"ℹ️ {assignee_note}")

    controls_sent = await _send_private_task_controls(
        bot=bot,
        member=member,
        task=task,
        is_moderator=is_mod,
    )
    response_lines.append(
        "🔒 Кнопки управления отправил в личные сообщения."
        if controls_sent
        else "ℹ️ Не удалось отправить кнопки в личку. Напишите боту /start в личном чате."
    )

    await message.reply("\n".join(response_lines))


# ── /assign @username <текст> — Назначить задачу ──


@router.message(Command("assign"))
async def cmd_assign(message: Message, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not PermissionService.can_create_task_for_others(member):
        await message.answer("⛔ У вас нет прав назначать задачи другим участникам")
        return

    args = message.text.split(maxsplit=2)
    if len(args) < 3:
        await message.answer(
            "Использование: /assign @username <текст задачи>\n\n"
            "Можно писать обычным текстом, включая дедлайн и напоминание"
        )
        return

    username_raw = args[1].strip()
    raw_text = args[2].strip()
    parsed = await _parse_task_creation_payload(
        raw_text=raw_text,
        member=member,
        session_maker=session_maker,
    )
    if not parsed["title"]:
        await message.answer("❌ Текст задачи не может быть пустым")
        return

    # Strip @ from username
    username = username_raw.lstrip("@")

    async with session_maker() as session:
        async with session.begin():
            # Find assignee by username
            members = await member_repo.get_all_active(session)
            assignee = None
            for m in members:
                if m.telegram_username and m.telegram_username.lower() == username.lower():
                    assignee = m
                    break

            if not assignee:
                await message.answer(f"❌ Пользователь @{username} не найден в команде")
                return

            task = await task_service.create_task(
                session,
                title=parsed["title"],
                creator=member,
                assignee_id=assignee.id,
                description=parsed["description"],
                priority=parsed["priority"],
                deadline=parsed["deadline"],
                reminder_at=parsed["reminder_at"],
                reminder_comment=parsed["reminder_comment"],
                source="text",
            )

            # Notify
            notification_service = NotificationService(bot)
            await notification_service.notify_task_created(session, task, member)

    prio = PRIORITY_EMOJI.get(task.priority, "")
    deadline_str = f"\n📅 Дедлайн: {task.deadline.strftime('%d.%m.%Y')}" if task.deadline else ""
    reminder_str = (
        f"\n⏰ Напоминание: {_format_task_reminder_datetime(task.reminder_at)}"
        if task.reminder_at
        else ""
    )

    await message.answer(
        f"✅ Задача назначена:\n\n"
        f"#{task.short_id} · {task.title}\n"
        f"👤 Исполнитель: {assignee.full_name}\n"
        f"{prio} {task.priority}{deadline_str}{reminder_str}",
        reply_markup=task_actions_keyboard(
            task.short_id,
            PermissionService.is_moderator(member),
        ),
    )


# ── /done <id> — Завершить задачу ──


@router.message(Command("done"))
async def cmd_done(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    args = (message.text or "").split(maxsplit=1)
    if len(args) < 2:
        await state.set_state(TaskCommandFSM.waiting_done_id)
        await message.answer(
            "✅ Введите ID задачи для завершения.\n"
            "Пример: 42\n"
            "Для отмены отправьте /cancel"
        )
        return

    await state.clear()

    short_id = _parse_short_id(args[1])
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом")
        return

    await _complete_task_by_short_id(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
    )


@router.message(TaskCommandFSM.waiting_done_id, Command("cancel"))
async def fsm_cancel_done(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Завершение задачи отменено")


@router.message(TaskCommandFSM.waiting_done_id)
async def fsm_done_id(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    raw_id = message.text.strip() if message.text else ""
    short_id = _parse_short_id(raw_id)
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом. Попробуйте ещё раз или /cancel")
        return

    if await _complete_task_by_short_id(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
    ):
        await state.clear()


# ── /status <id> <статус> — Изменить статус ──


@router.message(Command("status"))
async def cmd_status(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    args = (message.text or "").split(maxsplit=2)
    if len(args) < 3:
        await state.set_state(TaskCommandFSM.waiting_status_payload)
        await message.answer(f"{STATUS_USAGE_TEXT}\n\nДля отмены отправьте /cancel")
        return

    await state.clear()

    short_id = _parse_short_id(args[1])
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом")
        return

    new_status = args[2].strip().lower()
    await _update_task_status(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
        new_status=new_status,
    )


@router.message(TaskCommandFSM.waiting_status_payload, Command("cancel"))
async def fsm_cancel_status(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Смена статуса отменена")


@router.message(TaskCommandFSM.waiting_status_payload)
async def fsm_status_payload(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    raw_payload = message.text.strip() if message.text else ""
    parts = raw_payload.split(maxsplit=1)
    if len(parts) < 2:
        await message.answer(
            "❌ Нужны ID и статус.\n"
            "Пример: 42 in_progress\n"
            "Допустимые статусы: new, in_progress, review, done, cancelled\n"
            "Для отмены: /cancel"
        )
        return

    short_id = _parse_short_id(parts[0])
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом. Попробуйте ещё раз или /cancel")
        return

    new_status = parts[1].strip().lower()
    if not new_status:
        await message.answer("❌ Укажите статус после ID. Попробуйте ещё раз или /cancel")
        return

    if await _update_task_status(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
        new_status=new_status,
    ):
        await state.clear()


# ── /edit <id> — Редактирование полей задачи ──


@router.message(Command("edit"))
async def cmd_edit_task(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    state: FSMContext,
) -> None:
    args = (message.text or "").split(maxsplit=1)
    if len(args) < 2:
        await message.answer(TASK_EDIT_USAGE_TEXT)
        return

    short_id = _parse_short_id(args[1])
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом.\n\n" + TASK_EDIT_USAGE_TEXT)
        return

    async with session_maker() as session:
        task, editable_fields, error = await _load_task_for_edit(
            session=session,
            member=member,
            short_id=short_id,
        )

    if error == "not_found":
        await message.answer(f"❌ Задача #{short_id} не найдена")
        return
    if error == "no_access":
        await message.answer("⛔ Задача недоступна в вашей зоне видимости")
        return
    if error == "forbidden":
        await message.answer("⛔ У вас нет прав на редактирование этой задачи")
        return

    await state.clear()
    await message.answer(
        _format_task_edit_panel(task, editable_fields=editable_fields),
        parse_mode="HTML",
        reply_markup=_task_edit_fields_keyboard(short_id, editable_fields),
    )


@router.callback_query(F.data.startswith("task_edit:"))
async def cb_task_edit_open(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    state: FSMContext,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    try:
        short_id = int((callback.data or "").split(":", maxsplit=1)[1])
    except (IndexError, ValueError):
        await callback.answer("Некорректный callback", show_alert=True)
        return

    async with session_maker() as session:
        task, editable_fields, error = await _load_task_for_edit(
            session=session,
            member=member,
            short_id=short_id,
        )

    if error == "not_found":
        await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
        return
    if error == "no_access":
        await callback.answer("Нет доступа к задаче", show_alert=True)
        return
    if error == "forbidden":
        await callback.answer("Нет прав на редактирование", show_alert=True)
        return

    await state.clear()
    await callback.answer()
    await _safe_edit_text(
        callback.message,
        _format_task_edit_panel(task, editable_fields=editable_fields),
        parse_mode="HTML",
        reply_markup=_task_edit_fields_keyboard(short_id, editable_fields),
    )


@router.callback_query(F.data.startswith("task_edit_fields:"))
async def cb_task_edit_fields(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    parts = (callback.data or "").split(":")
    if len(parts) != 2:
        await callback.answer("Некорректный callback", show_alert=True)
        return
    try:
        short_id = int(parts[1])
    except ValueError:
        await callback.answer("Некорректный ID задачи", show_alert=True)
        return

    async with session_maker() as session:
        task, editable_fields, error = await _load_task_for_edit(
            session=session,
            member=member,
            short_id=short_id,
        )

    if error == "not_found":
        await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
        return
    if error == "no_access":
        await callback.answer("Нет доступа к задаче", show_alert=True)
        return
    if error == "forbidden":
        await callback.answer("Нет прав на редактирование", show_alert=True)
        return

    await callback.answer()
    await _safe_edit_text(
        callback.message,
        _format_task_edit_panel(task, editable_fields=editable_fields),
        parse_mode="HTML",
        reply_markup=_task_edit_fields_keyboard(short_id, editable_fields),
    )


@router.callback_query(F.data.startswith("task_edit_help:"))
async def cb_task_edit_help(callback: CallbackQuery) -> None:
    await callback.answer(
        "Приоритет: low/medium/high/urgent. "
        "Дедлайн: ДД.ММ или ДД.ММ.ГГГГ. "
        "Очистка: '-', none, нет.",
        show_alert=True,
    )


@router.callback_query(F.data.startswith("task_edit_field:"))
async def cb_task_edit_field(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    state: FSMContext,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    parts = (callback.data or "").split(":")
    if len(parts) != 3:
        await callback.answer("Некорректный callback", show_alert=True)
        return

    try:
        short_id = int(parts[1])
    except ValueError:
        await callback.answer("Некорректный ID задачи", show_alert=True)
        return

    field = parts[2]
    if field not in TASK_EDIT_FIELD_LABELS:
        await callback.answer("Неизвестное поле", show_alert=True)
        return

    async with session_maker() as session:
        task, editable_fields, error = await _load_task_for_edit(
            session=session,
            member=member,
            short_id=short_id,
        )
        if error == "not_found":
            await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
            return
        if error == "no_access":
            await callback.answer("Нет доступа к задаче", show_alert=True)
            return
        if error == "forbidden":
            await callback.answer("Нет прав на редактирование", show_alert=True)
            return
        if field not in editable_fields:
            await callback.answer("Нет прав на это поле", show_alert=True)
            return

        if field == "assignee":
            team_members = await member_repo.get_all_active(session)
            await callback.answer()
            await _safe_edit_text(
                callback.message,
                (
                    f"👤 Выберите исполнителя для задачи #{task.short_id}\n\n"
                    f"<b>{escape(task.title)}</b>"
                ),
                parse_mode="HTML",
                reply_markup=_task_edit_assignee_keyboard(
                    short_id,
                    members=team_members,
                    current_assignee_id=task.assignee_id,
                ),
            )
            return

    await state.set_state(TaskEditFSM.waiting_value)
    await state.update_data(task_edit_short_id=short_id, task_edit_field=field)
    await callback.answer()
    await callback.message.answer(
        _task_edit_prompt_text(field) + "\n\nДля отмены: /cancel",
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("task_edit_assign:"))
async def cb_task_edit_assign(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    parts = (callback.data or "").split(":")
    if len(parts) != 3:
        await callback.answer("Некорректный callback", show_alert=True)
        return

    try:
        short_id = int(parts[1])
    except ValueError:
        await callback.answer("Некорректный ID задачи", show_alert=True)
        return
    assignee_token = parts[2].strip().lower()
    context = _extract_list_context_from_markup(callback.message.reply_markup, member)

    async with session_maker() as session:
        async with session.begin():
            task, editable_fields, error = await _load_task_for_edit(
                session=session,
                member=member,
                short_id=short_id,
            )
            if error == "not_found":
                await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
                return
            if error == "no_access":
                await callback.answer("Нет доступа к задаче", show_alert=True)
                return
            if error == "forbidden":
                await callback.answer("Нет прав на редактирование", show_alert=True)
                return
            if "assignee" not in editable_fields:
                await callback.answer("Нет прав на изменение исполнителя", show_alert=True)
                return

            if assignee_token in {"none", "null", "-"}:
                if task.assignee_id is None:
                    updated_task = task
                else:
                    updated_task = await task_repo.update(session, task.id, assignee_id=None)
            else:
                try:
                    new_assignee_id = uuid.UUID(assignee_token)
                except ValueError:
                    await callback.answer("Некорректный исполнитель", show_alert=True)
                    return

                try:
                    updated_task = await task_service.assign_task(
                        session, task, member, new_assignee_id
                    )
                except (PermissionError, ValueError) as e:
                    await callback.answer(str(e), show_alert=True)
                    return

                new_assignee = await member_repo.get_by_id(session, new_assignee_id)
                notification_service = NotificationService(bot)
                await notification_service.notify_task_assigned(
                    session, updated_task, member, new_assignee
                )

    await state.clear()
    await callback.answer("✅ Исполнитель обновлён")
    await _safe_edit_text(
        callback.message,
        _format_task_detail(updated_task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=updated_task.short_id,
            is_moderator=PermissionService.is_moderator(member),
            context=context,
        ),
    )


@router.message(TaskEditFSM.waiting_value, Command("cancel"))
async def fsm_cancel_task_edit_value(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Редактирование задачи отменено")


@router.message(TaskEditFSM.waiting_value)
async def fsm_task_edit_value(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    state: FSMContext,
) -> None:
    state_data = await state.get_data()
    short_id_raw = state_data.get("task_edit_short_id")
    field = state_data.get("task_edit_field")
    if not short_id_raw or not field:
        await state.clear()
        await message.answer("❌ Сессия редактирования устарела. Используйте /edit <id>.")
        return

    try:
        short_id = int(short_id_raw)
    except (TypeError, ValueError):
        await state.clear()
        await message.answer("❌ Некорректный ID задачи. Используйте /edit <id>.")
        return

    raw_value = message.text.strip() if message.text else ""
    if not raw_value:
        await message.answer("❌ Значение не может быть пустым. Попробуйте ещё раз или /cancel")
        return

    async with session_maker() as session:
        async with session.begin():
            task, editable_fields, error = await _load_task_for_edit(
                session=session,
                member=member,
                short_id=short_id,
            )
            if error == "not_found":
                await state.clear()
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return
            if error == "no_access":
                await state.clear()
                await message.answer("⛔ Задача недоступна в вашей зоне видимости")
                return
            if error == "forbidden" or field not in editable_fields:
                await state.clear()
                await message.answer("⛔ Нет прав на изменение этого поля")
                return

            if field == "title":
                title = raw_value.strip()
                if not title:
                    await message.answer("❌ Название не может быть пустым")
                    return
                updated_task = await task_repo.update(session, task.id, title=title)
                success_text = "✅ Название задачи обновлено"
            elif field == "description":
                value_normalized = raw_value.strip()
                description = (
                    None if value_normalized.lower() in TASK_EDIT_CLEAR_VALUES else value_normalized
                )
                updated_task = await task_repo.update(
                    session, task.id, description=description
                )
                success_text = (
                    "✅ Описание очищено"
                    if description is None
                    else "✅ Описание обновлено"
                )
            elif field == "priority":
                priority = _normalize_priority_input(raw_value)
                if not priority:
                    await message.answer(
                        "❌ Неверный приоритет. Доступные: low, medium, high, urgent"
                    )
                    return
                updated_task = await task_repo.update(session, task.id, priority=priority)
                success_text = f"✅ Приоритет обновлён: {priority}"
            elif field == "deadline":
                deadline, ok = _parse_deadline_input(raw_value)
                if not ok:
                    await message.answer("❌ Формат дедлайна: ДД.ММ или ДД.ММ.ГГГГ")
                    return
                updated_task = await task_repo.update(session, task.id, deadline=deadline)
                success_text = (
                    "✅ Дедлайн снят"
                    if deadline is None
                    else f"✅ Дедлайн обновлён: {deadline.strftime('%d.%m.%Y')}"
                )
            else:
                await message.answer("❌ Поле не поддерживается в этом режиме")
                return

    await state.clear()
    await message.answer(success_text)
    await message.answer(
        _format_task_detail(updated_task),
        parse_mode="HTML",
        reply_markup=task_actions_keyboard(
            updated_task.short_id,
            PermissionService.is_moderator(member),
        ),
    )


@router.callback_query(F.data.startswith("task_reminder:"))
async def cb_task_reminder_open(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    try:
        short_id = int((callback.data or "").split(":", maxsplit=1)[1])
    except (IndexError, ValueError):
        await callback.answer("Некорректный callback", show_alert=True)
        return

    context = _extract_list_context_from_markup(callback.message.reply_markup, member)

    async with session_maker() as session:
        task = await task_service.get_task_by_short_id(session, short_id)
        if not task:
            await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
            return
        if not await can_access_task(session, member, task):
            await callback.answer("Нет доступа к задаче", show_alert=True)
            return
        if not PermissionService.can_manage_task_reminder(member, task):
            await callback.answer(
                "Напоминание может настраивать исполнитель или модератор для активной задачи",
                show_alert=True,
            )
            return
        if task.assignee_id is None and task.reminder_at is None:
            await callback.answer(
                "Сначала назначьте исполнителя, затем добавьте напоминание",
                show_alert=True,
            )
            return

    await callback.answer()
    await _safe_edit_text(
        callback.message,
        _format_task_reminder_panel(task),
        parse_mode="HTML",
        reply_markup=_task_reminder_keyboard(
            short_id=task.short_id,
            has_reminder=task.reminder_at is not None,
            context=context,
        ),
    )


@router.callback_query(F.data.startswith("task_reminder_set:"))
async def cb_task_reminder_set(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    state: FSMContext,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    try:
        short_id = int((callback.data or "").split(":", maxsplit=1)[1])
    except (IndexError, ValueError):
        await callback.answer("Некорректный callback", show_alert=True)
        return

    async with session_maker() as session:
        task = await task_service.get_task_by_short_id(session, short_id)
        if not task:
            await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
            return
        if not await can_access_task(session, member, task):
            await callback.answer("Нет доступа к задаче", show_alert=True)
            return
        if not PermissionService.can_manage_task_reminder(member, task):
            await callback.answer("Нет прав на настройку напоминания", show_alert=True)
            return
        if task.assignee_id is None:
            await callback.answer(
                "Сначала назначьте исполнителя, затем установите напоминание",
                show_alert=True,
            )
            return

    await state.set_state(TaskReminderFSM.waiting_datetime)
    await state.update_data(task_reminder_short_id=short_id)
    await callback.answer()
    await callback.message.answer(
        "📅 Введите дату и время напоминания:\n"
        "<code>ДД.ММ ЧЧ:ММ</code> или <code>ДД.ММ.ГГГГ ЧЧ:ММ</code>\n\n"
        "Чтобы удалить напоминание: <code>-</code>, <code>none</code> или <code>нет</code>.\n"
        "Для отмены: /cancel",
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("task_reminder_comment:"))
async def cb_task_reminder_comment(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    state: FSMContext,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    try:
        short_id = int((callback.data or "").split(":", maxsplit=1)[1])
    except (IndexError, ValueError):
        await callback.answer("Некорректный callback", show_alert=True)
        return

    async with session_maker() as session:
        task = await task_service.get_task_by_short_id(session, short_id)
        if not task:
            await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
            return
        if not await can_access_task(session, member, task):
            await callback.answer("Нет доступа к задаче", show_alert=True)
            return
        if not PermissionService.can_manage_task_reminder(member, task):
            await callback.answer("Нет прав на настройку напоминания", show_alert=True)
            return
        if task.assignee_id is None:
            await callback.answer(
                "Сначала назначьте исполнителя, затем добавьте комментарий",
                show_alert=True,
            )
            return

    await state.set_state(TaskReminderFSM.waiting_comment)
    await state.update_data(task_reminder_short_id=short_id)
    await callback.answer()
    await callback.message.answer(
        "💬 Введите комментарий к напоминанию.\n"
        "Чтобы очистить комментарий: <code>-</code>, <code>none</code> или <code>нет</code>.\n"
        "Для отмены: /cancel",
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("task_reminder_clear:"))
async def cb_task_reminder_clear(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    try:
        short_id = int((callback.data or "").split(":", maxsplit=1)[1])
    except (IndexError, ValueError):
        await callback.answer("Некорректный callback", show_alert=True)
        return

    context = _extract_list_context_from_markup(callback.message.reply_markup, member)

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
                return
            if not await can_access_task(session, member, task):
                await callback.answer("Нет доступа к задаче", show_alert=True)
                return
            if not PermissionService.can_manage_task_reminder(member, task):
                await callback.answer("Нет прав на настройку напоминания", show_alert=True)
                return

            task = await task_repo.update(
                session,
                task.id,
                reminder_at=None,
                reminder_comment=None,
                reminder_sent_at=None,
            )

    await callback.answer("🗑 Напоминание удалено")
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=PermissionService.is_moderator(member),
            context=context,
        ),
    )


@router.message(TaskReminderFSM.waiting_datetime, Command("cancel"))
@router.message(TaskReminderFSM.waiting_comment, Command("cancel"))
async def fsm_cancel_task_reminder(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Настройка напоминания отменена")


@router.message(TaskReminderFSM.waiting_datetime)
async def fsm_task_reminder_datetime(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    state: FSMContext,
) -> None:
    state_data = await state.get_data()
    short_id_raw = state_data.get("task_reminder_short_id")
    try:
        short_id = int(short_id_raw)
    except (TypeError, ValueError):
        await state.clear()
        await message.answer("❌ Сессия напоминания устарела. Откройте задачу заново.")
        return

    raw_value = message.text.strip() if message.text else ""
    if not raw_value:
        await message.answer("❌ Введите дату и время или /cancel")
        return

    reminder_at, ok = _parse_reminder_datetime_input(raw_value)
    if not ok:
        await message.answer(
            "❌ Формат: ДД.ММ ЧЧ:ММ или ДД.ММ.ГГГГ ЧЧ:ММ.\n"
            "Время напоминания должно быть в будущем."
        )
        return

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await state.clear()
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return
            if not await can_access_task(session, member, task):
                await state.clear()
                await message.answer("⛔ Нет доступа к задаче")
                return
            if not PermissionService.can_manage_task_reminder(member, task):
                await state.clear()
                await message.answer("⛔ Нет прав на настройку напоминания")
                return
            if reminder_at is not None and task.assignee_id is None:
                await message.answer("❌ Сначала назначьте исполнителя задачи")
                return

            if reminder_at is None:
                task = await task_repo.update(
                    session,
                    task.id,
                    reminder_at=None,
                    reminder_comment=None,
                    reminder_sent_at=None,
                )
                success_text = "🗑 Напоминание удалено"
            else:
                task = await task_repo.update(
                    session,
                    task.id,
                    reminder_at=reminder_at,
                    reminder_sent_at=None,
                )
                success_text = (
                    f"✅ Напоминание установлено: "
                    f"{_format_task_reminder_datetime(reminder_at)}"
                )

    await state.clear()
    await message.answer(success_text)
    await message.answer(
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=task_actions_keyboard(
            task.short_id,
            PermissionService.is_moderator(member),
        ),
    )


@router.message(TaskReminderFSM.waiting_comment)
async def fsm_task_reminder_comment(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    state: FSMContext,
) -> None:
    state_data = await state.get_data()
    short_id_raw = state_data.get("task_reminder_short_id")
    try:
        short_id = int(short_id_raw)
    except (TypeError, ValueError):
        await state.clear()
        await message.answer("❌ Сессия напоминания устарела. Откройте задачу заново.")
        return

    raw_value = message.text.strip() if message.text else ""
    if not raw_value:
        await message.answer("❌ Введите комментарий или /cancel")
        return

    normalized_comment = (
        None if raw_value.lower() in TASK_REMINDER_CLEAR_VALUES else raw_value
    )

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await state.clear()
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return
            if not await can_access_task(session, member, task):
                await state.clear()
                await message.answer("⛔ Нет доступа к задаче")
                return
            if not PermissionService.can_manage_task_reminder(member, task):
                await state.clear()
                await message.answer("⛔ Нет прав на настройку напоминания")
                return
            if task.assignee_id is None:
                await state.clear()
                await message.answer("❌ Сначала назначьте исполнителя задачи")
                return
            if task.reminder_at is None:
                await state.clear()
                await message.answer("❌ Сначала установите дату и время напоминания")
                return

            task = await task_repo.update(
                session,
                task.id,
                reminder_comment=normalized_comment,
            )

    await state.clear()
    await message.answer(
        "✅ Комментарий обновлён"
        if normalized_comment
        else "✅ Комментарий удалён"
    )
    await message.answer(
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=task_actions_keyboard(
            task.short_id,
            PermissionService.is_moderator(member),
        ),
    )


# ── Callback handlers для inline кнопок ──


@router.callback_query(F.data.startswith("task_done:"))
async def cb_task_done(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    short_id = int(callback.data.split(":")[1])
    context = _extract_list_context_from_markup(callback.message.reply_markup, member)

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
                return

            if task.status == "done":
                await callback.answer("Задача уже завершена", show_alert=True)
                return

            try:
                old_status = task.status
                task = await task_service.complete_task(session, task, member)
            except PermissionError:
                await callback.answer("Нет прав на завершение этой задачи", show_alert=True)
                return

            notification_service = NotificationService(bot)
            await notification_service.notify_task_completed(session, task, member)
            await notification_service.notify_status_changed(
                session, task, member, old_status, "done"
            )

    await callback.answer("✅ Задача завершена!")
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=PermissionService.is_moderator(member),
            context=context,
        ),
    )


@router.callback_query(F.data.startswith("task_inprogress:"))
async def cb_task_inprogress(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    short_id = int(callback.data.split(":")[1])
    context = _extract_list_context_from_markup(callback.message.reply_markup, member)

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
                return

            old_status = task.status
            try:
                task = await task_service.update_status(session, task, member, "in_progress")
            except (PermissionError, ValueError):
                await callback.answer("Нет прав на изменение этой задачи", show_alert=True)
                return

            notification_service = NotificationService(bot)
            await notification_service.notify_status_changed(
                session, task, member, old_status, "in_progress"
            )

    await callback.answer("▶️ Задача в работе!")
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=PermissionService.is_moderator(member),
            context=context,
        ),
    )


@router.callback_query(F.data.startswith("task_review:"))
async def cb_task_review(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    short_id = int(callback.data.split(":")[1])
    context = _extract_list_context_from_markup(callback.message.reply_markup, member)

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
                return

            old_status = task.status
            try:
                task = await task_service.update_status(session, task, member, "review")
            except (PermissionError, ValueError):
                await callback.answer("Нет прав на изменение этой задачи", show_alert=True)
                return

            notification_service = NotificationService(bot)
            await notification_service.notify_status_changed(
                session, task, member, old_status, "review"
            )

    await callback.answer("👀 Задача на согласовании!")
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=PermissionService.is_moderator(member),
            context=context,
        ),
    )


@router.callback_query(F.data.startswith("task_cancel:"))
async def cb_task_cancel(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not PermissionService.is_moderator(member):
        await callback.answer("Только модератор может отменять задачи", show_alert=True)
        return

    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    short_id = int(callback.data.split(":")[1])
    context = _extract_list_context_from_markup(callback.message.reply_markup, member)

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
                return

            old_status = task.status
            task = await task_service.update_status(session, task, member, "cancelled")

            notification_service = NotificationService(bot)
            await notification_service.notify_status_changed(
                session, task, member, old_status, "cancelled"
            )

    await callback.answer("❌ Задача отменена!")
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=True,
            context=context,
        ),
    )


@router.callback_query(F.data.startswith("task_reassign:"))
async def cb_task_reassign(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    short_id = int(callback.data.split(":")[1])
    context = _extract_list_context_from_markup(callback.message.reply_markup, member)

    # Show team members list for reassignment
    async with session_maker() as session:
        members = await member_repo.get_all_active(session)
        task = await task_service.get_task_by_short_id(session, short_id)

    if not task:
        await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
        return
    if not PermissionService.can_assign_task(member, task):
        await callback.answer("Нет прав на переназначение этой задачи", show_alert=True)
        return

    buttons = []
    for m in members:
        label = f"{'✓ ' if m.id == task.assignee_id else ''}{m.full_name}"
        buttons.append([
            InlineKeyboardButton(
                text=label,
                callback_data=f"reassign:{short_id}:{m.id}",
            )
        ])
    buttons.append([
        InlineKeyboardButton(
            text="↩️ Назад",
            callback_data=_task_back_callback_data(short_id, context),
        )
    ])

    await callback.answer()
    await _safe_edit_text(
        callback.message,
        f"🔄 Переназначить задачу #{short_id}:\n{task.title}\n\nВыбери исполнителя:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data.startswith("reassign:"))
async def cb_do_reassign(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    context = _extract_list_context_from_markup(callback.message.reply_markup, member)
    parts = callback.data.split(":")
    short_id = int(parts[1])
    new_assignee_id = uuid.UUID(parts[2])

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
                return
            if not PermissionService.can_assign_task(member, task):
                await callback.answer("Нет прав на переназначение этой задачи", show_alert=True)
                return

            try:
                task = await task_service.assign_task(session, task, member, new_assignee_id)
            except (PermissionError, ValueError) as e:
                await callback.answer(str(e), show_alert=True)
                return

            new_assignee = await member_repo.get_by_id(session, new_assignee_id)
            notification_service = NotificationService(bot)
            await notification_service.notify_task_assigned(
                session, task, member, new_assignee
            )

    await callback.answer("🔄 Задача переназначена!")
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=PermissionService.is_moderator(member),
            context=context,
        ),
    )


@router.callback_query(F.data.startswith(f"{TASK_BACK_CALLBACK_PREFIX}:"))
@router.callback_query(F.data.startswith(f"{LEGACY_TASK_BACK_CALLBACK_PREFIX}:"))
async def cb_task_back(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    try:
        short_id, context = _parse_task_back_callback_data(callback.data or "", member)
    except (IndexError, ValueError):
        await callback.answer("Некорректный callback", show_alert=True)
        return

    async with session_maker() as session:
        task = await task_service.get_task_by_short_id(session, short_id)
        has_access = await can_access_task(session, member, task)

    if not task:
        await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
        return

    if not has_access:
        await callback.answer("Задача недоступна в вашей зоне видимости", show_alert=True)
        if context:
            text, keyboard = await _build_task_list_view(
                session_maker=session_maker,
                scope=context[0],
                member=member,
                task_filter=context[1],
                page=context[2],
                department_token=context[3],
            )
            await _safe_edit_text(callback.message, text, reply_markup=keyboard, parse_mode="HTML")
        return

    is_mod = PermissionService.is_moderator(member)
    await callback.answer()
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=is_mod,
            context=context,
        ),
    )


# Callback: noop (for pagination counter etc.)
@router.callback_query(F.data == "noop")
async def cb_noop(callback: CallbackQuery) -> None:
    await callback.answer()
