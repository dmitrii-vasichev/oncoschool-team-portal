import logging

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db.models import TeamMember
from app.db.repositories import TeamMemberRepository
from app.bot.filters import IsModeratorFilter
from app.services.ai_service import AIService
from app.services.meeting_service import MeetingService
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

router = Router()

ai_service = AIService()
meeting_service = MeetingService()
member_repo = TeamMemberRepository()


class SummaryFSM(StatesGroup):
    waiting_for_text = State()
    preview = State()


PRIORITY_EMOJI = {
    "urgent": "🔴",
    "high": "🟠",
    "medium": "🟡",
    "low": "🟢",
}


def _format_preview(parsed, provider_info: dict) -> str:
    """Format parsed meeting for preview message."""
    lines = [
        f"<b>📋 Результат парсинга</b>",
        f"<i>Обработано через: {provider_info['provider']} ({provider_info['model']})</i>\n",
        f"<b>📌 {parsed.title}</b>\n",
        f"<b>📝 Резюме:</b>\n{parsed.summary}\n",
    ]

    if parsed.decisions:
        lines.append("<b>✅ Решения:</b>")
        for i, d in enumerate(parsed.decisions, 1):
            lines.append(f"  {i}. {d}")
        lines.append("")

    if parsed.participants:
        lines.append(f"<b>👥 Участники:</b> {', '.join(parsed.participants)}\n")

    if parsed.tasks:
        lines.append(f"<b>📊 Задачи ({len(parsed.tasks)}):</b>")
        for i, t in enumerate(parsed.tasks, 1):
            prio_emoji = PRIORITY_EMOJI.get(t.priority, "⚪")
            assignee_str = t.assignee_name or "не назначен"
            deadline_str = f" · 📅 {t.deadline}" if t.deadline else ""
            lines.append(
                f"  {i}. {prio_emoji} {t.title}\n"
                f"     👤 {assignee_str}{deadline_str}"
            )
    else:
        lines.append("<b>📊 Задачи:</b> не найдены")

    return "\n".join(lines)


def _summary_confirm_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Создать встречу и задачи", callback_data="summary_confirm"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="summary_cancel"),
        ]
    ])


# ── /summary — moderator only ──


@router.message(Command("summary"), IsModeratorFilter())
async def cmd_summary(message: Message, state: FSMContext) -> None:
    await state.set_state(SummaryFSM.waiting_for_text)
    await message.answer(
        "📋 <b>Парсинг Zoom AI Summary</b>\n\n"
        "Отправь мне текст Zoom AI Summary, и я извлеку:\n"
        "• Название и резюме встречи\n"
        "• Принятые решения\n"
        "• Задачи с исполнителями\n\n"
        "Для отмены отправь /cancel",
        parse_mode="HTML",
    )


@router.message(SummaryFSM.waiting_for_text, Command("cancel"))
async def fsm_cancel(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Парсинг отменён")


@router.message(SummaryFSM.waiting_for_text)
async def fsm_receive_summary_text(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    state: FSMContext,
) -> None:
    raw_text = message.text
    if not raw_text or len(raw_text.strip()) < 50:
        await message.answer(
            "❌ Текст слишком короткий. Отправь полный Zoom AI Summary.\n"
            "Для отмены: /cancel"
        )
        return

    raw_text = raw_text.strip()

    progress_msg = await message.answer("⏳ Обрабатываю summary через AI...")

    try:
        async with session_maker() as session:
            # Get team members for name matching
            team_members = await member_repo.get_all_active(session)

            # Parse via AI
            parsed = await ai_service.parse_meeting_summary(
                session, raw_text, team_members
            )

            # Get provider info for display
            provider_info = await ai_service.get_current_provider_info(session)

    except ValueError as e:
        await progress_msg.delete()
        await message.answer(
            f"❌ Ошибка парсинга: {e}\n\n"
            "Попробуй ещё раз или отправь /cancel"
        )
        return
    except Exception as e:
        logger.error(f"AI parsing error: {e}")
        await progress_msg.delete()
        await message.answer(
            "❌ Ошибка при обращении к AI. Попробуй ещё раз или отправь /cancel"
        )
        return

    # Store parsed data and raw text in FSM
    await state.set_state(SummaryFSM.preview)
    await state.update_data(
        raw_summary=raw_text,
        parsed_title=parsed.title,
        parsed_summary=parsed.summary,
        decisions=parsed.decisions,
        participants=parsed.participants,
        tasks=[t.model_dump() for t in parsed.tasks],
    )

    await progress_msg.delete()

    preview_text = _format_preview(parsed, provider_info)

    # Telegram messages have 4096 char limit
    if len(preview_text) > 4000:
        # Send in chunks
        await message.answer(preview_text[:4000], parse_mode="HTML")
        await message.answer(
            preview_text[4000:] + "\n\nСоздать встречу и задачи?",
            parse_mode="HTML",
            reply_markup=_summary_confirm_keyboard(),
        )
    else:
        await message.answer(
            preview_text,
            parse_mode="HTML",
            reply_markup=_summary_confirm_keyboard(),
        )


# ── Confirm/Cancel callbacks ──


@router.callback_query(SummaryFSM.preview, F.data == "summary_confirm")
async def cb_summary_confirm(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    data = await state.get_data()

    await callback.answer()
    await callback.message.edit_reply_markup(reply_markup=None)

    progress_msg = await callback.message.answer("⏳ Создаю встречу и задачи...")

    try:
        async with session_maker() as session:
            async with session.begin():
                team_members = await member_repo.get_all_active(session)

                # Create meeting
                meeting = await meeting_service.create_meeting_from_parsed(
                    session,
                    raw_summary=data["raw_summary"],
                    parsed_title=data["parsed_title"],
                    parsed_summary=data["parsed_summary"],
                    decisions=data["decisions"],
                    participant_names=data["participants"],
                    creator=member,
                )

                # Create tasks
                tasks = await meeting_service.create_tasks_from_parsed(
                    session,
                    meeting=meeting,
                    parsed_tasks=data["tasks"],
                    creator=member,
                    team_members=team_members,
                )

                # Notify subscribers
                notification_service = NotificationService(bot)
                await notification_service.notify_meeting_created(
                    session, meeting, member, len(tasks)
                )

                # Notify assignees about new tasks
                for task in tasks:
                    await notification_service.notify_task_created(session, task, member)

    except Exception as e:
        logger.error(f"Failed to create meeting from summary: {e}")
        await progress_msg.delete()
        await callback.message.answer(f"❌ Ошибка при создании: {e}")
        await state.clear()
        return

    await state.clear()
    await progress_msg.delete()

    # Build result message
    task_lines = []
    for task in tasks:
        assignee_name = task.assignee.full_name if task.assignee else "—"
        task_lines.append(f"  #{task.short_id} · {task.title} · 👤 {assignee_name}")

    tasks_text = "\n".join(task_lines) if task_lines else "  (нет задач)"

    await callback.message.answer(
        f"✅ <b>Встреча создана!</b>\n\n"
        f"📌 {data['parsed_title']}\n"
        f"📊 Задач создано: {len(tasks)}\n\n"
        f"<b>Задачи:</b>\n{tasks_text}",
        parse_mode="HTML",
    )


@router.callback_query(SummaryFSM.preview, F.data == "summary_cancel")
async def cb_summary_cancel(
    callback: CallbackQuery, state: FSMContext
) -> None:
    await state.clear()
    await callback.answer()
    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.answer("❌ Создание встречи отменено")
