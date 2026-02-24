import logging
import re
import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.bot.keyboards import (
    voice_assignee_keyboard,
    voice_edit_fields_keyboard,
    voice_task_confirm_keyboard,
)
from app.config import settings
from app.db.models import TeamMember
from app.db.repositories import TeamMemberRepository
from app.services.ai_service import AIService
from app.services.notification_service import NotificationService
from app.services.permission_service import PermissionService
from app.services.task_service import TaskService
from app.services.voice_service import VoiceService

logger = logging.getLogger(__name__)

router = Router()

voice_service = VoiceService()
ai_service = AIService()
task_service = TaskService()
member_repo = TeamMemberRepository()

PRIORITY_EMOJI = {
    "urgent": "🔴",
    "high": "⚡",
    "medium": "🔵",
    "low": "⚪",
}


class VoiceTaskFSM(StatesGroup):
    preview = State()
    editing_field = State()


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


def _format_task_reminder_datetime(raw_value: str | None) -> str:
    reminder_at = _parse_ai_reminder_datetime(raw_value)
    if reminder_at is None:
        return "—"
    try:
        tz = ZoneInfo(settings.TIMEZONE)
    except Exception:
        tz = ZoneInfo("Europe/Moscow")
    local_dt = reminder_at.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz)
    return local_dt.strftime("%d.%m.%Y %H:%M")


def _format_voice_preview(data: dict) -> str:
    """Format parsed voice task for preview message."""
    prio_emoji = PRIORITY_EMOJI.get(data.get("priority", "medium"), "🔵")
    assignee_name = data.get("assignee_display_name") or "Ты"
    deadline_str = data.get("deadline") or "—"
    reminder_str = _format_task_reminder_datetime(data.get("reminder_at"))
    description = data.get("description") or "—"
    reminder_comment = (data.get("reminder_comment") or "").strip()
    if not reminder_comment:
        reminder_comment = "—"

    return (
        f"🎤 <b>Задача из голосового:</b>\n\n"
        f"📌 {data['title']}\n"
        f"📝 {description}\n"
        f"👤 Исполнитель: {assignee_name}\n"
        f"{prio_emoji} Приоритет: {data.get('priority', 'medium')}\n"
        f"📅 Дедлайн: {deadline_str}\n"
        f"⏰ Напоминание: {reminder_str}\n"
        f"💬 Комментарий к напоминанию: {reminder_comment}"
    )


def _should_process_voice(message: Message) -> bool:
    """Check if voice should be processed in this chat."""
    # Private chat — always process
    if message.chat.type == "private":
        return True
    # Group chat — only in allowed chats
    if message.chat.id in settings.ALLOWED_CHAT_IDS:
        return True
    return False


def _find_assignee_in_team(
    assignee_name: str, team_members: list[TeamMember],
) -> TeamMember | None:
    """Match assignee name from AI against team members (incl. name_variants)."""
    name_lower = assignee_name.lower()
    for m in team_members:
        names_to_check = [m.full_name.lower()]
        if m.name_variants:
            names_to_check.extend(v.lower() for v in m.name_variants)
        if name_lower in names_to_check:
            return m
    return None


# ── Voice message handler ──


