import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.database import get_session
from app.db.models import InAppNotification, Task, TeamMember
from app.db.repositories import InAppNotificationRepository
from app.db.schemas import InAppNotificationListResponse, InAppNotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])
notification_repo = InAppNotificationRepository()

LEGACY_TITLE_TEMPLATES: dict[str, str] = {
    "task_assigned": "Вам назначили задачу «{task_title}»",
    "task_blocker_added": "Блокер в задаче «{task_title}»",
    "task_deadline_tomorrow": "Дедлайн завтра по задаче «{task_title}»",
    "task_deadline_today": "Дедлайн сегодня по задаче «{task_title}»",
    "task_overdue_started": "Задача «{task_title}» стала просроченной",
    "task_status_changed_by_other": "Статус задачи «{task_title}» изменён",
    "task_review_requested": "Задача «{task_title}» переведена на согласование",
    "task_created_unassigned": "Задача «{task_title}» без исполнителя",
}


def _is_legacy_task_title(notification: InAppNotification) -> bool:
    return (
        notification.task_short_id is not None
        and "#{0}".format(notification.task_short_id) in notification.title
    )


def _normalize_notification_title(
    notification: InAppNotification,
    task_titles: dict[int, str],
) -> str:
    template = LEGACY_TITLE_TEMPLATES.get(notification.event_type)
    if not template or not _is_legacy_task_title(notification):
        return notification.title

    task_title = task_titles.get(notification.task_short_id or -1)
    if not task_title:
        fallback = (notification.body or "").strip()
        task_title = fallback if fallback else "Без названия"
    return template.format(task_title=task_title)


async def _build_task_titles_map(
    session: AsyncSession,
    items: list[InAppNotification],
) -> dict[int, str]:
    short_ids = {
        item.task_short_id
        for item in items
        if item.task_short_id is not None and _is_legacy_task_title(item)
    }
    if not short_ids:
        return {}

    stmt = select(Task.short_id, Task.title).where(Task.short_id.in_(short_ids))
    result = await session.execute(stmt)
    return {short_id: title for short_id, title in result.all() if title}


async def _serialize_notifications(
    session: AsyncSession,
    items: list[InAppNotification],
) -> list[InAppNotificationResponse]:
    task_titles = await _build_task_titles_map(session, items)
    serialized: list[InAppNotificationResponse] = []
    for notification in items:
        payload = InAppNotificationResponse.model_validate(notification)
        normalized_title = _normalize_notification_title(notification, task_titles)
        if normalized_title != payload.title:
            payload = payload.model_copy(update={"title": normalized_title})
        serialized.append(payload)
    return serialized


@router.get("", response_model=InAppNotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(30, ge=1, le=100),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    items = await notification_repo.list_for_member(
        session,
        member.id,
        unread_only=unread_only,
        limit=limit,
    )
    unread_count = await notification_repo.get_unread_count(session, member.id)
    serialized = await _serialize_notifications(session, items)
    return InAppNotificationListResponse(items=serialized, unread_count=unread_count)


@router.post("/{notification_id}/read", response_model=InAppNotificationResponse)
async def mark_notification_read(
    notification_id: uuid.UUID,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    notification = await notification_repo.mark_read(session, member.id, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    await session.commit()
    payload = await _serialize_notifications(session, [notification])
    return payload[0]


@router.post("/read-all", response_model=dict)
async def mark_all_notifications_read(
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    updated = await notification_repo.mark_all_read(session, member.id)
    await session.commit()
    return {"updated": updated}
