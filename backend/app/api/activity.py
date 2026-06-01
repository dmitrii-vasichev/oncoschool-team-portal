import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.api.schemas_activity import KudosRequest, ReactionRequest
from app.db.database import get_session
from app.db.models import TeamMember
from app.services.activity_service import ActivityService
from app.services.notification_service import NotificationService
from app.services.task_visibility_service import resolve_visible_department_ids

router = APIRouter(prefix="/activity", tags=["activity"])
activity_service = ActivityService()


@router.get("")
async def list_activity(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    items = await activity_service.get_feed(
        session, member, limit=limit, offset=offset
    )
    return {"items": items}


@router.post("/{event_id}/reactions")
async def react(
    request: Request,
    event_id: uuid.UUID,
    data: ReactionRequest,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    try:
        result = await activity_service.toggle_reaction(
            session, event_id, member, data.emoji
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if result["actor_id_to_ping"] is not None:
        bot = getattr(request.app.state, "bot", None)
        if bot is not None:
            ns = NotificationService(bot)
            await ns.notify_reaction(session, result["event"], member, data.emoji)

    await session.commit()
    return {"added": result["added"], "summary": result["summary"]}


@router.post("/kudos")
async def give_kudos(
    request: Request,
    data: KudosRequest,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    try:
        event = await activity_service.give_kudos(
            session, giver=member, recipient_id=data.recipient_id, message=data.message
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    bot = getattr(request.app.state, "bot", None)
    if bot is not None:
        await NotificationService(bot).notify_kudos(session, event, member)

    visible = await resolve_visible_department_ids(session, member)
    is_full_scope = visible is None
    visible_ids = set(visible) if visible else set()
    await session.refresh(event, ["reactions", "actor"])
    row = activity_service.serialize_event(event, member, visible_ids, is_full_scope)

    await session.commit()
    return row
