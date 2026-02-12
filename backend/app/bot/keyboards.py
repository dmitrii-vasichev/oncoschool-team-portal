import uuid

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def task_actions_keyboard(task_id: int, is_moderator: bool) -> InlineKeyboardMarkup:
    """Inline-кнопки для действий с задачей."""
    buttons = [
        [
            InlineKeyboardButton(text="✅ Done", callback_data=f"task_done:{task_id}"),
            InlineKeyboardButton(text="▶️ В работу", callback_data=f"task_inprogress:{task_id}"),
        ],
        [
            InlineKeyboardButton(text="👀 Ревью", callback_data=f"task_review:{task_id}"),
            InlineKeyboardButton(text="📝 Апдейт", callback_data=f"task_update:{task_id}"),
        ],
    ]
    if is_moderator:
        buttons.append([
            InlineKeyboardButton(text="❌ Отменить", callback_data=f"task_cancel:{task_id}"),
            InlineKeyboardButton(text="🔄 Переназначить", callback_data=f"task_reassign:{task_id}"),
        ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def confirm_keyboard(action: str = "confirm") -> InlineKeyboardMarkup:
    """Клавиатура подтверждения."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Да", callback_data=f"{action}:yes"),
            InlineKeyboardButton(text="❌ Нет", callback_data=f"{action}:no"),
        ]
    ])


def pagination_keyboard(current_page: int, total_pages: int, prefix: str) -> InlineKeyboardMarkup:
    """Клавиатура пагинации."""
    buttons = []
    if current_page > 1:
        buttons.append(
            InlineKeyboardButton(text="⬅️", callback_data=f"{prefix}:page:{current_page - 1}")
        )
    buttons.append(
        InlineKeyboardButton(text=f"{current_page}/{total_pages}", callback_data="noop")
    )
    if current_page < total_pages:
        buttons.append(
            InlineKeyboardButton(text="➡️", callback_data=f"{prefix}:page:{current_page + 1}")
        )
    return InlineKeyboardMarkup(inline_keyboard=[buttons])


def voice_task_confirm_keyboard() -> InlineKeyboardMarkup:
    """Клавиатура подтверждения голосовой задачи."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Создать", callback_data="voice_create"),
            InlineKeyboardButton(text="✏️ Изменить", callback_data="voice_edit"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="voice_cancel"),
        ]
    ])


def voice_edit_fields_keyboard() -> InlineKeyboardMarkup:
    """Клавиатура выбора поля для редактирования голосовой задачи."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📌 Название", callback_data="voice_field:title"),
            InlineKeyboardButton(text="⚡ Приоритет", callback_data="voice_field:priority"),
        ],
        [
            InlineKeyboardButton(text="📅 Дедлайн", callback_data="voice_field:deadline"),
            InlineKeyboardButton(text="📝 Описание", callback_data="voice_field:description"),
        ],
        [
            InlineKeyboardButton(text="↩️ Назад к превью", callback_data="voice_back_preview"),
        ],
    ])


# ── Subscription keyboards ──

EVENT_TYPES = [
    ("task_created", "🆕 Создание задачи"),
    ("task_status_changed", "🔄 Смена статуса"),
    ("task_completed", "✅ Завершение задачи"),
    ("task_overdue", "⏰ Просроченные задачи"),
    ("task_update_added", "📝 Новый апдейт"),
    ("meeting_created", "📋 Новая встреча"),
]


def subscribe_keyboard(active_events: set[str]) -> InlineKeyboardMarkup:
    """Toggle keyboard for notification subscriptions."""
    buttons = []
    for event_type, label in EVENT_TYPES:
        is_on = event_type in active_events
        icon = "✅" if is_on else "❌"
        buttons.append([
            InlineKeyboardButton(
                text=f"{icon} {label}",
                callback_data=f"sub_toggle:{event_type}",
            )
        ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


# ── Reminder keyboards ──


def reminders_member_list_keyboard(
    members: list, page: int = 1, per_page: int = 8
) -> InlineKeyboardMarkup:
    """List of team members for reminder configuration."""
    start = (page - 1) * per_page
    end = start + per_page
    page_members = members[start:end]
    total_pages = max(1, (len(members) + per_page - 1) // per_page)

    buttons = []
    for m in page_members:
        has_reminder = (
            hasattr(m, "reminder_settings")
            and m.reminder_settings
            and m.reminder_settings.is_enabled
        )
        status = "✅" if has_reminder else "❌"
        buttons.append([
            InlineKeyboardButton(
                text=f"{status} {m.full_name}",
                callback_data=f"rem_member:{m.id}",
            )
        ])

    # Bulk actions
    buttons.append([
        InlineKeyboardButton(text="📢 Включить всем", callback_data="rem_bulk_enable"),
        InlineKeyboardButton(text="🔇 Выключить всем", callback_data="rem_bulk_disable"),
    ])

    # Pagination
    if total_pages > 1:
        nav = []
        if page > 1:
            nav.append(InlineKeyboardButton(text="⬅️", callback_data=f"rem_page:{page - 1}"))
        nav.append(InlineKeyboardButton(text=f"{page}/{total_pages}", callback_data="noop"))
        if page < total_pages:
            nav.append(InlineKeyboardButton(text="➡️", callback_data=f"rem_page:{page + 1}"))
        buttons.append(nav)

    return InlineKeyboardMarkup(inline_keyboard=buttons)


def reminder_member_settings_keyboard(
    member_id: str, is_enabled: bool
) -> InlineKeyboardMarkup:
    """Settings for a specific member's reminder."""
    toggle_text = "🔇 Выключить" if is_enabled else "🔔 Включить"
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text=toggle_text, callback_data=f"rem_toggle:{member_id}"
            ),
            InlineKeyboardButton(
                text="⏰ Время", callback_data=f"rem_time:{member_id}"
            ),
        ],
        [
            InlineKeyboardButton(
                text="📅 Дни недели", callback_data=f"rem_days:{member_id}"
            ),
        ],
        [
            InlineKeyboardButton(text="↩️ Назад к списку", callback_data="rem_back_list"),
        ],
    ])


# ── AI model keyboards ──


def ai_provider_keyboard(
    current_provider: str, available_providers: dict[str, bool]
) -> InlineKeyboardMarkup:
    """Select AI provider."""
    provider_names = {
        "anthropic": "Anthropic",
        "openai": "OpenAI",
        "gemini": "Gemini",
    }
    buttons = []
    for key, display_name in provider_names.items():
        is_current = key == current_provider
        is_available = key in available_providers
        if is_current:
            text = f"✅ {display_name}"
        elif is_available:
            text = f"⬜ {display_name}"
        else:
            text = f"🚫 {display_name} (нет ключа)"
        buttons.append(
            InlineKeyboardButton(
                text=text,
                callback_data=f"ai_provider:{key}" if is_available else "noop",
            )
        )
    return InlineKeyboardMarkup(inline_keyboard=[buttons])


def ai_model_keyboard(
    provider: str, models: list[str], current_model: str
) -> InlineKeyboardMarkup:
    """Select AI model for a given provider."""
    buttons = []
    for model in models:
        is_current = model == current_model
        icon = "✅" if is_current else "⬜"
        buttons.append([
            InlineKeyboardButton(
                text=f"{icon} {model}",
                callback_data=f"ai_model:{provider}:{model}",
            )
        ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
