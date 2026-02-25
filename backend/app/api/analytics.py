import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, require_moderator
from app.db.database import get_session
from app.db.models import Department, Meeting, Task, TaskUpdate, TeamMember
from app.services.task_visibility_service import (
    get_headed_department_ids,
    resolve_visible_department_ids,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])

TASK_CLOSED_STATUSES = ["done", "cancelled"]
TASK_EXCLUDED_FROM_TOTAL_STATUSES = ["cancelled"]
BOARD_STATUS_ORDER = [
    ("new", "Новые"),
    ("in_progress", "В работе"),
    ("review", "Ревью"),
    ("done", "Готово"),
]
MONTH_SHORT_RU = {
    1: "Янв",
    2: "Фев",
    3: "Мар",
    4: "Апр",
    5: "Май",
    6: "Июн",
    7: "Июл",
    8: "Авг",
    9: "Сен",
    10: "Окт",
    11: "Ноя",
    12: "Дек",
}


class BoardColumnStats(BaseModel):
    key: str
    label: str
    count: int
    share_percent: int


class MonthlyFlowPoint(BaseModel):
    month: str
    label: str
    created: int
    completed: int


class DepartmentBreakdownItem(BaseModel):
    department_id: uuid.UUID
    department_name: str
    department_color: str | None
    total_tasks: int
    active_tasks: int
    overdue_tasks: int
    done_week: int


class OverviewResponse(BaseModel):
    total_tasks: int
    active_tasks: int
    completion_rate: int
    tasks_done_week: int
    tasks_new: int
    tasks_in_progress: int
    tasks_review: int
    tasks_done: int
    tasks_cancelled: int
    tasks_overdue: int
    total_meetings: int
    total_members: int
    selected_department_id: uuid.UUID | None
    board_columns: list[BoardColumnStats]
    monthly_flow: list[MonthlyFlowPoint]
    departments: list[DepartmentBreakdownItem]
    tasks_by_source: dict[str, int]
    tasks_by_priority: dict[str, int]


class MemberStats(BaseModel):
    id: str
    full_name: str
    avatar_url: str | None
    role: str
    department_name: str | None
    department_color: str | None
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


class DashboardTaskMetrics(BaseModel):
    active: int
    new: int
    in_progress: int
    review: int
    overdue: int
    done_total: int
    done_week: int


class DashboardTasksMeta(BaseModel):
    selected_department_id: uuid.UUID | None
    can_view_department: bool
    is_department_head: bool


class DashboardTasksResponse(BaseModel):
    my: DashboardTaskMetrics
    department: DashboardTaskMetrics
    meta: DashboardTasksMeta


def _empty_dashboard_task_metrics() -> DashboardTaskMetrics:
    return DashboardTaskMetrics(
        active=0,
        new=0,
        in_progress=0,
        review=0,
        overdue=0,
        done_total=0,
        done_week=0,
    )


def _shift_month(month_start: datetime, delta: int) -> datetime:
    month_index = month_start.month - 1 + delta
    year = month_start.year + month_index // 12
    month = month_index % 12 + 1
    return month_start.replace(year=year, month=month, day=1)


def _apply_task_scope(stmt, *, filters: list[object], with_assignee_join: bool):
    if with_assignee_join:
        stmt = stmt.join(Task.assignee)
    if filters:
        stmt = stmt.where(*filters)
    return stmt


def _resolve_overview_scope(
    member: TeamMember,
    visible_department_ids: list[uuid.UUID] | None,
    requested_department_id: uuid.UUID | None,
) -> tuple[uuid.UUID | None, list[object], bool]:
    if requested_department_id is not None:
        selected_department_id = requested_department_id
    elif visible_department_ids is None:
        selected_department_id = None
    else:
        selected_department_id = member.department_id

    scope_filters: list[object] = []
    scope_needs_assignee_join = False

    if selected_department_id is not None:
        scope_filters.append(TeamMember.department_id == selected_department_id)
        scope_needs_assignee_join = True
    elif visible_department_ids is None:
        pass
    elif visible_department_ids:
        scope_filters.append(TeamMember.department_id.in_(visible_department_ids))
        scope_needs_assignee_join = True
    else:
        scope_filters.append(Task.assignee_id == member.id)

    return selected_department_id, scope_filters, scope_needs_assignee_join


