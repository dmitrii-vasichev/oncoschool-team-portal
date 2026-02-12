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

        # Match participant names to team members
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
            # Match assignee
            assignee_id = None
            if pt.get("assignee_name"):
                assignee = self._find_member_by_name(pt["assignee_name"], team_members)
                if assignee:
                    assignee_id = assignee.id

            # If no assignee found, assign to creator
            if not assignee_id:
                assignee_id = creator.id

            # Parse deadline
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

    async def get_all_meetings(self, session: AsyncSession) -> list[Meeting]:
        return await self.meeting_repo.get_all(session)

    async def get_meeting_by_id(
        self, session: AsyncSession, meeting_id: uuid.UUID
    ) -> Meeting | None:
        return await self.meeting_repo.get_by_id(session, meeting_id)

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
    # Check first name only
    member_first = member.full_name.lower().split()[0] if member.full_name else ""
    if name_lower == member_first:
        return True
    # Check name_variants
    if member.name_variants:
        for variant in member.name_variants:
            if name_lower == variant.lower():
                return True
    return False
