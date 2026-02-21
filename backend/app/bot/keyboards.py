from datetime import date
from typing import Protocol, Sequence

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)

from app.bot.callbacks import (
    ALL_DEPARTMENTS_TOKEN,
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

MENU_BTN_MY_TASKS = "📋 Мои задачи"
MENU_BTN_CREATE_TASK = "➕ Создать задачу"
MENU_BTN_CREATE_TASK_LEGACY = "Создать задачу"
MENU_BTN_HELP = "❓ Хелп"
MENU_BTN_ALL_TASKS_DEPARTMENT = "📊 Задачи отдела"
MENU_BTN_ALL_TASKS_COMPANY = "🏢 Задачи проекта"
MENU_BTN_ALL_TASKS_LEGACY = "📊 Все задачи"
MENU_BTN_NEXT_MEETING = "📅 Следующая встреча"
MENU_BTN_MY_REMINDER = "⏰ Мои напоминания"
MENU_BTN_MEETINGS = "🗓 Встречи"
MENU_BTN_STATS = "📈 Статистика"
MENU_BTN_SUBSCRIBE = "🔔 Подписки"
MENU_BTN_SUMMARY = "🧠 Summary"
MENU_BTN_SUMMARY_LEGACY = "🧠 Сводка"
MENU_BTN_AI_MODEL = "🤖 AI-модель"
MENU_BTN_TEAM_REMINDERS = "⏰ Напоминания команды"
MENU_BTN_TEAM_REMINDERS_LEGACY = "⚙️ Напоминания команды"


def main_menu_reply_keyboard(
    *,
    is_moderator: bool,
    is_admin: bool,
) -> ReplyKeyboardMarkup:
    """Persistent bottom keyboard for quick navigation in private chat."""
    all_tasks_button = (
        MENU_BTN_ALL_TASKS_COMPANY if is_moderator else MENU_BTN_ALL_TASKS_DEPARTMENT
    )
    button_order = [
        MENU_BTN_MY_TASKS,
        MENU_BTN_CREATE_TASK,
        all_tasks_button,
        MENU_BTN_MY_REMINDER,
        MENU_BTN_NEXT_MEETING,
    ]

    if is_moderator:
        button_order.extend([
            MENU_BTN_MEETINGS,
            MENU_BTN_SUBSCRIBE,
            MENU_BTN_SUMMARY,
            MENU_BTN_STATS,
            MENU_BTN_TEAM_REMINDERS,
        ])

    if is_admin:
        button_order.append(MENU_BTN_AI_MODEL)

    button_order.append(MENU_BTN_HELP)

    # Pair buttons row-by-row; if count is odd, last one stays single in the bottom row.
    rows: list[list[KeyboardButton]] = []
    for idx in range(0, len(button_order), 2):
        row_texts = button_order[idx: idx + 2]
        rows.append([KeyboardButton(text=text) for text in row_texts])

    return ReplyKeyboardMarkup(
        keyboard=rows,
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder="Выбери действие",
    )


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


def task_departments_keyboard(
    scope: TaskListScope,
    current_filter: TaskListFilter,
    current_department_token: str,
    department_options: Sequence[tuple[str, str]],
) -> InlineKeyboardMarkup:
    """Inline-кнопки выбора отдела для списка задач."""
    buttons: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []

    for token, label in department_options:
        text = f"✅ {label}" if token == current_department_token else label
        row.append(
            InlineKeyboardButton(
                text=text,
                callback_data=TaskListCallback(
                    scope=scope,
                    task_filter=current_filter,
                    page=1,
                    department_token=token,
                ).pack(),
            )
        )
        if len(row) == 2:
            buttons.append(row)
            row = []

    if row:
        buttons.append(row)

    return InlineKeyboardMarkup(inline_keyboard=buttons)


def task_filters_keyboard(
    scope: TaskListScope,
    current_filter: TaskListFilter,
    page: int = 1,
    department_token: str = ALL_DEPARTMENTS_TOKEN,
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
                    department_token=department_token,
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
                department_token=department_token,
            ).pack(),
        )
    ])

    return InlineKeyboardMarkup(inline_keyboard=buttons)