async def _collect_task_metrics(
    session: AsyncSession,
    *filters,
    with_assignee_join: bool = False,
) -> DashboardTaskMetrics:
    today = date.today()
    week_ago = datetime.utcnow() - timedelta(days=7)

    stmt = select(
        func.count(case((Task.status.notin_(TASK_CLOSED_STATUSES), Task.id))).label(
            "active"
        ),
        func.count(case((Task.status == "new", Task.id))).label("new"),
        func.count(case((Task.status == "in_progress", Task.id))).label("in_progress"),
        func.count(case((Task.status == "review", Task.id))).label("review"),
        func.count(
            case((
                (Task.deadline < today) & Task.status.notin_(TASK_CLOSED_STATUSES),
                Task.id,
            ))
        ).label("overdue"),
        func.count(case((Task.status == "done", Task.id))).label("done_total"),
        func.count(
            case((
                (Task.status == "done")
                & Task.completed_at.is_not(None)
                & (Task.completed_at >= week_ago),
                Task.id,
            ))
        ).label("done_week"),
    )

    if with_assignee_join:
        stmt = stmt.join(Task.assignee)
    if filters:
        stmt = stmt.where(*filters)

    row = (await session.execute(stmt)).one()
    return DashboardTaskMetrics(
        active=int(row.active or 0),
        new=int(row.new or 0),
        in_progress=int(row.in_progress or 0),
        review=int(row.review or 0),
        overdue=int(row.overdue or 0),
        done_total=int(row.done_total or 0),
        done_week=int(row.done_week or 0),
    )


