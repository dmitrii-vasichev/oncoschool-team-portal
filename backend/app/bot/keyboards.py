from datetime import date
from typing import Protocol, Sequence

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from app.bot.callbacks import (
    TaskBackToListCallback,
    TaskCardCallback,
    TaskListCallback,
    TaskListFilter,
    TaskListScope,
    TaskRefreshListCallback,
)


class TaskListItem(Protocol):
    short_id: int
    title: str
    priority: str
    deadline: date | None


TASK_FILTER_LABELS: dict[TaskListFilter, str] = {
    TaskListFilter.ALL: "Все",
    TaskListFilter.OVERDUE: "Просроченные",
    TaskListFilter.ACTIVE: "Активные",
    TaskListFilter.NEW: "Новые",
    TaskListFilter.IN_PROGRESS: "В работе",
    TaskListFilter.REVIEW: "Ревью",
    TaskListFilter.DONE: "Готово",
    TaskListFilter.CANCELLED: "Отменено",
}


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


def task_filters_keyboard(
    scope: TaskListScope,
    current_filter: TaskListFilter,
    page: int = 1,
) -> InlineKeyboardMarkup:
    """Inline-фильтры списка задач для Telegram UI."""
    buttons: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    filter_order = (
        TaskListFilter.ALL,
        TaskListFilter.NEW,
        TaskListFilter.IN_PROGRESS,
        TaskListFilter.REVIEW,
        TaskListFilter.OVERDUE,
    )

    for filter_value in filter_order:
        label = TASK_FILTER_LABELS[filter_value]
        text = f"✅ {label}" if filter_value == current_filter else label
        row.append(
            InlineKeyboardButton(
                text=text,
                callback_data=TaskListCallback(
                    scope=scope,
                    task_filter=filter_value,
                    page=1,
                ).pack(),
            )
        )
        if len(row) == 2:
            buttons.append(row)
            row = []

    if row:
        buttons.append(row)

    buttons.append([
        InlineKeyboardButton(
            text="🔄 Обновить",
            callback_data=TaskRefreshListCallback(
                scope=scope,
                task_filter=current_filter,
                page=page,
            ).pack(),
        )
    ])

    return InlineKeyboardMarkup(inline_keyboard=buttons)


def task_pagination_keyboard(
    scope: TaskListScope,
    current_filter: TaskListFilter,
    page: int,
    total_pages: int,
) -> InlineKeyboardMarkup:
    """Пагинация списка задач с typed callback schema."""
    safe_page = max(1, page)
    safe_total = max(1, total_pages)

    nav_row: list[InlineKeyboardButton] = []
    if safe_page > 1:
        nav_row.append(
            InlineKeyboardButton(
                text="⬅️",
                callback_data=TaskListCallback(
                    scope=scope,
                    task_filter=current_filter,
                    page=safe_page - 1,
                ).pack(),
            )
        )

    nav_row.append(InlineKeyboardButton(text=f"{safe_page}/{safe_total}", callback_data="noop"))

    if safe_page < safe_total:
        nav_row.append(
            InlineKeyboardButton(
                text="➡️",
                callback_data=TaskListCallback(
                    scope=scope,
                    task_filter=current_filter,
                    page=safe_page + 1,
                ).pack(),
            )
        )

    return InlineKeyboardMarkup(inline_keyboard=[nav_row])


def task_list_keyboard(
    tasks: Sequence[TaskListItem],
    scope: TaskListScope,
    current_filter: TaskListFilter,
    page: int = 1,
    total_pages: int = 1,
) -> InlineKeyboardMarkup:
    """Клавиатура списка задач: задачи + фильтры + пагинация."""
    buttons: list[list[InlineKeyboardButton]] = []

    for task in tasks:
        title = task.title.strip()
        short_title = title if len(title) <= 24 else f"{title[:21]}..."
        deadline = task.deadline.strftime("%d.%m") if task.deadline else "—"
        line = f"#{task.short_id} · {short_title} · {task.priority} · {deadline}"
        button_text = line if len(line) <= 64 else f"{line[:61]}..."
        buttons.append([
            InlineKeyboardButton(
                text=button_text,
                callback_data=TaskCardCallback(
                    short_id=task.short_id,
                    scope=scope,
                    task_filter=current_filter,
                    page=max(1, page),
                ).pack(),
            )
        ])

    buttons.extend(task_filters_keyboard(scope, current_filter, page=page).inline_keyboard)
    buttons.extend(
        task_pagination_keyboard(
            scope=scope,
            current_filter=current_filter,
            page=page,
            total_pages=total_pages,
        ).inline_keyboard
    )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def task_card_keyboard(
    task_id: int,
    is_moderator: bool,
    scope: TaskListScope,
    current_filter: TaskListFilter,
    page: int = 1,
) -> InlineKeyboardMarkup:
    """Клавиатура карточки задачи с существующими действиями + навигация."""
    base_keyboard = task_actions_keyboard(task_id, is_moderator)
    buttons = [list(row) for row in base_keyboard.inline_keyboard]
    buttons.append([
        InlineKeyboardButton(
            text="↩️ К списку",
            callback_data=TaskBackToListCallback(
                scope=scope,
                task_filter=current_filter,
                page=max(1, page),
            ).pack(),
        ),
        InlineKeyboardButton(
            text="🔄 Обновить список",
            callback_data=TaskRefreshListCallback(
                scope=scope,
                task_filter=current_filter,
                page=max(1, page),
            ).pack(),
        ),
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


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