def task_pagination_keyboard(
    scope: TaskListScope,
    current_filter: TaskListFilter,
    page: int,
    total_pages: int,
    department_token: str = ALL_DEPARTMENTS_TOKEN,
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
                    department_token=department_token,
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
                    department_token=department_token,
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
    department_token: str = ALL_DEPARTMENTS_TOKEN,
    department_options: Sequence[tuple[str, str]] | None = None,
) -> InlineKeyboardMarkup:
    """Клавиатура списка задач: задачи + фильтры + пагинация."""
    buttons: list[list[InlineKeyboardButton]] = []
    task_rows: list[InlineKeyboardButton] = []

    for task in tasks:
        task_rows.append(
            InlineKeyboardButton(
                text=f"#{task.short_id}",
                callback_data=TaskCardCallback(
                    short_id=task.short_id,
                    scope=scope,
                    task_filter=current_filter,
                    page=max(1, page),
                    department_token=department_token,
                ).pack(),
            )
        )
        if len(task_rows) == 4:
            buttons.append(task_rows)
            task_rows = []

    if task_rows:
        buttons.append(task_rows)

    if department_options:
        buttons.extend(
            task_departments_keyboard(
                scope=scope,
                current_filter=current_filter,
                current_department_token=department_token,
                department_options=department_options,
            ).inline_keyboard
        )

    buttons.extend(
        task_filters_keyboard(
            scope,
            current_filter,
            page=page,
            department_token=department_token,
        ).inline_keyboard
    )
    buttons.extend(
        task_pagination_keyboard(
            scope=scope,
            current_filter=current_filter,
            page=page,
            total_pages=total_pages,
            department_token=department_token,
        ).inline_keyboard
    )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def task_card_keyboard(
    task_id: int,
    is_moderator: bool,
    scope: TaskListScope,
    current_filter: TaskListFilter,
    page: int = 1,
    department_token: str = ALL_DEPARTMENTS_TOKEN,
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
                department_token=department_token,
            ).pack(),
        ),
        InlineKeyboardButton(
            text="🔄 Обновить список",
            callback_data=TaskRefreshListCallback(
                scope=scope,
                task_filter=current_filter,
                page=max(1, page),
                department_token=department_token,
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


def voice_edit_fields_keyboard(*, is_moderator: bool) -> InlineKeyboardMarkup:
    """Клавиатура выбора поля для редактирования голосовой задачи."""
    rows = [
        [
            InlineKeyboardButton(text="📌 Название", callback_data="voice_field:title"),
            InlineKeyboardButton(text="⚡ Приоритет", callback_data="voice_field:priority"),
        ],
    ]
    if is_moderator:
        rows.append([
            InlineKeyboardButton(text="👤 Исполнитель", callback_data="voice_field:assignee"),
            InlineKeyboardButton(text="📅 Дедлайн", callback_data="voice_field:deadline"),
        ])
    else:
        rows.append([
            InlineKeyboardButton(text="📅 Дедлайн", callback_data="voice_field:deadline"),
        ])
    rows.extend([
        [
            InlineKeyboardButton(text="📝 Описание", callback_data="voice_field:description"),
        ],
        [
            InlineKeyboardButton(text="↩️ Назад к превью", callback_data="voice_back_preview"),
        ],
    ])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def voice_assignee_keyboard(
    team_members: Sequence,
    current_assignee_id: str | None,
) -> InlineKeyboardMarkup:
    """Клавиатура выбора исполнителя для голосовой задачи."""
    buttons = []
    for member in team_members:
        label = f"{'✓ ' if str(member.id) == current_assignee_id else ''}{member.full_name}"
        buttons.append([
            InlineKeyboardButton(
                text=label,
                callback_data=f"voice_assignee:{member.id}",
            )
        ])

    buttons.append([
        InlineKeyboardButton(text="↩️ К полям", callback_data="voice_back_fields"),
    ])
    buttons.append([
        InlineKeyboardButton(text="↩️ К превью", callback_data="voice_back_preview"),
    ])

    return InlineKeyboardMarkup(inline_keyboard=buttons)


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