@router.get("/dashboard-tasks", response_model=DashboardTasksResponse)
async def analytics_dashboard_tasks(
    department_id: uuid.UUID | None = Query(None),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get dashboard task metrics for current member and selected department."""
    visible_department_ids = await resolve_visible_department_ids(session, member)

    if (
        department_id is not None
        and visible_department_ids is not None
        and department_id not in visible_department_ids
    ):
        raise HTTPException(
            status_code=403,
            detail="Нет доступа к задачам выбранного отдела",
        )

    selected_department_id = department_id or member.department_id
    my_metrics = await _collect_task_metrics(session, Task.assignee_id == member.id)

    can_view_department = False
    is_department_head = False
    department_metrics = _empty_dashboard_task_metrics()

    if selected_department_id is not None:
        can_view_department = (
            visible_department_ids is None
            or selected_department_id in visible_department_ids
        )

        headed_department_ids = await get_headed_department_ids(session, member.id)
        is_department_head = selected_department_id in headed_department_ids

        if can_view_department:
            department_metrics = await _collect_task_metrics(
                session,
                TeamMember.department_id == selected_department_id,
                with_assignee_join=True,
            )

    return DashboardTasksResponse(
        my=my_metrics,
        department=department_metrics,
        meta=DashboardTasksMeta(
            selected_department_id=selected_department_id,
            can_view_department=can_view_department,
            is_department_head=is_department_head,
        ),
    )


@router.get("/overview", response_model=OverviewResponse)
async def analytics_overview(
    department_id: uuid.UUID | None = Query(None),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get analytics overview with department-aware task scope."""
    today = date.today()
    week_ago = datetime.utcnow() - timedelta(days=7)
    visible_department_ids = await resolve_visible_department_ids(session, member)

    if (
        department_id is not None
        and visible_department_ids is not None
        and department_id not in visible_department_ids
    ):
        raise HTTPException(
            status_code=403,
            detail="Нет доступа к задачам выбранного отдела",
        )

    selected_department_id, scope_filters, scope_needs_assignee_join = (
        _resolve_overview_scope(member, visible_department_ids, department_id)
    )

    status_stmt = _apply_task_scope(
        select(Task.status, func.count(Task.id)).group_by(Task.status),
        filters=scope_filters,
        with_assignee_join=scope_needs_assignee_join,
    )
    status_result = await session.execute(status_stmt)
    status_counts = {row.status: int(row[1] or 0) for row in status_result.all()}

    tasks_cancelled = int(status_counts.get("cancelled", 0))
    total_tasks = int(
        sum(
            int(count or 0)
            for status, count in status_counts.items()
            if status not in TASK_EXCLUDED_FROM_TOTAL_STATUSES
        )
    )

    overdue_stmt = _apply_task_scope(
        select(func.count(Task.id)).where(
            Task.deadline < today,
            Task.status.notin_(TASK_CLOSED_STATUSES),
        ),
        filters=scope_filters,
        with_assignee_join=scope_needs_assignee_join,
    )
    tasks_overdue = int((await session.execute(overdue_stmt)).scalar_one() or 0)

    source_stmt = _apply_task_scope(
        select(Task.source, func.count(Task.id)).group_by(Task.source),
        filters=scope_filters,
        with_assignee_join=scope_needs_assignee_join,
    )
    source_result = await session.execute(source_stmt)
    tasks_by_source = {row.source: int(row[1] or 0) for row in source_result.all()}

    priority_stmt = _apply_task_scope(
        select(Task.priority, func.count(Task.id)).group_by(Task.priority),
        filters=scope_filters,
        with_assignee_join=scope_needs_assignee_join,
    )
    priority_result = await session.execute(priority_stmt)
    tasks_by_priority = {row.priority: int(row[1] or 0) for row in priority_result.all()}

    done_week_stmt = _apply_task_scope(
        select(func.count(Task.id)).where(
            Task.status == "done",
            Task.completed_at.is_not(None),
            Task.completed_at >= week_ago,
        ),
        filters=scope_filters,
        with_assignee_join=scope_needs_assignee_join,
    )
    tasks_done_week = int((await session.execute(done_week_stmt)).scalar_one() or 0)

    meetings_stmt = select(func.count(Meeting.id))
    total_meetings = int((await session.execute(meetings_stmt)).scalar_one() or 0)

    members_stmt = select(func.count(TeamMember.id)).where(
        TeamMember.is_active.is_(True),
        TeamMember.is_test.is_(False),
    )
    if selected_department_id is not None:
        members_stmt = members_stmt.where(TeamMember.department_id == selected_department_id)
    elif visible_department_ids is not None:
        if visible_department_ids:
            members_stmt = members_stmt.where(
                TeamMember.department_id.in_(visible_department_ids)
            )
        else:
            members_stmt = members_stmt.where(TeamMember.id == member.id)
    total_members = int((await session.execute(members_stmt)).scalar_one() or 0)

    tasks_done = int(status_counts.get("done", 0))
    active_tasks = int(
        sum(
            int(count or 0)
            for status, count in status_counts.items()
            if status not in TASK_CLOSED_STATUSES
        )
    )
    completion_rate = round((tasks_done / total_tasks) * 100) if total_tasks > 0 else 0

    board_columns = [
        BoardColumnStats(
            key=status_key,
            label=label,
            count=int(status_counts.get(status_key, 0)),
            share_percent=(
                round((int(status_counts.get(status_key, 0)) / total_tasks) * 100)
                if total_tasks > 0
                else 0
            ),
        )
        for status_key, label in BOARD_STATUS_ORDER
    ]

    month_anchor = datetime.utcnow().replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    month_window_start = _shift_month(month_anchor, -5)

    created_bucket = func.date_trunc("month", Task.created_at)
    created_stmt = _apply_task_scope(
        select(created_bucket.label("bucket"), func.count(Task.id).label("count"))
        .where(
            Task.created_at >= month_window_start,
            Task.status.notin_(TASK_EXCLUDED_FROM_TOTAL_STATUSES),
        )
        .group_by(created_bucket)
        .order_by(created_bucket),
        filters=scope_filters,
        with_assignee_join=scope_needs_assignee_join,
    )
    created_rows = (await session.execute(created_stmt)).all()
    created_by_month = {
        row.bucket.strftime("%Y-%m"): int(row.count or 0)
        for row in created_rows
    }

    completed_bucket = func.date_trunc("month", Task.completed_at)
    completed_stmt = _apply_task_scope(
        select(completed_bucket.label("bucket"), func.count(Task.id).label("count"))
        .where(
            Task.status == "done",
            Task.completed_at.is_not(None),
            Task.completed_at >= month_window_start,
        )
        .group_by(completed_bucket)
        .order_by(completed_bucket),
        filters=scope_filters,
        with_assignee_join=scope_needs_assignee_join,
    )
    completed_rows = (await session.execute(completed_stmt)).all()
    completed_by_month = {
        row.bucket.strftime("%Y-%m"): int(row.count or 0)
        for row in completed_rows
    }

    monthly_flow: list[MonthlyFlowPoint] = []
    for offset in range(-5, 1):
        month_point = _shift_month(month_anchor, offset)
        month_key = month_point.strftime("%Y-%m")
        monthly_flow.append(
            MonthlyFlowPoint(
                month=month_key,
                label=f"{MONTH_SHORT_RU[month_point.month]} {str(month_point.year)[2:]}",
                created=created_by_month.get(month_key, 0),
                completed=completed_by_month.get(month_key, 0),
            )
        )

    departments: list[DepartmentBreakdownItem] = []
    if selected_department_id is not None or visible_department_ids is None or visible_department_ids:
        total_case = case((Task.status.notin_(TASK_EXCLUDED_FROM_TOTAL_STATUSES), Task.id))
        active_case = case((Task.status.notin_(TASK_CLOSED_STATUSES), Task.id))
        overdue_case = case((
            (Task.deadline < today) & Task.status.notin_(TASK_CLOSED_STATUSES),
            Task.id,
        ))
        done_week_case = case((
            (Task.status == "done")
            & Task.completed_at.is_not(None)
            & (Task.completed_at >= week_ago),
            Task.id,
        ))

        departments_stmt = (
            select(
                Department.id.label("department_id"),
                Department.name.label("department_name"),
                Department.color.label("department_color"),
                func.count(total_case).label("total_tasks"),
                func.count(active_case).label("active_tasks"),
                func.count(overdue_case).label("overdue_tasks"),
                func.count(done_week_case).label("done_week"),
            )
            .select_from(Department)
            .outerjoin(TeamMember, TeamMember.department_id == Department.id)
            .outerjoin(Task, Task.assignee_id == TeamMember.id)
            .where(Department.is_active.is_(True))
            .group_by(Department.id, Department.name, Department.color)
            .order_by(
                func.count(active_case).desc(),
                func.count(overdue_case).desc(),
                Department.name.asc(),
            )
        )

        if selected_department_id is not None:
            departments_stmt = departments_stmt.where(Department.id == selected_department_id)
        elif visible_department_ids is not None:
            departments_stmt = departments_stmt.where(
                Department.id.in_(visible_department_ids)
            )

        department_rows = (await session.execute(departments_stmt)).all()
        departments = [
            DepartmentBreakdownItem(
                department_id=row.department_id,
                department_name=row.department_name,
                department_color=row.department_color,
                total_tasks=int(row.total_tasks or 0),
                active_tasks=int(row.active_tasks or 0),
                overdue_tasks=int(row.overdue_tasks or 0),
                done_week=int(row.done_week or 0),
            )
            for row in department_rows
        ]

    return OverviewResponse(
        total_tasks=total_tasks,
        active_tasks=active_tasks,
        completion_rate=int(completion_rate),
        tasks_done_week=tasks_done_week,
        tasks_new=status_counts.get("new", 0),
        tasks_in_progress=status_counts.get("in_progress", 0),
        tasks_review=status_counts.get("review", 0),
        tasks_done=tasks_done,
        tasks_cancelled=tasks_cancelled,
        tasks_overdue=tasks_overdue,
        total_meetings=total_meetings,
        total_members=total_members,
        selected_department_id=selected_department_id,
        board_columns=board_columns,
        monthly_flow=monthly_flow,
        departments=departments,
        tasks_by_source=tasks_by_source,
        tasks_by_priority=tasks_by_priority,
    )


@router.get("/members", response_model=MembersAnalyticsResponse)
async def analytics_members(
    department_id: uuid.UUID | None = Query(None),
    _member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Get per-member analytics. Can be filtered by department."""
    today = date.today()

    members_stmt = (
        select(
            TeamMember,
            Department.name.label("department_name"),
            Department.color.label("department_color"),
        )
        .outerjoin(Department, TeamMember.department_id == Department.id)
        .where(
            TeamMember.is_active.is_(True),
            TeamMember.is_test.is_(False),
        )
        .order_by(TeamMember.full_name.asc())
    )
    if department_id is not None:
        members_stmt = members_stmt.where(TeamMember.department_id == department_id)

    member_rows = (await session.execute(members_stmt)).all()
    if not member_rows:
        return MembersAnalyticsResponse(members=[])

    member_ids = [m.id for m, _, _ in member_rows]

    task_stats_stmt = select(
        Task.assignee_id,
        func.count(Task.id).label("total"),
        func.count(case((Task.status == "done", Task.id))).label("done"),
        func.count(case((Task.status == "in_progress", Task.id))).label("in_progress"),
        func.count(
            case((
                (Task.deadline < today) & Task.status.notin_(TASK_CLOSED_STATUSES),
                Task.id,
            ))
        ).label("overdue"),
    )
    if department_id is not None:
        task_stats_stmt = task_stats_stmt.join(Task.assignee).where(
            TeamMember.department_id == department_id,
            TeamMember.is_test.is_(False),
        )
    task_stats_stmt = task_stats_stmt.group_by(Task.assignee_id)

    task_stats_result = await session.execute(task_stats_stmt)
    stats_by_assignee = {
        row.assignee_id: row
        for row in task_stats_result.all()
    }

    last_update_stmt = (
        select(
            TaskUpdate.author_id,
            func.max(TaskUpdate.created_at).label("last_update"),
        )
        .where(TaskUpdate.author_id.in_(member_ids))
        .group_by(TaskUpdate.author_id)
    )
    last_update_result = await session.execute(last_update_stmt)
    last_updates = {row.author_id: row.last_update for row in last_update_result.all()}

    member_stats = []
    for m, department_name, department_color in member_rows:
        row = stats_by_assignee.get(m.id)
        member_stats.append(
            MemberStats(
                id=str(m.id),
                full_name=m.full_name,
                avatar_url=m.avatar_url,
                role=m.role,
                department_name=department_name,
                department_color=department_color,
                total_tasks=int(row.total or 0) if row else 0,
                tasks_done=int(row.done or 0) if row else 0,
                tasks_in_progress=int(row.in_progress or 0) if row else 0,
                tasks_overdue=int(row.overdue or 0) if row else 0,
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
