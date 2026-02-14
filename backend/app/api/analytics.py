from datetime import date, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, require_moderator
from app.db.database import get_session
from app.db.models import Meeting, Task, TaskUpdate, TeamMember
from app.db.repositories import TeamMemberRepository

router = APIRouter(prefix="/analytics", tags=["analytics"])
member_repo = TeamMemberRepository()


class OverviewResponse(BaseModel):
    total_tasks: int
    tasks_new: int
    tasks_in_progress: int
    tasks_review: int
    tasks_done: int
    tasks_cancelled: int
    tasks_overdue: int
    total_meetings: int
    total_members: int
    tasks_by_source: dict[str, int]
    tasks_by_priority: dict[str, int]


class MemberStats(BaseModel):
    id: str
    full_name: str
    avatar_url: str | None
    role: str
    total_tasks: int
    tasks_done: int
    tasks_in_progress: int
    tasks_overdue: int
    last_update: datetime | None


class MembersAnalyticsResponse(BaseModel):
    members: list[MemberStats]


class MeetingStats(BaseModel):
    total_meetings: int
    tasks_from_meetings: int
    meetings_this_month: int


@router.get("/overview", response_model=OverviewResponse)
async def analytics_overview(
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get overview analytics."""
    today = date.today()

    # Task counts by status
    status_counts = {}
    stmt = select(Task.status, func.count(Task.id)).group_by(Task.status)
    result = await session.execute(stmt)
    for status_val, count in result.all():
        status_counts[status_val] = count

    total_tasks = sum(status_counts.values())

    # Overdue tasks (deadline today or earlier)
    overdue_stmt = select(func.count(Task.id)).where(
        Task.deadline <= today,
        Task.status.notin_(["done", "cancelled"]),
    )
    overdue_result = await session.execute(overdue_stmt)
    tasks_overdue = overdue_result.scalar_one()

    # Tasks by source
    source_stmt = select(Task.source, func.count(Task.id)).group_by(Task.source)
    source_result = await session.execute(source_stmt)
    tasks_by_source = dict(source_result.all())

    # Tasks by priority
    priority_stmt = select(Task.priority, func.count(Task.id)).group_by(Task.priority)
    priority_result = await session.execute(priority_stmt)
    tasks_by_priority = dict(priority_result.all())

    # Total meetings
    meetings_stmt = select(func.count(Meeting.id))
    meetings_result = await session.execute(meetings_stmt)
    total_meetings = meetings_result.scalar_one()

    # Total active members
    members_stmt = select(func.count(TeamMember.id)).where(TeamMember.is_active.is_(True))
    members_result = await session.execute(members_stmt)
    total_members = members_result.scalar_one()

    return OverviewResponse(
        total_tasks=total_tasks,
        tasks_new=status_counts.get("new", 0),
        tasks_in_progress=status_counts.get("in_progress", 0),
        tasks_review=status_counts.get("review", 0),
        tasks_done=status_counts.get("done", 0),
        tasks_cancelled=status_counts.get("cancelled", 0),
        tasks_overdue=tasks_overdue,
        total_meetings=total_meetings,
        total_members=total_members,
        tasks_by_source=tasks_by_source,
        tasks_by_priority=tasks_by_priority,
    )


@router.get("/members", response_model=MembersAnalyticsResponse)
async def analytics_members(
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Get per-member analytics (single aggregation query instead of N+1)."""
    today = date.today()
    all_members = await member_repo.get_all_active(session)

    # Single query: task counts per assignee with conditional aggregation
    task_stats_stmt = (
        select(
            Task.assignee_id,
            func.count(Task.id).label("total"),
            func.count(case((Task.status == "done", Task.id))).label("done"),
            func.count(case((Task.status == "in_progress", Task.id))).label("in_progress"),
            func.count(
                case((
                    (Task.deadline <= today) & Task.status.notin_(["done", "cancelled"]),
                    Task.id,
                ))
            ).label("overdue"),
        )
        .group_by(Task.assignee_id)
    )
    task_stats_result = await session.execute(task_stats_stmt)
    stats_by_assignee = {
        row.assignee_id: row
        for row in task_stats_result.all()
    }

    # Single query: last update per author
    last_update_stmt = (
        select(
            TaskUpdate.author_id,
            func.max(TaskUpdate.created_at).label("last_update"),
        )
        .group_by(TaskUpdate.author_id)
    )
    last_update_result = await session.execute(last_update_stmt)
    last_updates = {row.author_id: row.last_update for row in last_update_result.all()}

    member_stats = []
    for m in all_members:
        row = stats_by_assignee.get(m.id)
        member_stats.append(
            MemberStats(
                id=str(m.id),
                full_name=m.full_name,
                avatar_url=m.avatar_url,
                role=m.role,
                total_tasks=row.total if row else 0,
                tasks_done=row.done if row else 0,
                tasks_in_progress=row.in_progress if row else 0,
                tasks_overdue=row.overdue if row else 0,
                last_update=last_updates.get(m.id),
            )
        )

    return MembersAnalyticsResponse(members=member_stats)


@router.get("/meetings", response_model=MeetingStats)
async def analytics_meetings(
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get meetings analytics."""
    # Total meetings
    total_stmt = select(func.count(Meeting.id))
    total_result = await session.execute(total_stmt)
    total = total_result.scalar_one()

    # Tasks created from meetings
    tasks_from_stmt = select(func.count(Task.id)).where(Task.source == "summary")
    tasks_result = await session.execute(tasks_from_stmt)
    tasks_from = tasks_result.scalar_one()

    # Meetings this month
    # Keep UTC timestamp naive to match DB columns stored without tz info.
    now_utc_naive = datetime.utcnow()
    month_start = now_utc_naive.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_stmt = select(func.count(Meeting.id)).where(Meeting.created_at >= month_start)
    month_result = await session.execute(month_stmt)
    this_month = month_result.scalar_one()

    return MeetingStats(
        total_meetings=total,
        tasks_from_meetings=tasks_from,
        meetings_this_month=this_month,
    )
