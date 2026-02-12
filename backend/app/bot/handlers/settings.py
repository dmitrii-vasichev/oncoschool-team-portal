import logging
import uuid
from datetime import time

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.bot.filters import IsModeratorFilter
from app.bot.keyboards import (
    EVENT_TYPES,
    ai_model_keyboard,
    ai_provider_keyboard,
    reminder_member_settings_keyboard,
    reminders_member_list_keyboard,
    subscribe_keyboard,
)
from app.db.models import TeamMember
from app.db.repositories import (
    AppSettingsRepository,
    NotificationSubscriptionRepository,
    ReminderSettingsRepository,
    TeamMemberRepository,
)
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

router = Router()

DAYS_RU = {1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 7: "Вс"}


class ReminderFSM(StatesGroup):
    waiting_time = State()
    waiting_days = State()


# ══════════════════════════════════════════
#  /subscribe — moderator subscription toggles
# ══════════════════════════════════════════


@router.message(Command("subscribe"), IsModeratorFilter())
async def cmd_subscribe(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    sub_repo = NotificationSubscriptionRepository()
    async with session_maker() as session:
        subs = await sub_repo.get_by_member(session, member.id)

    active_events = {s.event_type for s in subs if s.is_active}
    await message.answer(
        "🔔 <b>Подписки на уведомления</b>\n\n"
        "Нажми, чтобы включить/выключить:",
        parse_mode="HTML",
        reply_markup=subscribe_keyboard(active_events),
    )


@router.callback_query(F.data.startswith("sub_toggle:"))
async def cb_subscribe_toggle(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    from app.services.permission_service import PermissionService

    if not PermissionService.can_subscribe_notifications(member):
        await callback.answer("Только модератор может управлять подписками", show_alert=True)
        return

    event_type = callback.data.split(":", 1)[1]
    sub_repo = NotificationSubscriptionRepository()

    async with session_maker() as session:
        async with session.begin():
            # Get current state
            subs = await sub_repo.get_by_member(session, member.id)
            current = {s.event_type: s.is_active for s in subs}
            new_state = not current.get(event_type, False)
            await sub_repo.upsert(session, member.id, event_type, new_state)

        # Refresh for keyboard
        subs = await sub_repo.get_by_member(session, member.id)

    active_events = {s.event_type for s in subs if s.is_active}
    await callback.message.edit_reply_markup(
        reply_markup=subscribe_keyboard(active_events)
    )
    status = "включено" if new_state else "выключено"
    event_label = dict(EVENT_TYPES).get(event_type, event_type)
    await callback.answer(f"{event_label}: {status}")


# ══════════════════════════════════════════
#  /reminders — moderator configures digests
# ══════════════════════════════════════════


@router.message(Command("reminders"), IsModeratorFilter())
async def cmd_reminders(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    member_repo = TeamMemberRepository()
    async with session_maker() as session:
        stmt = (
            select(TeamMember)
            .options(selectinload(TeamMember.reminder_settings))
            .where(TeamMember.is_active.is_(True))
            .order_by(TeamMember.full_name)
        )
        result = await session.execute(stmt)
        members = list(result.scalars().all())

    await message.answer(
        "⏰ <b>Настройка напоминаний</b>\n\n"
        "Выбери участника для настройки дайджеста\n"
        "✅ — напоминание включено, ❌ — выключено",
        parse_mode="HTML",
        reply_markup=reminders_member_list_keyboard(members),
    )


@router.callback_query(F.data.startswith("rem_page:"))
async def cb_reminders_page(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    page = int(callback.data.split(":")[1])
    member_repo = TeamMemberRepository()

    async with session_maker() as session:
        stmt = (
            select(TeamMember)
            .options(selectinload(TeamMember.reminder_settings))
            .where(TeamMember.is_active.is_(True))
            .order_by(TeamMember.full_name)
        )
        result = await session.execute(stmt)
        members = list(result.scalars().all())

    await callback.message.edit_reply_markup(
        reply_markup=reminders_member_list_keyboard(members, page=page)
    )
    await callback.answer()


@router.callback_query(F.data.startswith("rem_member:"))
async def cb_reminder_member(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    target_id = callback.data.split(":", 1)[1]
    reminder_repo = ReminderSettingsRepository()
    member_repo = TeamMemberRepository()

    async with session_maker() as session:
        target = await member_repo.get_by_id(session, uuid.UUID(target_id))
        if not target:
            await callback.answer("Участник не найден", show_alert=True)
            return
        rs = await reminder_repo.get_by_member(session, target.id)

    is_enabled = rs.is_enabled if rs else False
    reminder_time = rs.reminder_time if rs else time(9, 0)
    days = rs.days_of_week if rs else [1, 2, 3, 4, 5]
    days_str = ", ".join(DAYS_RU.get(d, str(d)) for d in sorted(days))

    text = (
        f"⏰ <b>Напоминание: {target.full_name}</b>\n\n"
        f"Статус: {'🔔 Включено' if is_enabled else '🔇 Выключено'}\n"
        f"Время: {reminder_time.strftime('%H:%M')}\n"
        f"Дни: {days_str}\n"
    )
    await callback.message.edit_text(
        text,
        parse_mode="HTML",
        reply_markup=reminder_member_settings_keyboard(target_id, is_enabled),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("rem_toggle:"))
async def cb_reminder_toggle(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    target_id = callback.data.split(":", 1)[1]
    reminder_repo = ReminderSettingsRepository()

    async with session_maker() as session:
        async with session.begin():
            rs = await reminder_repo.get_by_member(session, uuid.UUID(target_id))
            new_state = not (rs.is_enabled if rs else False)
            await reminder_repo.upsert(
                session,
                uuid.UUID(target_id),
                is_enabled=new_state,
                configured_by_id=member.id,
            )

        # Refresh
        rs = await reminder_repo.get_by_member(session, uuid.UUID(target_id))
        member_repo = TeamMemberRepository()
        target = await member_repo.get_by_id(session, uuid.UUID(target_id))

    is_enabled = rs.is_enabled if rs else False
    reminder_time = rs.reminder_time if rs else time(9, 0)
    days = rs.days_of_week if rs else [1, 2, 3, 4, 5]
    days_str = ", ".join(DAYS_RU.get(d, str(d)) for d in sorted(days))
    target_name = target.full_name if target else "?"

    text = (
        f"⏰ <b>Напоминание: {target_name}</b>\n\n"
        f"Статус: {'🔔 Включено' if is_enabled else '🔇 Выключено'}\n"
        f"Время: {reminder_time.strftime('%H:%M')}\n"
        f"Дни: {days_str}\n"
    )
    await callback.message.edit_text(
        text,
        parse_mode="HTML",
        reply_markup=reminder_member_settings_keyboard(target_id, is_enabled),
    )
    await callback.answer("Включено" if new_state else "Выключено")


@router.callback_query(F.data.startswith("rem_time:"))
async def cb_reminder_time(
    callback: CallbackQuery,
    member: TeamMember,
    state: FSMContext,
) -> None:
    target_id = callback.data.split(":", 1)[1]
    await state.set_state(ReminderFSM.waiting_time)
    await state.update_data(rem_target_id=target_id)
    await callback.message.answer(
        "⏰ Введи время напоминания в формате ЧЧ:ММ (например, 09:00):"
    )
    await callback.answer()


@router.message(ReminderFSM.waiting_time)
async def fsm_reminder_time(
    message: Message,
    member: TeamMember,
    state: FSMContext,
    session_maker: async_sessionmaker,
) -> None:
    data = await state.get_data()
    target_id = data.get("rem_target_id")
    await state.clear()

    text = message.text.strip()
    try:
        parts = text.split(":")
        h, m = int(parts[0]), int(parts[1])
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError
        new_time = time(h, m)
    except (ValueError, IndexError):
        await message.answer("❌ Неверный формат. Используй ЧЧ:ММ (например, 09:00)")
        return

    reminder_repo = ReminderSettingsRepository()
    async with session_maker() as session:
        async with session.begin():
            await reminder_repo.upsert(
                session,
                uuid.UUID(target_id),
                reminder_time=new_time,
                configured_by_id=member.id,
            )

    await message.answer(f"✅ Время напоминания установлено: {new_time.strftime('%H:%M')}")


@router.callback_query(F.data.startswith("rem_days:"))
async def cb_reminder_days(
    callback: CallbackQuery,
    member: TeamMember,
    state: FSMContext,
) -> None:
    target_id = callback.data.split(":", 1)[1]
    await state.set_state(ReminderFSM.waiting_days)
    await state.update_data(rem_target_id=target_id)
    await callback.message.answer(
        "📅 Введи дни недели цифрами через запятую:\n"
        "1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб, 7=Вс\n\n"
        "Например: 1,2,3,4,5 (будни)"
    )
    await callback.answer()


@router.message(ReminderFSM.waiting_days)
async def fsm_reminder_days(
    message: Message,
    member: TeamMember,
    state: FSMContext,
    session_maker: async_sessionmaker,
) -> None:
    data = await state.get_data()
    target_id = data.get("rem_target_id")
    await state.clear()

    text = message.text.strip()
    try:
        days = [int(d.strip()) for d in text.split(",")]
        if not all(1 <= d <= 7 for d in days):
            raise ValueError
    except (ValueError, AttributeError):
        await message.answer("❌ Неверный формат. Используй цифры 1-7 через запятую")
        return

    days = sorted(set(days))
    reminder_repo = ReminderSettingsRepository()

    async with session_maker() as session:
        async with session.begin():
            await reminder_repo.upsert(
                session,
                uuid.UUID(target_id),
                days_of_week=days,
                configured_by_id=member.id,
            )

    days_str = ", ".join(DAYS_RU.get(d, str(d)) for d in days)
    await message.answer(f"✅ Дни напоминания: {days_str}")


@router.callback_query(F.data == "rem_back_list")
async def cb_reminder_back_list(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    async with session_maker() as session:
        stmt = (
            select(TeamMember)
            .options(selectinload(TeamMember.reminder_settings))
            .where(TeamMember.is_active.is_(True))
            .order_by(TeamMember.full_name)
        )
        result = await session.execute(stmt)
        members = list(result.scalars().all())

    await callback.message.edit_text(
        "⏰ <b>Настройка напоминаний</b>\n\n"
        "Выбери участника для настройки дайджеста\n"
        "✅ — напоминание включено, ❌ — выключено",
        parse_mode="HTML",
        reply_markup=reminders_member_list_keyboard(members),
    )
    await callback.answer()


@router.callback_query(F.data == "rem_bulk_enable")
async def cb_reminder_bulk_enable(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    member_repo = TeamMemberRepository()
    reminder_repo = ReminderSettingsRepository()

    async with session_maker() as session:
        async with session.begin():
            all_members = await member_repo.get_all_active(session)
            for m in all_members:
                await reminder_repo.upsert(
                    session, m.id, is_enabled=True, configured_by_id=member.id
                )

        # Refresh for keyboard
        stmt = (
            select(TeamMember)
            .options(selectinload(TeamMember.reminder_settings))
            .where(TeamMember.is_active.is_(True))
            .order_by(TeamMember.full_name)
        )
        result = await session.execute(stmt)
        members = list(result.scalars().all())

    await callback.message.edit_reply_markup(
        reply_markup=reminders_member_list_keyboard(members)
    )
    await callback.answer("Напоминания включены для всех")


@router.callback_query(F.data == "rem_bulk_disable")
async def cb_reminder_bulk_disable(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    member_repo = TeamMemberRepository()
    reminder_repo = ReminderSettingsRepository()

    async with session_maker() as session:
        async with session.begin():
            all_members = await member_repo.get_all_active(session)
            for m in all_members:
                await reminder_repo.upsert(
                    session, m.id, is_enabled=False, configured_by_id=member.id
                )

        stmt = (
            select(TeamMember)
            .options(selectinload(TeamMember.reminder_settings))
            .where(TeamMember.is_active.is_(True))
            .order_by(TeamMember.full_name)
        )
        result = await session.execute(stmt)
        members = list(result.scalars().all())

    await callback.message.edit_reply_markup(
        reply_markup=reminders_member_list_keyboard(members)
    )
    await callback.answer("Напоминания выключены для всех")


# ══════════════════════════════════════════
#  /myreminder — member views own settings
# ══════════════════════════════════════════


@router.message(Command("myreminder"))
async def cmd_myreminder(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    reminder_repo = ReminderSettingsRepository()
    async with session_maker() as session:
        rs = await reminder_repo.get_by_member(session, member.id)

    if not rs or not rs.is_enabled:
        await message.answer(
            "⏰ <b>Мои напоминания</b>\n\n"
            "Статус: 🔇 Выключено\n\n"
            "Обратись к модератору для настройки.",
            parse_mode="HTML",
        )
        return

    days = rs.days_of_week or [1, 2, 3, 4, 5]
    days_str = ", ".join(DAYS_RU.get(d, str(d)) for d in sorted(days))
    includes = []
    if rs.include_overdue:
        includes.append("просроченные")
    if rs.include_upcoming:
        includes.append("ближайшие (3 дня)")
    if rs.include_in_progress:
        includes.append("в работе")
    includes_str = ", ".join(includes) if includes else "—"

    await message.answer(
        f"⏰ <b>Мои напоминания</b>\n\n"
        f"Статус: 🔔 Включено\n"
        f"Время: {rs.reminder_time.strftime('%H:%M')}\n"
        f"Дни: {days_str}\n"
        f"Включает: {includes_str}",
        parse_mode="HTML",
    )


# ══════════════════════════════════════════
#  /aimodel — moderator changes AI provider
# ══════════════════════════════════════════


@router.message(Command("aimodel"), IsModeratorFilter())
async def cmd_aimodel(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    ai_service = AIService()
    settings_repo = AppSettingsRepository()

    async with session_maker() as session:
        info = await ai_service.get_current_provider_info(session)

    provider_display = {
        "anthropic": "Anthropic",
        "openai": "OpenAI",
        "gemini": "Gemini",
    }
    provider_name = provider_display.get(info["provider"], info["provider"])
    available = ai_service.get_available_providers()

    await message.answer(
        f"🤖 <b>Текущая AI-модель</b>\n\n"
        f"Провайдер: {provider_name}\n"
        f"Модель: <code>{info['model']}</code>\n\n"
        f"Выбери провайдер:",
        parse_mode="HTML",
        reply_markup=ai_provider_keyboard(info["provider"], available),
    )


@router.callback_query(F.data.startswith("ai_provider:"))
async def cb_ai_provider(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    from app.services.permission_service import PermissionService

    if not PermissionService.can_change_ai_settings(member):
        await callback.answer("Только модератор может менять AI-модель", show_alert=True)
        return

    provider = callback.data.split(":", 1)[1]
    settings_repo = AppSettingsRepository()

    async with session_maker() as session:
        # Get available models for this provider
        config = await settings_repo.get(session, "ai_providers_config")
        current = await settings_repo.get(session, "ai_provider")

    if not config or provider not in config.value:
        await callback.answer("Провайдер не найден в конфигурации", show_alert=True)
        return

    provider_config = config.value[provider]
    models = provider_config.get("models", [])
    current_model = current.value.get("model", "") if current else ""

    # If switching provider, preselect the default model
    if current and current.value.get("provider") != provider:
        current_model = provider_config.get("default", models[0] if models else "")

    provider_display = {"anthropic": "Anthropic", "openai": "OpenAI", "gemini": "Gemini"}

    await callback.message.edit_text(
        f"🤖 <b>Выбери модель для {provider_display.get(provider, provider)}:</b>",
        parse_mode="HTML",
        reply_markup=ai_model_keyboard(provider, models, current_model),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("ai_model:"))
async def cb_ai_model(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    from app.services.permission_service import PermissionService

    if not PermissionService.can_change_ai_settings(member):
        await callback.answer("Только модератор может менять AI-модель", show_alert=True)
        return

    parts = callback.data.split(":", 2)
    provider = parts[1]
    model = parts[2]

    settings_repo = AppSettingsRepository()
    ai_service = AIService()

    # Verify provider is available
    available = ai_service.get_available_providers()
    if provider not in available:
        await callback.answer(
            f"Провайдер {provider} недоступен (нет API ключа)", show_alert=True
        )
        return

    async with session_maker() as session:
        async with session.begin():
            await settings_repo.set(
                session,
                "ai_provider",
                {"provider": provider, "model": model},
                updated_by_id=member.id,
            )

    provider_display = {"anthropic": "Anthropic", "openai": "OpenAI", "gemini": "Gemini"}

    await callback.message.edit_text(
        f"✅ AI-модель изменена!\n\n"
        f"Провайдер: {provider_display.get(provider, provider)}\n"
        f"Модель: {model}"
    )
    await callback.answer("Модель сохранена")
