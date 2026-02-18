from enum import Enum

from aiogram.filters.callback_data import CallbackData


class TaskListScope(str, Enum):
    """Scope of task list view."""

    MY = "my"
    TEAM = "team"


class TaskListFilter(str, Enum):
    """Available filters for task list view."""

    ALL = "all"
    NEW = "new"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    OVERDUE = "overdue"
    # Legacy values kept for stale callback compatibility.
    ACTIVE = "active"
    DONE = "done"
    CANCELLED = "cancelled"


class TaskListCallback(CallbackData, prefix="tlst"):
    """List state callback (scope/filter/page)."""

    scope: TaskListScope
    task_filter: TaskListFilter
    page: int


class TaskCardCallback(CallbackData, prefix="tcard"):
    """Open task card from list."""

    short_id: int
    scope: TaskListScope
    task_filter: TaskListFilter
    page: int


class TaskBackToListCallback(CallbackData, prefix="tback"):
    """Back from task card to list."""

    scope: TaskListScope
    task_filter: TaskListFilter
    page: int


class TaskRefreshListCallback(CallbackData, prefix="tref"):
    """Refresh current task list view."""

    scope: TaskListScope
    task_filter: TaskListFilter
    page: int
