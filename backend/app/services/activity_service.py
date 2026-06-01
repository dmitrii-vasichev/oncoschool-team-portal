from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    ActivityEvent,
    ActivityReaction,
    Department,
    MilestoneAward,
    Task,
    TeamMember,
)
from app.services.task_visibility_service import resolve_visible_department_ids

COMPANY_EVENT_TYPES = {
    "task_completed",
    "task_cancelled",
    "kudos",
    "milestone_team",
    "milestone_personal",
}
EMOJI_SYMBOLS = {
    # celebratory set (completed / blocker / progress)
    "clap": "👏",
    "fire": "🔥",
    "party": "🎉",
    # cancellation set (non-celebratory)
    "ok": "👍",
    "broom": "🧹",
    "shrug": "🤷",
}
ALLOWED_EMOJI = set(EMOJI_SYMBOLS)
KUDOS_DEDUP_HOURS = 12


class ActivityService:
    """Records team activity events for the Team Pulse feed."""

    @staticmethod
    def _summarize_reactions(reactions, perspective_member_id) -> dict:
        """Build {counts: {emoji: n}, mine: [emojis this member used]} from reaction rows."""
        counts: dict[str, int] = {}
        mine: set[str] = set()
        for r in reactions:
            counts[r.emoji] = counts.get(r.emoji, 0) + 1
            if r.member_id == perspective_member_id:
                mine.add(r.emoji)
        return {"counts": counts, "mine": sorted(mine)}

    async def claim_milestone(
        self, session: AsyncSession, key: str, member_id=None
    ) -> bool:
        """Atomically claim a milestone key. Returns True only the first time.

        Uses Postgres INSERT ... ON CONFLICT DO NOTHING RETURNING so concurrent
        callers never double-award. Caller emits the event/DM only on True.
        """
        stmt = (
            pg_insert(MilestoneAward)
            .values(id=uuid.uuid4(), milestone_key=key, member_id=member_id)
            .on_conflict_do_nothing(index_elements=["milestone_key"])
            .returning(MilestoneAward.id)
        )
        result = await session.execute(stmt)
        return result.first() is not None

    async def give_kudos(
        self, session: AsyncSession, *, giver: TeamMember, recipient_id, message: str
    ) -> ActivityEvent:
        """Create a kudos event from ``giver`` to ``recipient_id``.

        Guardrails: no self-thank; recipient must be active; at most one kudos to
        the same recipient within KUDOS_DEDUP_HOURS.
        """
        if recipient_id == giver.id:
            raise ValueError("Нельзя поблагодарить самого себя")
        recipient = await session.get(TeamMember, recipient_id)
        if recipient is None or not recipient.is_active:
            raise ValueError("Получатель не найден")

        since = datetime.now(timezone.utc) - timedelta(hours=KUDOS_DEDUP_HOURS)
        dup = (await session.execute(
            select(ActivityEvent.id).where(
                ActivityEvent.event_type == "kudos",
                ActivityEvent.actor_id == giver.id,
                ActivityEvent.payload["recipient_id"].astext == str(recipient_id),
                ActivityEvent.created_at >= since,
            ).limit(1)
        )).first()
        if dup is not None:
            raise ValueError("Вы уже благодарили этого коллегу недавно")

        return await self.record(
            session,
            event_type="kudos",
            actor=giver,
            extra={
                "recipient_id": str(recipient_id),
                "recipient_name": recipient.full_name,
                "recipient_avatar_url": recipient.avatar_url,
                "message": message,
            },
        )

    async def record(
        self,
        session: AsyncSession,
        *,
        event_type: str,
        actor: TeamMember | None = None,
        task: Task | None = None,
        extra: dict | None = None,
    ) -> ActivityEvent:
        visibility = "company" if event_type in COMPANY_EVENT_TYPES else "department"

        department_id = None
        department_name = None
        payload: dict = {}
        if actor is not None:
            payload["actor_name"] = actor.full_name
            payload["actor_avatar_url"] = actor.avatar_url

        if task is not None:
            payload["task_title"] = task.title
            payload["task_short_id"] = task.short_id
            department_id = await self._resolve_assignee_department(session, task)
            if department_id is not None:
                dept = await session.get(Department, department_id)
                if dept is not None:
                    department_name = dept.name
            payload["department_name"] = department_name

        if extra:
            # extra is merged last and may intentionally override snapshot keys
            payload.update(extra)

        event = ActivityEvent(
            event_type=event_type,
            actor_id=actor.id if actor is not None else None,
            task_id=task.id if task is not None else None,
            department_id=department_id,
            visibility=visibility,
            payload=payload,
        )
        session.add(event)
        await session.flush()
        return event

    async def _resolve_assignee_department(
        self, session: AsyncSession, task: Task
    ) -> uuid.UUID | None:
        if task.assignee_id is None:
            return None
        result = await session.execute(
            select(TeamMember.department_id).where(TeamMember.id == task.assignee_id)
        )
        return result.scalar_one_or_none()

    async def get_feed(
        self,
        session: AsyncSession,
        viewer: TeamMember,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        visible = await resolve_visible_department_ids(session, viewer)
        is_full_scope = visible is None  # admin/moderator
        visible_dept_ids: set[uuid.UUID] = set(visible) if visible else set()

        stmt = (
            select(ActivityEvent)
            .options(
                selectinload(ActivityEvent.reactions),
                selectinload(ActivityEvent.actor),
            )
            .order_by(ActivityEvent.created_at.desc())
        )
        if not is_full_scope:
            conds = [ActivityEvent.visibility == "company"]
            if visible_dept_ids:
                conds.append(ActivityEvent.department_id.in_(visible_dept_ids))
            stmt = stmt.where(or_(*conds))
        stmt = stmt.limit(limit).offset(offset)

        events = (await session.execute(stmt)).scalars().all()
        return [
            self.serialize_event(ev, viewer, visible_dept_ids, is_full_scope)
            for ev in events
        ]

    async def toggle_reaction(
        self,
        session: AsyncSession,
        event_id: uuid.UUID,
        member: TeamMember,
        emoji: str,
    ) -> dict:
        if emoji not in ALLOWED_EMOJI:
            raise ValueError(f"Unsupported reaction: {emoji}")
        event = await session.get(ActivityEvent, event_id)
        if event is None:
            raise ValueError("Event not found")

        existing = (await session.execute(
            select(ActivityReaction).where(
                ActivityReaction.event_id == event_id,
                ActivityReaction.member_id == member.id,
                ActivityReaction.emoji == emoji,
            )
        )).scalar_one_or_none()

        if existing is not None:
            await session.delete(existing)
            added = False
        else:
            session.add(ActivityReaction(event_id=event_id, member_id=member.id, emoji=emoji))
            added = True
        await session.flush()

        rows = (await session.execute(
            select(ActivityReaction).where(ActivityReaction.event_id == event_id)
        )).scalars().all()
        summary = self._summarize_reactions(rows, member.id)

        actor_id_to_ping = event.actor_id if (added and event.actor_id != member.id) else None
        return {
            "added": added,
            "summary": summary,
            "actor_id_to_ping": actor_id_to_ping,
            "event": event,
        }

    def serialize_event(
        self,
        event: ActivityEvent,
        viewer: TeamMember,
        visible_dept_ids: set[uuid.UUID],
        is_full_scope: bool,
    ) -> dict:
        can_open = is_full_scope or (
            event.department_id is not None and event.department_id in visible_dept_ids
        )

        # Prefer the actor's CURRENT avatar: it reflects avatars uploaded after
        # the event and covers backfilled events whose payload predates the
        # avatar snapshot. Fall back to the payload snapshot only when the actor
        # relationship is not loaded.
        actor = event.actor
        actor_avatar_url = (
            actor.avatar_url if actor is not None
            else event.payload.get("actor_avatar_url")
        )

        row = {
            "id": str(event.id),
            "event_type": event.event_type,
            "visibility": event.visibility,
            "created_at": event.created_at.isoformat() if event.created_at else None,
            "actor_name": event.payload.get("actor_name"),
            "actor_avatar_url": actor_avatar_url,
            "department_name": event.payload.get("department_name"),
            "can_open": can_open,
            "reactions": self._summarize_reactions(event.reactions, viewer.id),
        }
        if can_open:
            if "task_title" in event.payload:
                row["task_title"] = event.payload["task_title"]
            if "task_short_id" in event.payload:
                row["task_short_id"] = event.payload["task_short_id"]
            for k in ("progress_percent", "blocker_text", "reason"):
                if k in event.payload:
                    row[k] = event.payload[k]
        if event.event_type == "kudos":
            row["recipient_name"] = event.payload.get("recipient_name")
            row["recipient_avatar_url"] = event.payload.get("recipient_avatar_url")
            row["message"] = event.payload.get("message")
        elif event.event_type in ("milestone_team", "milestone_personal"):
            row["milestone_kind"] = event.payload.get("kind")
            row["milestone_count"] = event.payload.get("count")
            row["period"] = event.payload.get("period")
        return row
