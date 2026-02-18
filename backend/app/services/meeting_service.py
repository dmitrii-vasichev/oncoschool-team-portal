import logging
import uuid
from datetime import date, datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Meeting, Task, TeamMember
from app.db.repositories import MeetingRepository, TeamMemberRepository
from app.services.permission_service import PermissionService
from app.services.task_service import TaskService

logger = logging.getLogger(__name__)


class MeetingService:
    def __init__(self):
        self.meeting_repo = MeetingRepository()
        self.member_repo = TeamMemberRepository()
        self.task_service = TaskService()

    # ── Creation ──

    async def create_meeting_from_parsed(
        self,
        session: AsyncSession,
        raw_summary: str,
        parsed_title: str,
        parsed_summary: str,
        decisions: list[str],
        participant_names: list[str],
        creator: TeamMember,
    ) -> Meeting:
        """Create a meeting record from parsed data (no tasks yet)."""
        if not PermissionService.can_submit_summary(creator):
            raise PermissionError("Только модератор может создавать встречи из summary")

        all_members = await self.member_repo.get_all_active(session)
        participant_ids = self._match_participants(participant_names, all_members)

        meeting = await self.meeting_repo.create(
            session,
            title=parsed_title,
            raw_summary=raw_summary,
            parsed_summary=parsed_summary,
            decisions=decisions,
            meeting_date=datetime.now(timezone.utc),
            created_by_id=creator.id,
            participant_ids=participant_ids,
        )
        return meeting

    async def create_manual_meeting(
        self,
        session: AsyncSession,
        title: str,
        meeting_date: datetime,
        creator: TeamMember,
        zoom_data: dict | None = None,
        duration_minutes: int = 60,
    ) -> Meeting:
        """Create a meeting manually (without schedule). Optionally with Zoom."""
        kwargs = dict(
            title=title,
            meeting_date=meeting_date,
            status="scheduled",
            created_by_id=creator.id,
            duration_minutes=duration_minutes,
        )
        if zoom_data:
            kwargs["zoom_meeting_id"] = str(zoom_data["id"])
            kwargs["zoom_join_url"] = zoom_data.get("join_url")

        meeting = await self.meeting_repo.create(session, **kwargs)
        return meeting

    # ── Task creation from parsed data ──

    async def create_tasks_from_parsed(
        self,
        session: AsyncSession,
        meeting: Meeting,
        parsed_tasks: list[dict],
        creator: TeamMember,
        team_members: list[TeamMember],
    ) -> list[Task]:
        """Create tasks from parsed meeting data."""
        created_tasks = []

        for pt in parsed_tasks:
            assignee_id = None
            if pt.get("assignee_name"):
                assignee = self._find_member_by_name(pt["assignee_name"], team_members)
                if assignee:
                    assignee_id = assignee.id

            if not assignee_id:
                assignee_id = creator.id

            deadline = None
            if pt.get("deadline"):
                try:
                    deadline = date.fromisoformat(pt["deadline"])
                except ValueError:
                    pass

            task = await self.task_service.create_task(
                session,
                title=pt["title"],
                creator=creator,
                assignee_id=assignee_id,
                description=pt.get("description"),
                priority=pt.get("priority", "medium"),
                deadline=deadline,
                source="summary",
                meeting_id=meeting.id,
            )
            created_tasks.append(task)

        return created_tasks

    # ── Queries ──

    async def get_all_meetings(self, session: AsyncSession) -> list[Meeting]:
        return await self.meeting_repo.get_all(session)

    async def get_meeting_by_id(
        self, session: AsyncSession, meeting_id: uuid.UUID
    ) -> Meeting | None:
        return await self.meeting_repo.get_by_id(session, meeting_id)

    async def get_upcoming_meetings(self, session: AsyncSession, limit: int = 10) -> list[Meeting]:
        return await self.meeting_repo.get_upcoming(session, limit=limit)

    async def get_past_meetings(self, session: AsyncSession, limit: int = 20) -> list[Meeting]:
        return await self.meeting_repo.get_past(session, limit=limit)

    # ── Updates ──

    async def update_meeting(
        self,
        session: AsyncSession,
        meeting_id: uuid.UUID,
        **fields,
    ) -> Meeting | None:
        """Update meeting fields."""
        meeting = await session.get(Meeting, meeting_id)
        if not meeting:
            return None
        for key, value in fields.items():
            setattr(meeting, key, value)
        await session.flush()
        return meeting

    async def add_transcript(
        self,
        session: AsyncSession,
        meeting_id: uuid.UUID,
        transcript_text: str,
        source: str = "manual",
    ) -> Meeting | None:
        """Save transcript and its source ('zoom_api' | 'manual')."""
        meeting = await session.get(Meeting, meeting_id)
        if not meeting:
            return None
        meeting.transcript = transcript_text
        meeting.transcript_source = source
        await session.flush()
        return meeting

    async def update_meeting_status(
        self,
        session: AsyncSession,
        meeting_id: uuid.UUID,
        new_status: str,
    ) -> Meeting | None:
        """Update meeting status."""
        meeting = await session.get(Meeting, meeting_id)
        if not meeting:
            return None
        meeting.status = new_status
        await session.flush()
        return meeting

    async def complete_meeting_with_summary(
        self,
        session: AsyncSession,
        meeting_id: uuid.UUID,
        raw_summary: str,
        parsed_summary: str,
        decisions: list[str],
        participant_names: list[str],
        tasks_data: list[dict],
        creator: TeamMember,
    ) -> tuple[Meeting, list[Task]]:
        """Apply parsed summary to a meeting: update fields + create tasks."""
        meeting = await session.get(Meeting, meeting_id)
        if not meeting:
            raise ValueError("Встреча не найдена")

        # Update meeting fields
        meeting.raw_summary = raw_summary
        meeting.parsed_summary = parsed_summary
        meeting.decisions = decisions
        if meeting.status != "completed":
            meeting.status = "completed"

        # Match participants
        all_members = await self.member_repo.get_all_active(session)
        participant_ids = self._match_participants(participant_names, all_members)
        # Add MeetingParticipant records
        from app.db.models import MeetingParticipant
        # Clear existing participants first
        from sqlalchemy import delete as sa_delete
        await session.execute(
            sa_delete(MeetingParticipant).where(MeetingParticipant.meeting_id == meeting_id)
        )
        for member_id in participant_ids:
            session.add(MeetingParticipant(meeting_id=meeting_id, member_id=member_id))

        await session.flush()

        # Create tasks
        created_tasks = await self.create_tasks_from_parsed(
            session, meeting, tasks_data, creator, all_members
        )

        return meeting, created_tasks

    # ── Zoom transcript ──

    async def try_fetch_zoom_transcript(
        self,
        session: AsyncSession,
        meeting_id: uuid.UUID,
        zoom_service,
    ) -> str | None:
        """
        Try to fetch transcript from Zoom API.
        If zoom_meeting_id exists -> zoom_service.get_transcript()
        If found -> save with transcript_source='zoom_api'
        Returns transcript text or None.
        """
        meeting = await session.get(Meeting, meeting_id)
        if not meeting or not meeting.zoom_meeting_id or not zoom_service:
            return None

        try:
            transcript_text = await zoom_service.get_transcript(meeting.zoom_meeting_id)
        except Exception as e:
            logger.error(f"Failed to fetch Zoom transcript for meeting {meeting_id}: {e}")
            return None

        if transcript_text:
            meeting.transcript = transcript_text
            meeting.transcript_source = "zoom_api"
            await session.flush()
            return transcript_text

        return None

    # ── Name matching helpers ──

    @staticmethod
    def _match_participants(
        names: list[str], members: list[TeamMember]
    ) -> list[uuid.UUID]:
        """Match participant names to team member IDs."""
        matched_ids = []
        for name in names:
            name_lower = name.lower().strip()
            for member in members:
                if _name_matches(name_lower, member):
                    if member.id not in matched_ids:
                        matched_ids.append(member.id)
                    break
        return matched_ids

    @staticmethod
    def _find_member_by_name(
        name: str, members: list[TeamMember]
    ) -> TeamMember | None:
        """Find team member by name or name variant."""
        name_lower = name.lower().strip()
        for member in members:
            if _name_matches(name_lower, member):
                return member
        return None


def _name_matches(name_lower: str, member: TeamMember) -> bool:
    """Check if a name matches a team member (full_name or name_variants)."""
    if name_lower == member.full_name.lower():
        return True
    member_first = member.full_name.lower().split()[0] if member.full_name else ""
    if name_lower == member_first:
        return True
    if member.name_variants:
        for variant in member.name_variants:
            if name_lower == variant.lower():
                return True
    return False
