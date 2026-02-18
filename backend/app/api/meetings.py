import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, require_moderator
from app.config import settings
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.schemas import MeetingResponse, TaskResponse
from app.db.repositories import MeetingRepository, TeamMemberRepository
from app.services.ai_service import AIService
from app.services.meeting_service import MeetingService
from app.services.meeting_status import compute_effective_status
from app.services.task_service import TaskService

router = APIRouter(prefix="/meetings", tags=["meetings"])
meeting_service = MeetingService()
ai_service = AIService()
member_repo = TeamMemberRepository()
meeting_repo = MeetingRepository()
task_service = TaskService()


# ── Request / Response models ──


class ManualMeetingCreate(BaseModel):
    title: str
    meeting_date: datetime
    zoom_enabled: bool = False
    duration_minutes: int = 60


class MeetingUpdate(BaseModel):
    title: str | None = None
    meeting_date: datetime | None = None
    status: str | None = None
    notes: str | None = None


class TranscriptRequest(BaseModel):
    text: str
    source: str = "manual"


class ParseSummaryRequest(BaseModel):
    text: str | None = None  # If not provided, uses meeting.transcript


class ParseSummaryResponse(BaseModel):
    title: str
    summary: str
    decisions: list[str]
    tasks: list[dict]
    participants: list[str]


class ApplySummaryRequest(BaseModel):
    raw_summary: str
    title: str
    parsed_summary: str
    decisions: list[str]
    participants: list[str]
    tasks: list[dict]


class MeetingWithTasksResponse(BaseModel):
    meeting: MeetingResponse
    tasks_created: int


class ZoomStatusResponse(BaseModel):
    zoom_configured: bool
    has_recording: bool = False
    has_transcript: bool = False
    recording_url: str | None = None


def _get_zoom_service(request: Request):
    """Get zoom_service from app.state (may be None)."""
    return getattr(request.app.state, "zoom_service", None)


def _meeting_response(meeting) -> MeetingResponse:
    """Build MeetingResponse with computed effective_status."""
    resp = MeetingResponse.model_validate(meeting)
    resp.effective_status = compute_effective_status(
        stored_status=meeting.status,
        meeting_date=meeting.meeting_date,
        duration_minutes=meeting.duration_minutes,
    )
    return resp


# ── LIST / GET endpoints ──


