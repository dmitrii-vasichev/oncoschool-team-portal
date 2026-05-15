import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CFGuestStory, CFGuestStoryEvent
from app.db.schemas import CFGuestStoryCreate, CFGuestStoryUpdate


class GuestStoryService:
    WATCHED_EVENT_FIELDS = {
        "status": "status_changed",
        "consent_status": "consent_changed",
        "gift_status": "gift_changed",
        "follow_up_due_at": "follow_up_changed",
    }

    @staticmethod
    def _event_value(value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, datetime | date):
            return value.isoformat()
        return str(value)

    @staticmethod
    def _append_event(
        session: AsyncSession,
        *,
        guest_story_id: uuid.UUID,
        parent_event_id: uuid.UUID | None = None,
        event_type: str,
        actor_id: uuid.UUID | None = None,
        body: str | None = None,
        old_value: Any = None,
        new_value: Any = None,
        payload: dict[str, Any] | None = None,
    ) -> CFGuestStoryEvent:
        event = CFGuestStoryEvent(
            guest_story_id=guest_story_id,
            parent_event_id=parent_event_id,
            actor_id=actor_id,
            event_type=event_type,
            body=body,
            old_value=GuestStoryService._event_value(old_value),
            new_value=GuestStoryService._event_value(new_value),
            payload=payload or {},
        )
        session.add(event)
        return event

    @staticmethod
    async def _validate_parent_event(
        session: AsyncSession,
        *,
        guest_story_id: uuid.UUID,
        parent_event_id: uuid.UUID | None,
    ) -> None:
        if parent_event_id is None:
            return
        result = await session.execute(
            select(CFGuestStoryEvent).where(CFGuestStoryEvent.id == parent_event_id)
        )
        parent_event = result.scalar_one_or_none()
        if parent_event is None or parent_event.guest_story_id != guest_story_id:
            raise ValueError("Parent event not found for guest story")

    @staticmethod
    async def create(
        session: AsyncSession,
        payload: CFGuestStoryCreate,
        *,
        actor_id: uuid.UUID | None = None,
    ) -> CFGuestStory:
        guest_story = CFGuestStory(**payload.model_dump())
        session.add(guest_story)
        await session.flush()
        if actor_id is not None:
            GuestStoryService._append_event(
                session,
                guest_story_id=guest_story.id,
                actor_id=actor_id,
                event_type="created",
                new_value=guest_story.status,
                payload={"display_name": guest_story.display_name},
            )
            await session.flush()
        await session.refresh(guest_story)
        return guest_story

    @staticmethod
    async def get(session: AsyncSession, guest_story_id: uuid.UUID) -> CFGuestStory | None:
        result = await session.execute(
            select(CFGuestStory).where(CFGuestStory.id == guest_story_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_events(
        session: AsyncSession,
        guest_story_id: uuid.UUID,
    ) -> list[CFGuestStoryEvent]:
        result = await session.execute(
            select(CFGuestStoryEvent)
            .where(CFGuestStoryEvent.guest_story_id == guest_story_id)
            .order_by(CFGuestStoryEvent.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_event(
        session: AsyncSession,
        *,
        guest_story_id: uuid.UUID,
        event_type: str,
        actor_id: uuid.UUID | None = None,
        parent_event_id: uuid.UUID | None = None,
        body: str | None = None,
        old_value: Any = None,
        new_value: Any = None,
        payload: dict[str, Any] | None = None,
    ) -> CFGuestStoryEvent:
        await GuestStoryService._validate_parent_event(
            session,
            guest_story_id=guest_story_id,
            parent_event_id=parent_event_id,
        )
        event = GuestStoryService._append_event(
            session,
            guest_story_id=guest_story_id,
            parent_event_id=parent_event_id,
            event_type=event_type,
            actor_id=actor_id,
            body=body,
            old_value=old_value,
            new_value=new_value,
            payload=payload,
        )
        await session.flush()
        await session.refresh(event)
        return event

    @staticmethod
    async def create_comment(
        session: AsyncSession,
        *,
        guest_story_id: uuid.UUID,
        actor_id: uuid.UUID,
        body: str,
        parent_event_id: uuid.UUID | None = None,
    ) -> CFGuestStoryEvent:
        return await GuestStoryService.create_event(
            session,
            guest_story_id=guest_story_id,
            actor_id=actor_id,
            parent_event_id=parent_event_id,
            event_type="comment",
            body=body.strip(),
        )

    @staticmethod
    async def list(
        session: AsyncSession,
        *,
        status: str | None = None,
        owner_id: uuid.UUID | None = None,
        consent_status: str | None = None,
        bundle_id: uuid.UUID | None = None,
        publication_id: uuid.UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CFGuestStory]:
        stmt = select(CFGuestStory)
        if status:
            stmt = stmt.where(CFGuestStory.status == status)
        if owner_id:
            stmt = stmt.where(CFGuestStory.owner_id == owner_id)
        if consent_status:
            stmt = stmt.where(CFGuestStory.consent_status == consent_status)
        if bundle_id:
            stmt = stmt.where(CFGuestStory.bundle_id == bundle_id)
        if publication_id:
            stmt = stmt.where(CFGuestStory.publication_id == publication_id)
        stmt = (
            stmt.order_by(
                CFGuestStory.stage_due_at.asc().nullslast(),
                CFGuestStory.created_at.desc(),
            )
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def update(
        session: AsyncSession,
        guest_story_id: uuid.UUID,
        payload: CFGuestStoryUpdate,
        *,
        actor_id: uuid.UUID | None = None,
    ) -> CFGuestStory | None:
        guest_story = await GuestStoryService.get(session, guest_story_id)
        if guest_story is None:
            return None
        changes = payload.model_dump(exclude_unset=True)
        for field, value in changes.items():
            old_value = getattr(guest_story, field, None)
            setattr(guest_story, field, value)
            event_type = GuestStoryService.WATCHED_EVENT_FIELDS.get(field)
            if event_type and old_value != value:
                GuestStoryService._append_event(
                    session,
                    guest_story_id=guest_story.id,
                    actor_id=actor_id,
                    event_type=event_type,
                    old_value=old_value,
                    new_value=value,
                    payload={"field": field},
                )
        await session.flush()
        return guest_story