@router.message(F.voice | F.video_note)
async def handle_voice(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    if not _should_process_voice(message):
        return

    voice = message.voice or message.video_note

    # Check file size (Whisper limit 25MB, soft limit 20MB)
    if voice.file_size and voice.file_size > 20 * 1024 * 1024:
        await message.reply("❌ Голосовое слишком длинное. Максимум ~10 минут.")
        return

    # Step 1: Download file
    progress_msg = await message.reply("🎤 Распознаю голосовое...")

    try:
        file_info = await bot.get_file(voice.file_id)
        bio = await bot.download_file(file_info.file_path)
        audio_data = bio.read()
    except Exception as e:
        logger.error(f"Failed to download voice: {e}")
        await progress_msg.edit_text("❌ Не удалось скачать голосовое сообщение")
        return

    # Step 2: Transcribe via Whisper
    try:
        text = await voice_service.transcribe(audio_data)
    except Exception as e:
        logger.error(f"Whisper transcription error: {e}")
        await progress_msg.edit_text(
            "❌ Не удалось распознать. Попробуй записать ещё раз, говори чётче."
        )
        return

    if not text or not text.strip():
        await progress_msg.edit_text(
            "❌ Не удалось распознать. Попробуй записать ещё раз, говори чётче."
        )
        return

    await progress_msg.edit_text(f"📝 Распознано: «{text}»\n\n⏳ Извлекаю задачу...")

    # Step 3: AI parse task from text
    can_assign_to_others = PermissionService.can_create_task_for_others(member)

    try:
        async with session_maker() as session:
            team_members = await member_repo.get_all_active(session)
            parsed = await ai_service.parse_task_from_text(
                session,
                text,
                member.full_name,
                can_assign_to_others,
                team_members,
            )
    except Exception as e:
        logger.error(f"AI parse voice task error: {e}")
        await progress_msg.edit_text(
            "❌ Не удалось извлечь задачу. Попробуй сформулировать конкретнее, "
            "например: «Подготовить отчёт до пятницы»"
        )
        return

    if not parsed.title or not parsed.title.strip():
        await progress_msg.edit_text(
            "❌ Не удалось извлечь задачу. Попробуй сформулировать конкретнее, "
            "например: «Подготовить отчёт до пятницы»"
        )
        return

    # Step 4: Resolve assignee
    assignee_id = None
    assignee_display_name = None

    if can_assign_to_others and parsed.assignee_name:
        # Try to find in team members
        async with session_maker() as session:
            team_members = await member_repo.get_all_active(session)
        matched = _find_assignee_in_team(parsed.assignee_name, team_members)
        if matched:
            assignee_id = str(matched.id)
            assignee_display_name = matched.full_name

    # No match or no assignment right: keep assignee as author.
    if not assignee_id:
        assignee_id = str(member.id)
        assignee_display_name = member.full_name

    # Store in FSM
    task_data = {
        "title": parsed.title,
        "description": parsed.description,
        "priority": parsed.priority,
        "deadline": parsed.deadline,
        "reminder_at": parsed.reminder_at,
        "reminder_comment": parsed.reminder_comment,
        "assignee_id": assignee_id,
        "assignee_display_name": assignee_display_name,
        "original_text": text,
    }

    await state.set_state(VoiceTaskFSM.preview)
    await state.update_data(**task_data)

    # Show preview
    preview_text = _format_voice_preview(task_data)
    await progress_msg.edit_text(
        preview_text,
        parse_mode="HTML",
        reply_markup=voice_task_confirm_keyboard(),
    )


# ── Create task from voice ──


@router.callback_query(VoiceTaskFSM.preview, F.data == "voice_create")
async def cb_voice_create(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    data = await state.get_data()
    await callback.answer()
    await callback.message.edit_reply_markup(reply_markup=None)

    # Parse deadline
    deadline = None
    if data.get("deadline"):
        try:
            deadline = date.fromisoformat(data["deadline"])
        except (ValueError, TypeError):
            pass

    # Build description with original voice text
    description = f"🎤 Из голосового: {data['original_text']}"
    if data.get("description"):
        description = f"{data['description']}\n\n{description}"

    reminder_at = _parse_ai_reminder_datetime(data.get("reminder_at"))
    reminder_comment_raw = data.get("reminder_comment")
    reminder_comment = (
        reminder_comment_raw.strip() if isinstance(reminder_comment_raw, str) else None
    )
    if reminder_comment == "":
        reminder_comment = None
    if reminder_at is None:
        reminder_comment = None

    assignee_uuid = uuid.UUID(data["assignee_id"]) if data.get("assignee_id") else None

    try:
        async with session_maker() as session:
            async with session.begin():
                task = await task_service.create_task(
                    session,
                    title=data["title"],
                    creator=member,
                    assignee_id=assignee_uuid,
                    description=description,
                    priority=data.get("priority", "medium"),
                    deadline=deadline,
                    reminder_at=reminder_at,
                    reminder_comment=reminder_comment,
                    source="voice",
                )

                notification_service = NotificationService(bot)
                await notification_service.notify_task_created(session, task, member)
    except Exception as e:
        logger.error(f"Failed to create voice task: {e}", exc_info=True)
        await state.clear()
        await callback.message.answer(
            "❌ Ошибка создания задачи. Попробуйте ещё раз."
        )
        return

    await state.clear()

    assignee_name = task.assignee.full_name if task.assignee else "—"
    prio = PRIORITY_EMOJI.get(task.priority, "🔵")
    deadline_str = (
        f"\n📅 Дедлайн: {task.deadline.strftime('%d.%m.%Y')}" if task.deadline else ""
    )
    if task.reminder_at:
        try:
            tz = ZoneInfo(settings.TIMEZONE)
        except Exception:
            tz = ZoneInfo("Europe/Moscow")
        reminder_local = task.reminder_at.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz)
        reminder_str = f"\n⏰ Напоминание: {reminder_local.strftime('%d.%m.%Y %H:%M')}"
    else:
        reminder_str = ""

    await callback.message.answer(
        f"✅ Задача #{task.short_id} создана из голосового!\n\n"
        f"📌 {task.title}\n"
        f"👤 Исполнитель: {assignee_name}\n"
        f"{prio} {task.priority}{deadline_str}{reminder_str}",
    )


# ── Edit voice task ──


@router.callback_query(VoiceTaskFSM.preview, F.data == "voice_edit")
async def cb_voice_edit(
    callback: CallbackQuery,
    member: TeamMember,
    state: FSMContext,
) -> None:
    await callback.answer()
    await callback.message.edit_reply_markup(
        reply_markup=voice_edit_fields_keyboard(
            can_assign_to_others=PermissionService.can_create_task_for_others(member),
        )
    )


@router.callback_query(VoiceTaskFSM.preview, F.data.startswith("voice_field:"))
async def cb_voice_select_field(
    callback: CallbackQuery,
    member: TeamMember,
    state: FSMContext,
    session_maker: async_sessionmaker,
) -> None:
    field = callback.data.split(":")[1]

    if field == "assignee":
        if not PermissionService.can_create_task_for_others(member):
            await callback.answer("⛔ У вас нет прав менять исполнителя", show_alert=True)
            return

        async with session_maker() as session:
            team_members = await member_repo.get_all_active(session)

        if not team_members:
            await callback.answer("Нет активных участников для назначения", show_alert=True)
            return

        data = await state.get_data()

        await callback.answer()
        await callback.message.edit_reply_markup(
            reply_markup=voice_assignee_keyboard(
                team_members,
                current_assignee_id=data.get("assignee_id"),
            )
        )
        return

    await state.set_state(VoiceTaskFSM.editing_field)
    await state.update_data(editing_field=field)

    field_labels = {
        "title": "📌 Введи новое название задачи:",
        "priority": "⚡ Введи приоритет (low, medium, high, urgent):",
        "deadline": "📅 Введи дедлайн (ДД.ММ.ГГГГ или ДД.ММ):",
        "description": "📝 Введи описание задачи:",
    }

    await callback.answer()
    await callback.message.edit_text(
        field_labels.get(field, "Введи новое значение:") + "\n\nДля отмены: /cancel",
    )


@router.callback_query(VoiceTaskFSM.preview, F.data.startswith("voice_assignee:"))
async def cb_voice_select_assignee(
    callback: CallbackQuery,
    member: TeamMember,
    state: FSMContext,
    session_maker: async_sessionmaker,
) -> None:
    if not PermissionService.can_create_task_for_others(member):
        await callback.answer("⛔ У вас нет прав менять исполнителя", show_alert=True)
        return

    assignee_id_raw = callback.data.split(":")[1]
    try:
        assignee_id = uuid.UUID(assignee_id_raw)
    except ValueError:
        await callback.answer("Некорректный исполнитель", show_alert=True)
        return

    async with session_maker() as session:
        assignee = await member_repo.get_by_id(session, assignee_id)

    if not assignee or not assignee.is_active:
        await callback.answer("Исполнитель не найден или неактивен", show_alert=True)
        return

    await state.update_data(
        assignee_id=str(assignee.id),
        assignee_display_name=assignee.full_name,
    )

    updated_data = await state.get_data()
    preview_text = _format_voice_preview(updated_data)

    await callback.answer("Исполнитель обновлён")
    await callback.message.edit_text(
        preview_text,
        parse_mode="HTML",
        reply_markup=voice_task_confirm_keyboard(),
    )


@router.callback_query(VoiceTaskFSM.preview, F.data == "voice_back_fields")
async def cb_voice_back_fields(
    callback: CallbackQuery,
    member: TeamMember,
) -> None:
    await callback.answer()
    await callback.message.edit_reply_markup(
        reply_markup=voice_edit_fields_keyboard(
            can_assign_to_others=PermissionService.can_create_task_for_others(member),
        )
    )


@router.callback_query(VoiceTaskFSM.preview, F.data == "voice_back_preview")
async def cb_voice_back_preview(
    callback: CallbackQuery,
    state: FSMContext,
) -> None:
    data = await state.get_data()
    await callback.answer()
    preview_text = _format_voice_preview(data)
    await callback.message.edit_text(
        preview_text,
        parse_mode="HTML",
        reply_markup=voice_task_confirm_keyboard(),
    )


# ── FSM: editing field value ──


@router.message(VoiceTaskFSM.editing_field, Command("cancel"))
async def fsm_voice_cancel_edit(
    message: Message,
    state: FSMContext,
) -> None:
    data = await state.get_data()
    await state.set_state(VoiceTaskFSM.preview)
    await state.update_data(editing_field=None)

    preview_text = _format_voice_preview(data)
    await message.answer(
        preview_text,
        parse_mode="HTML",
        reply_markup=voice_task_confirm_keyboard(),
    )


@router.message(VoiceTaskFSM.editing_field)
async def fsm_voice_edit_value(
    message: Message,
    state: FSMContext,
) -> None:
    data = await state.get_data()
    field = data.get("editing_field")
    value = message.text.strip() if message.text else ""

    if not value:
        await message.answer("❌ Значение не может быть пустым. Попробуй ещё раз или /cancel")
        return

    if field == "title":
        await state.update_data(title=value)
    elif field == "priority":
        valid = ("low", "medium", "high", "urgent")
        if value.lower() not in valid:
            await message.answer(f"❌ Неверный приоритет. Доступные: {', '.join(valid)}")
            return
        await state.update_data(priority=value.lower())
    elif field == "deadline":
        match = re.match(r"(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$", value)
        if not match:
            await message.answer("❌ Формат: ДД.ММ или ДД.ММ.ГГГГ")
            return
        day, month = int(match.group(1)), int(match.group(2))
        year_str = match.group(3)
        year = int(year_str) if year_str else date.today().year
        if year < 100:
            year += 2000
        try:
            d = date(year, month, day)
            await state.update_data(deadline=d.isoformat())
        except ValueError:
            await message.answer("❌ Некорректная дата")
            return
    elif field == "description":
        await state.update_data(description=value)

    await state.set_state(VoiceTaskFSM.preview)
    await state.update_data(editing_field=None)

    updated_data = await state.get_data()
    preview_text = _format_voice_preview(updated_data)
    await message.answer(
        preview_text,
        parse_mode="HTML",
        reply_markup=voice_task_confirm_keyboard(),
    )


# ── Cancel voice task ──


@router.callback_query(VoiceTaskFSM.preview, F.data == "voice_cancel")
async def cb_voice_cancel(
    callback: CallbackQuery,
    state: FSMContext,
) -> None:
    await state.clear()
    await callback.answer()
    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.answer("❌ Создание задачи отменено")
