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


def voice_task_confirm_keyboard(task_data_id: str) -> InlineKeyboardMarkup:
    """Клавиатура подтверждения голосовой задачи."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Создать", callback_data=f"voice_create:{task_data_id}"),
            InlineKeyboardButton(text="✏️ Изменить", callback_data=f"voice_edit:{task_data_id}"),
            InlineKeyboardButton(text="❌ Отмена", callback_data=f"voice_cancel:{task_data_id}"),
        ]
    ])
