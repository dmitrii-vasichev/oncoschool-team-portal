import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, require_moderator
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.schemas import MeetingCreate, MeetingResponse, TaskResponse
from app.db.repositories import TeamMemberRepository
from app.services.ai_service import AIService
from app.services.meeting_service import MeetingService
from app.services.task_service import TaskService

router = APIRouter(prefix="/meetings", tags=["meetings"])
meeting_service = MeetingService()
ai_service = AIService()
member_repo = TeamMemberRepository()
task_service = TaskService()


class ParseSummaryRequest(BaseModel):
    summary_text: str


class ParseSummaryResponse(BaseModel):
    title: str
    summary: str
    decisions: list[str]
    tasks: list[dict]
    participants: list[str]


class CreateFromParsedRequest(BaseModel):
    raw_summary: str
    title: str
    parsed_summary: str
    decisions: list[str]
    participants: list[str]
    tasks: list[dict]


class MeetingWithTasksResponse(BaseModel):
    meeting: MeetingResponse
    tasks_created: int


@router.get("", response_model=list[MeetingResponse])
async def list_meetings(
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all meetings."""
    meetings = await meeting_service.get_all_meetings(session)
    return meetings


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: uuid.UUID,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get meeting details."""
    meeting = await meeting_service.get_meeting_by_id(session, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Встреча не найдена")
    return meeting


@router.get("/{meeting_id}/tasks", response_model=list[TaskResponse])
async def get_meeting_tasks(
    meeting_id: uuid.UUID,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get tasks linked to a meeting."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.db.models import Task

    stmt = (
        select(Task)
        .options(selectinload(Task.assignee), selectinload(Task.created_by))
        .where(Task.meeting_id == meeting_id)
        .order_by(Task.short_id)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("/parse-summary", response_model=ParseSummaryResponse)
async def parse_summary(
    data: ParseSummaryRequest,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Parse Zoom AI Summary via AI. Moderator only."""
    team_members = await member_repo.get_all_active(session)

    try:
        parsed = await ai_service.parse_meeting_summary(
            session, data.summary_text, team_members
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return ParseSummaryResponse(
        title=parsed.title,
        summary=parsed.summary,
        decisions=parsed.decisions,
        tasks=[t.model_dump() for t in parsed.tasks],
        participants=parsed.participants,
    )


@router.post("", response_model=MeetingWithTasksResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    data: CreateFromParsedRequest,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Create a meeting with tasks from parsed summary. Moderator only."""
    try:
        async with session.begin():
            meeting = await meeting_service.create_meeting_from_parsed(
                session,
                raw_summary=data.raw_summary,
                parsed_title=data.title,
                parsed_summary=data.parsed_summary,
                decisions=data.decisions,
                participant_names=data.participants,
                creator=member,
            )

            team_members = await member_repo.get_all_active(session)
            tasks = await meeting_service.create_tasks_from_parsed(
                session,
                meeting=meeting,
                parsed_tasks=data.tasks,
                creator=member,
                team_members=team_members,
            )

            return MeetingWithTasksResponse(
                meeting=MeetingResponse.model_validate(meeting),
                tasks_created=len(tasks),
            )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: uuid.UUID,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Delete a meeting. Moderator only."""
    from app.db.repositories import MeetingRepository
    meeting_repo = MeetingRepository()

    meeting = await meeting_service.get_meeting_by_id(session, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Встреча не найдена")

    async with session.begin():
        await meeting_repo.delete(session, meeting_id)