@router.get("", response_model=list[MeetingResponse])
async def list_meetings(
    upcoming: bool = False,
    past: bool = False,
    status_filter: str | None = None,
    page: int = 1,
    per_page: int = 50,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List meetings with optional filters."""
    if upcoming:
        meetings = await meeting_service.get_upcoming_meetings(session, limit=per_page)
    elif past:
        meetings = await meeting_service.get_past_meetings(session, limit=per_page)
    elif status_filter:
        from sqlalchemy import select
        from app.db.models import Meeting

        stmt = (
            select(Meeting)
            .where(Meeting.status == status_filter)
            .order_by(Meeting.meeting_date.desc().nullslast())
            .limit(per_page)
            .offset((page - 1) * per_page)
        )
        result = await session.execute(stmt)
        meetings = list(result.scalars().all())
    else:
        from sqlalchemy import select
        from app.db.models import Meeting

        stmt = (
            select(Meeting)
            .order_by(Meeting.meeting_date.desc().nullslast())
            .limit(per_page)
            .offset((page - 1) * per_page)
        )
        result = await session.execute(stmt)
        meetings = list(result.scalars().all())
    return [_meeting_response(m) for m in meetings]


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: uuid.UUID,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get full meeting details."""
    meeting = await meeting_service.get_meeting_by_id(session, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Встреча не найдена")
    return _meeting_response(meeting)


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


# ── CREATE / UPDATE / DELETE ──


@router.post("", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    data: ManualMeetingCreate,
    request: Request,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Create a meeting manually (without schedule). Optionally creates Zoom meeting."""
    # Strip timezone info — DB column is TIMESTAMP WITHOUT TIME ZONE
    meeting_date = data.meeting_date.replace(tzinfo=None) if data.meeting_date.tzinfo else data.meeting_date

    zoom_data = None
    zoom_svc = _get_zoom_service(request)

    if data.zoom_enabled and zoom_svc:
        try:
            zoom_data = await zoom_svc.create_meeting(
                topic=data.title,
                start_time=meeting_date,
                timezone=settings.TIMEZONE,
            )
        except Exception as e:
            # Zoom failure is non-fatal — create meeting without Zoom
            import logging
            logging.getLogger(__name__).error(f"Zoom create failed: {e}")

    meeting = await meeting_service.create_manual_meeting(
        session,
        title=data.title,
        meeting_date=meeting_date,
        creator=member,
        zoom_data=zoom_data,
        duration_minutes=data.duration_minutes,
    )
    await session.commit()
    return _meeting_response(meeting)


@router.patch("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: uuid.UUID,
    data: MeetingUpdate,
    request: Request,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Update meeting details. If meeting_date changes and Zoom exists, update Zoom too."""
    meeting = await meeting_service.get_meeting_by_id(session, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Встреча не найдена")

    fields = data.model_dump(exclude_unset=True)
    if not fields:
        return _meeting_response(meeting)

    # If changing date and Zoom meeting exists, update Zoom
    zoom_svc = _get_zoom_service(request)
    if "meeting_date" in fields and meeting.zoom_meeting_id and zoom_svc:
        try:
            await zoom_svc.update_meeting(
                meeting.zoom_meeting_id,
                start_time=fields["meeting_date"].strftime("%Y-%m-%dT%H:%M:%S"),
                timezone=settings.TIMEZONE,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Zoom update failed: {e}")

    updated = await meeting_service.update_meeting(session, meeting_id, **fields)
    await session.commit()
    return _meeting_response(updated)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: uuid.UUID,
    request: Request,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Delete a meeting. If Zoom meeting exists, delete from Zoom too."""
    meeting = await meeting_service.get_meeting_by_id(session, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Встреча не найдена")

    # Delete from Zoom if possible
    zoom_svc = _get_zoom_service(request)
    if meeting.zoom_meeting_id and zoom_svc:
        try:
            await zoom_svc.delete_meeting(meeting.zoom_meeting_id)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Zoom delete failed: {e}")

    await meeting_repo.delete(session, meeting_id)
    await session.commit()


# ── TRANSCRIPT endpoints ──


@router.post("/{meeting_id}/transcript", response_model=MeetingResponse)
async def add_transcript(
    meeting_id: uuid.UUID,
    data: TranscriptRequest,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Add or replace transcript manually."""
    meeting = await meeting_service.add_transcript(
        session, meeting_id, data.text, source=data.source
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Встреча не найдена")
    await session.commit()
    return _meeting_response(meeting)


@router.post("/{meeting_id}/fetch-transcript")
async def fetch_transcript(
    meeting_id: uuid.UUID,
    request: Request,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Try to auto-fetch transcript from Zoom API."""
    zoom_svc = _get_zoom_service(request)
    transcript = await meeting_service.try_fetch_zoom_transcript(
        session, meeting_id, zoom_svc
    )
    if transcript:
        await session.commit()
        return {"transcript": transcript, "source": "zoom_api"}
    return {"transcript": None, "message": "Транскрипция недоступна"}


# ── SUMMARY / AI PARSE endpoints ──


@router.post("/{meeting_id}/parse-summary", response_model=ParseSummaryResponse)
async def parse_summary(
    meeting_id: uuid.UUID,
    data: ParseSummaryRequest | None = None,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Parse text via AI. If text not provided, uses meeting.transcript."""
    meeting = await meeting_service.get_meeting_by_id(session, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Встреча не найдена")

    text = (data.text if data and data.text else None) or meeting.transcript
    if not text:
        raise HTTPException(
            status_code=422,
            detail="Нет текста для парсинга. Передайте text или сначала добавьте транскрипцию.",
        )

    team_members = await member_repo.get_all_active(session)

    try:
        parsed = await ai_service.parse_meeting_summary(session, text, team_members)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return ParseSummaryResponse(
        title=parsed.title,
        summary=parsed.summary,
        decisions=parsed.decisions,
        tasks=[t.model_dump() for t in parsed.tasks],
        participants=parsed.participants,
    )


@router.post("/{meeting_id}/apply-summary", response_model=MeetingWithTasksResponse)
async def apply_summary(
    meeting_id: uuid.UUID,
    data: ApplySummaryRequest,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Apply parsed summary to meeting: update fields + create tasks."""
    try:
        meeting, tasks = await meeting_service.complete_meeting_with_summary(
            session,
            meeting_id=meeting_id,
            raw_summary=data.raw_summary,
            parsed_summary=data.parsed_summary,
            decisions=data.decisions,
            participant_names=data.participants,
            tasks_data=data.tasks,
            creator=member,
        )
        await session.commit()

        return MeetingWithTasksResponse(
            meeting=_meeting_response(meeting),
            tasks_created=len(tasks),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


# ── ZOOM STATUS ──


@router.get("/{meeting_id}/zoom-status", response_model=ZoomStatusResponse)
async def get_zoom_status(
    meeting_id: uuid.UUID,
    request: Request,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Check Zoom meeting status: recordings, transcript availability."""
    meeting = await meeting_service.get_meeting_by_id(session, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Встреча не найдена")

    zoom_svc = _get_zoom_service(request)
    response = ZoomStatusResponse(zoom_configured=settings.zoom_configured)

    if not meeting.zoom_meeting_id or not zoom_svc:
        return response

    try:
        recordings = await zoom_svc.get_recordings(meeting.zoom_meeting_id)
        if recordings and "recording_files" in recordings:
            response.has_recording = True
            # Check for transcript file
            for f in recordings["recording_files"]:
                if f.get("file_type") == "TRANSCRIPT":
                    response.has_transcript = True
                    break
            # Get recording play URL
            play_files = [
                f for f in recordings["recording_files"]
                if f.get("file_type") == "MP4" and f.get("play_url")
            ]
            if play_files:
                response.recording_url = play_files[0]["play_url"]
    except Exception:
        pass

    return response
