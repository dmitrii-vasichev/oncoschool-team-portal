# Dashboard Task Activity Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the dashboard task row so overdue tasks are grouped inside the main task block and the former completed-week card becomes a scoped activity card with drill-down task lists.

**Architecture:** Keep task visibility centralized on the backend by adding a dashboard activity analytics endpoint that calculates counts and task detail lists for the selected scope. Keep the frontend dashboard as the composition layer: it requests scoped task lists, groups open tasks into overdue and active sections, and renders activity metrics as inline toggle buttons. Reuse existing task cards, dashboard ordering helpers, and role-aware department access rules.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic, Next.js App Router, React, TypeScript, Tailwind, Node test runner, pytest.

---

## File Map

- Modify `backend/app/api/analytics.py`
  - Add dashboard activity response models.
  - Add scope resolution for `my`, `department`, and `team`.
  - Add `/api/analytics/dashboard-activity` with backend-side counts and drill-down task lists.
  - Calculate `in_progress > 7 days` from `task_updates`, not `updated_at`.
- Create `backend/tests/test_dashboard_activity_api.py`
  - Cover scope permissions, activity metric definitions, and in-progress transition handling.
- Modify `frontend/src/lib/types.ts`
  - Add dashboard activity TypeScript types.
- Modify `frontend/src/lib/api.ts`
  - Add `getDashboardActivity`.
  - Allow task dashboard callers to request team scope without a department filter.
- Modify `frontend/src/lib/dashboardTaskUtils.ts`
  - Add helper to split open tasks into overdue and active groups.
  - Keep existing sorting helpers.
- Modify `frontend/src/lib/dashboardTaskUtils.test.ts`
  - Cover overdue/active grouping and no duplicate task IDs.
- Modify `frontend/src/app/dashboardCompletedWeekCard.test.ts`
  - Replace old completed-week source guard with activity-card/source-structure guards.
- Modify `frontend/src/app/page.tsx`
  - Add `team` dashboard scope for admin/moderator users.
  - Render one large task block with `Просрочено` and `Активные` groups.
  - Replace the completed-week task block with an inline activity card.
- Modify `docs/STATUS.md`
  - Record implementation progress and verification results.

## Task 1: Backend Activity Contract Tests

**Files:**
- Create: `backend/tests/test_dashboard_activity_api.py`
- Later task modifies: `backend/app/api/analytics.py`

- [ ] **Step 1: Write failing backend tests**

Create `backend/tests/test_dashboard_activity_api.py` with these tests:

```python
import unittest
import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.api import analytics as analytics_api


class DashboardActivityApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_team_scope_requires_moderator(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="member", department_id=uuid.uuid4())
        session = SimpleNamespace()

        with patch.object(
            analytics_api,
            "resolve_visible_department_ids",
            AsyncMock(return_value=[member.department_id]),
        ):
            with self.assertRaises(analytics_api.HTTPException) as ctx:
                await analytics_api.analytics_dashboard_activity(
                    scope="team",
                    department_id=None,
                    detail_limit=20,
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 403)

    async def test_department_scope_requires_access(self) -> None:
        allowed_department_id = uuid.uuid4()
        requested_department_id = uuid.uuid4()
        member = SimpleNamespace(id=uuid.uuid4(), role="member", department_id=allowed_department_id)
        session = SimpleNamespace()

        with patch.object(
            analytics_api,
            "resolve_visible_department_ids",
            AsyncMock(return_value=[allowed_department_id]),
        ):
            with self.assertRaises(analytics_api.HTTPException) as ctx:
                await analytics_api.analytics_dashboard_activity(
                    scope="department",
                    department_id=requested_department_id,
                    detail_limit=20,
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 403)

    def test_latest_in_progress_transition_uses_status_history(self) -> None:
        latest = analytics_api._latest_in_progress_transition_by_task(
            [
                SimpleNamespace(task_id="a", new_status="in_progress", update_type="status_change", created_at=datetime(2026, 5, 1, 9, 0)),
                SimpleNamespace(task_id="a", new_status="review", update_type="status_change", created_at=datetime(2026, 5, 2, 9, 0)),
                SimpleNamespace(task_id="a", new_status="in_progress", update_type="status_change", created_at=datetime(2026, 5, 3, 9, 0)),
                SimpleNamespace(task_id="b", new_status="in_progress", update_type="progress", created_at=datetime(2026, 5, 1, 9, 0)),
                SimpleNamespace(task_id="c", new_status="done", update_type="status_change", created_at=datetime(2026, 5, 4, 9, 0)),
            ]
        )

        self.assertEqual(latest, {"a": datetime(2026, 5, 3, 9, 0)})

    def test_in_progress_more_than_seven_days_excludes_tasks_without_transition(self) -> None:
        now = datetime(2026, 5, 8, 12, 0)
        tasks = [
            SimpleNamespace(id="old", status="in_progress"),
            SimpleNamespace(id="recent", status="in_progress"),
            SimpleNamespace(id="missing", status="in_progress"),
            SimpleNamespace(id="new", status="new"),
        ]
        transitions = {
            "old": now - timedelta(days=8),
            "recent": now - timedelta(days=2),
        }

        stale = analytics_api._filter_in_progress_more_than_seven_days(
            tasks,
            transitions,
            now=now,
        )

        self.assertEqual([task.id for task in stale], ["old"])

    async def test_activity_response_uses_counts_from_collectors(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="moderator", department_id=None)
        session = SimpleNamespace()

        with patch.object(
            analytics_api,
            "resolve_visible_department_ids",
            AsyncMock(return_value=None),
        ), patch.object(
            analytics_api,
            "_load_dashboard_activity_tasks",
            AsyncMock(
                side_effect=[
                    [],
                    [],
                ]
            ),
        ), patch.object(
            analytics_api,
            "_count_dashboard_activity_tasks",
            AsyncMock(side_effect=[1, 1, 4, 2]),
        ), patch.object(
            analytics_api,
            "_load_in_progress_over_seven_days_tasks",
            AsyncMock(return_value=[]),
        ), patch.object(
            analytics_api,
            "_count_in_progress_over_seven_days_tasks",
            AsyncMock(return_value=1),
        ):
            response = await analytics_api.analytics_dashboard_activity(
                scope="team",
                department_id=None,
                detail_limit=20,
                member=member,
                session=session,
            )

        self.assertEqual(response.scope, "team")
        self.assertEqual(response.completed.count, 1)
        self.assertEqual(response.created.count, 1)
        self.assertEqual(response.in_progress_over_7_days.count, 1)
        self.assertEqual(response.completed_delta.current, 4)
        self.assertEqual(response.completed_delta.previous, 2)
        self.assertEqual(response.completed_delta.delta, 2)
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_dashboard_activity_api.py -q
```

Expected: FAIL because `analytics_dashboard_activity`, `_latest_in_progress_transition_by_task`, `_filter_in_progress_more_than_seven_days`, `_load_dashboard_activity_tasks`, `_count_dashboard_activity_tasks`, `_load_in_progress_over_seven_days_tasks`, and `_count_in_progress_over_seven_days_tasks` do not exist yet.

## Task 2: Backend Activity Endpoint

**Files:**
- Modify: `backend/app/api/analytics.py`
- Test: `backend/tests/test_dashboard_activity_api.py`

- [ ] **Step 1: Add response models and pure helpers**

In `backend/app/api/analytics.py`, extend imports:

```python
from typing import Literal
from sqlalchemy.orm import selectinload
```

Add these models after `DashboardTasksResponse`:

```python
DashboardActivityScope = Literal["my", "department", "team"]


class DashboardActivityMetric(BaseModel):
    count: int
    tasks: list[TaskResponse]
    truncated: bool = False


class DashboardActivityDelta(BaseModel):
    current: int
    previous: int
    delta: int


class DashboardActivityResponse(BaseModel):
    scope: DashboardActivityScope
    selected_department_id: uuid.UUID | None
    completed: DashboardActivityMetric
    created: DashboardActivityMetric
    in_progress_over_7_days: DashboardActivityMetric
    completed_delta: DashboardActivityDelta
```

Import `TaskResponse` near the existing model imports:

```python
from app.db.schemas import TaskResponse
```

Add pure helpers below `_resolve_overview_scope`:

```python
def _latest_in_progress_transition_by_task(updates: list[object]) -> dict[object, datetime]:
    latest: dict[object, datetime] = {}
    for update in updates:
        if getattr(update, "update_type", None) != "status_change":
            continue
        if getattr(update, "new_status", None) != "in_progress":
            continue
        task_id = getattr(update, "task_id", None)
        created_at = getattr(update, "created_at", None)
        if task_id is None or created_at is None:
            continue
        if task_id not in latest or created_at > latest[task_id]:
            latest[task_id] = created_at
    return latest


def _filter_in_progress_more_than_seven_days(
    tasks: list[Task],
    transitions: dict[object, datetime],
    *,
    now: datetime | None = None,
) -> list[Task]:
    reference = now or datetime.utcnow()
    cutoff = reference - timedelta(days=7)
    stale: list[Task] = []
    for task in tasks:
        if getattr(task, "status", None) != "in_progress":
            continue
        transition_at = transitions.get(getattr(task, "id", None))
        if transition_at is not None and transition_at < cutoff:
            stale.append(task)
    return stale
```

- [ ] **Step 2: Add scope resolver**

Add below the pure helpers:

```python
def _dashboard_activity_scope_filters(
    *,
    member: TeamMember,
    visible_department_ids: list[uuid.UUID] | None,
    scope: DashboardActivityScope,
    department_id: uuid.UUID | None,
) -> tuple[list[object], bool, uuid.UUID | None]:
    if scope == "team":
        if visible_department_ids is not None:
            raise HTTPException(status_code=403, detail="Нет доступа к задачам команды")
        return [], False, None

    if scope == "my":
        return [Task.assignee_id == member.id], False, None

    selected_department_id = department_id or member.department_id
    if selected_department_id is None:
        return [Task.assignee_id == member.id], False, None
    if visible_department_ids is not None and selected_department_id not in visible_department_ids:
        raise HTTPException(status_code=403, detail="Нет доступа к задачам выбранного отдела")
    return [TeamMember.department_id == selected_department_id], True, selected_department_id
```

- [ ] **Step 3: Add backend query helpers**

Add below `_collect_task_metrics`:

```python
async def _count_dashboard_activity_tasks(
    session: AsyncSession,
    *,
    base_filters: list[object],
    with_assignee_join: bool,
    extra_filters: list[object],
) -> int:
    stmt = select(func.count(Task.id))
    if with_assignee_join:
        stmt = stmt.join(Task.assignee)
    stmt = stmt.where(*base_filters, *extra_filters)
    return int((await session.execute(stmt)).scalar_one() or 0)


async def _load_dashboard_activity_tasks(
    session: AsyncSession,
    *,
    base_filters: list[object],
    with_assignee_join: bool,
    extra_filters: list[object],
    order_by,
    limit: int,
) -> list[Task]:
    stmt = select(Task)
    if with_assignee_join:
        stmt = stmt.join(Task.assignee)
    stmt = (
        stmt.where(*base_filters, *extra_filters)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.created_by),
            selectinload(Task.labels),
        )
        .order_by(order_by)
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
```

Add an SQL helper for stale in-progress tasks:

```python
def _latest_in_progress_subquery():
    return (
        select(
            TaskUpdate.task_id.label("task_id"),
            func.max(TaskUpdate.created_at).label("in_progress_since"),
        )
        .where(
            TaskUpdate.update_type == "status_change",
            TaskUpdate.new_status == "in_progress",
        )
        .group_by(TaskUpdate.task_id)
        .subquery()
    )
```

Add stale in-progress loaders:

```python
async def _count_in_progress_over_seven_days_tasks(
    session: AsyncSession,
    *,
    base_filters: list[object],
    with_assignee_join: bool,
    cutoff: datetime,
) -> int:
    latest_in_progress = _latest_in_progress_subquery()
    stmt = select(func.count(Task.id)).join(
        latest_in_progress,
        latest_in_progress.c.task_id == Task.id,
    )
    if with_assignee_join:
        stmt = stmt.join(Task.assignee)
    stmt = stmt.where(
        *base_filters,
        Task.status == "in_progress",
        latest_in_progress.c.in_progress_since < cutoff,
    )
    return int((await session.execute(stmt)).scalar_one() or 0)


async def _load_in_progress_over_seven_days_tasks(
    session: AsyncSession,
    *,
    base_filters: list[object],
    with_assignee_join: bool,
    cutoff: datetime,
    limit: int,
) -> list[Task]:
    latest_in_progress = _latest_in_progress_subquery()
    stmt = select(Task).join(
        latest_in_progress,
        latest_in_progress.c.task_id == Task.id,
    )
    if with_assignee_join:
        stmt = stmt.join(Task.assignee)
    stmt = (
        stmt.where(
            *base_filters,
            Task.status == "in_progress",
            latest_in_progress.c.in_progress_since < cutoff,
        )
        .options(
            selectinload(Task.assignee),
            selectinload(Task.created_by),
            selectinload(Task.labels),
        )
        .order_by(latest_in_progress.c.in_progress_since.asc(), Task.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
```

- [ ] **Step 4: Add `/dashboard-activity` endpoint**

Add below `analytics_dashboard_tasks`:

```python
@router.get("/dashboard-activity", response_model=DashboardActivityResponse)
async def analytics_dashboard_activity(
    scope: DashboardActivityScope = Query("my"),
    department_id: uuid.UUID | None = Query(None),
    detail_limit: int = Query(20, ge=1, le=50),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get scoped dashboard activity counts and inline drill-down task lists."""
    visible_department_ids = await resolve_visible_department_ids(session, member)
    base_filters, with_assignee_join, selected_department_id = _dashboard_activity_scope_filters(
        member=member,
        visible_department_ids=visible_department_ids,
        scope=scope,
        department_id=department_id,
    )
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    previous_week_start = now - timedelta(days=14)

    completed_filters = [
        Task.status == "done",
        Task.completed_at.is_not(None),
        Task.completed_at >= week_ago,
    ]
    created_filters = [
        Task.created_at >= week_ago,
        Task.status.notin_(TASK_EXCLUDED_FROM_TOTAL_STATUSES),
    ]

    completed_count = await _count_dashboard_activity_tasks(
        session,
        base_filters=base_filters,
        with_assignee_join=with_assignee_join,
        extra_filters=completed_filters,
    )
    created_count = await _count_dashboard_activity_tasks(
        session,
        base_filters=base_filters,
        with_assignee_join=with_assignee_join,
        extra_filters=created_filters,
    )
    completed_tasks = await _load_dashboard_activity_tasks(
        session,
        base_filters=base_filters,
        with_assignee_join=with_assignee_join,
        extra_filters=completed_filters,
        order_by=Task.completed_at.desc().nullslast(),
        limit=detail_limit,
    )
    created_tasks = await _load_dashboard_activity_tasks(
        session,
        base_filters=base_filters,
        with_assignee_join=with_assignee_join,
        extra_filters=created_filters,
        order_by=Task.created_at.desc(),
        limit=detail_limit,
    )

    stale_count = await _count_in_progress_over_seven_days_tasks(
        session,
        base_filters=base_filters,
        with_assignee_join=with_assignee_join,
        cutoff=week_ago,
    )
    stale_tasks = await _load_in_progress_over_seven_days_tasks(
        session,
        base_filters=base_filters,
        with_assignee_join=with_assignee_join,
        cutoff=week_ago,
        limit=detail_limit,
    )

    current_completed = await _count_dashboard_activity_tasks(
        session,
        base_filters=base_filters,
        with_assignee_join=with_assignee_join,
        extra_filters=completed_filters,
    )
    previous_completed = await _count_dashboard_activity_tasks(
        session,
        base_filters=base_filters,
        with_assignee_join=with_assignee_join,
        extra_filters=[
            Task.status == "done",
            Task.completed_at.is_not(None),
            Task.completed_at >= previous_week_start,
            Task.completed_at < week_ago,
        ],
    )

    return DashboardActivityResponse(
        scope=scope,
        selected_department_id=selected_department_id,
        completed=DashboardActivityMetric(
            count=completed_count,
            tasks=completed_tasks,
            truncated=completed_count > len(completed_tasks),
        ),
        created=DashboardActivityMetric(
            count=created_count,
            tasks=created_tasks,
            truncated=created_count > len(created_tasks),
        ),
        in_progress_over_7_days=DashboardActivityMetric(
            count=stale_count,
            tasks=stale_tasks,
            truncated=stale_count > len(stale_tasks),
        ),
        completed_delta=DashboardActivityDelta(
            current=current_completed,
            previous=previous_completed,
            delta=current_completed - previous_completed,
        ),
    )
```

- [ ] **Step 5: Run backend tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_dashboard_activity_api.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit backend activity API**

```bash
git add backend/app/api/analytics.py backend/tests/test_dashboard_activity_api.py
git commit -m "Add dashboard activity analytics API"
```

## Task 3: Dashboard Task Grouping Helpers

**Files:**
- Modify: `frontend/src/lib/dashboardTaskUtils.ts`
- Modify: `frontend/src/lib/dashboardTaskUtils.test.ts`

- [ ] **Step 1: Add failing frontend helper tests**

In `frontend/src/lib/dashboardTaskUtils.test.ts`, extend the import:

```ts
  splitDashboardOpenTasks,
```

Add this test after the active sorting test:

```ts
test("splitDashboardOpenTasks separates overdue tasks without duplicating ids", () => {
  const today = new Date("2026-05-08T12:00:00.000Z");
  const tasks = [
    task({ id: "normal", deadline: "2026-05-10" }),
    task({ id: "overdue", deadline: "2026-05-01" }),
    task({ id: "done-overdue", status: "done", deadline: "2026-05-01" }),
    task({ id: "cancelled-overdue", status: "cancelled", deadline: "2026-05-01" }),
  ];

  const grouped = splitDashboardOpenTasks(tasks, today);

  assert.deepEqual(grouped.overdue.map((item) => item.id), ["overdue"]);
  assert.deepEqual(grouped.active.map((item) => item.id), ["normal"]);
  assert.deepEqual(
    [...grouped.overdue, ...grouped.active].map((item) => item.id),
    ["overdue", "normal"],
  );
});
```

- [ ] **Step 2: Run helper tests to verify failure**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/dashboardTaskUtils.test.ts
```

Expected: FAIL because `splitDashboardOpenTasks` is not exported.

- [ ] **Step 3: Implement grouping helper**

In `frontend/src/lib/dashboardTaskUtils.ts`, export this type and helper near the sorting helpers:

```ts
export type DashboardOpenTaskGroups<T> = {
  overdue: T[];
  active: T[];
};

export function splitDashboardOpenTasks<T extends DashboardTaskLike>(
  tasks: T[],
  today = new Date(),
): DashboardOpenTaskGroups<T> {
  const overdue: T[] = [];
  const active: T[] = [];

  for (const task of tasks) {
    if (task.status === "done" || task.status === "cancelled") {
      continue;
    }
    if (isTaskOverdueForSort(task, today)) {
      overdue.push(task);
    } else {
      active.push(task);
    }
  }

  return {
    overdue: sortDashboardOverdueTasks(overdue),
    active: sortDashboardActiveTasks(active, today),
  };
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/dashboardTaskUtils.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helper**

```bash
git add frontend/src/lib/dashboardTaskUtils.ts frontend/src/lib/dashboardTaskUtils.test.ts
git commit -m "Add dashboard open task grouping helper"
```

## Task 4: Frontend Activity Types and API Client

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add activity types**

In `frontend/src/lib/types.ts`, after `DashboardTasksAnalytics`, add:

```ts
export type DashboardActivityScope = "my" | "department" | "team";

export interface DashboardActivityMetric {
  count: number;
  tasks: Task[];
  truncated: boolean;
}

export interface DashboardActivityDelta {
  current: number;
  previous: number;
  delta: number;
}

export interface DashboardActivityAnalytics {
  scope: DashboardActivityScope;
  selected_department_id: string | null;
  completed: DashboardActivityMetric;
  created: DashboardActivityMetric;
  in_progress_over_7_days: DashboardActivityMetric;
  completed_delta: DashboardActivityDelta;
}
```

- [ ] **Step 2: Add API import and method**

In `frontend/src/lib/api.ts`, add `DashboardActivityAnalytics` and `DashboardActivityScope` to the type import list.

Add this method after `getDashboardTasksAnalytics`:

```ts
  async getDashboardActivity(params: {
    scope: DashboardActivityScope;
    departmentId?: string;
    detailLimit?: number;
  }): Promise<DashboardActivityAnalytics> {
    const searchParams = new URLSearchParams();
    searchParams.set("scope", params.scope);
    if (params.departmentId) {
      searchParams.set("department_id", params.departmentId);
    }
    if (params.detailLimit) {
      searchParams.set("detail_limit", String(params.detailLimit));
    }
    return this.request<DashboardActivityAnalytics>(
      `/api/analytics/dashboard-activity?${searchParams.toString()}`,
    );
  }
```

- [ ] **Step 3: Run TypeScript**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit API types**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "Add dashboard activity frontend contract"
```

## Task 5: Dashboard Source Guards for New Layout

**Files:**
- Modify: `frontend/src/app/dashboardCompletedWeekCard.test.ts`
- Later task modifies: `frontend/src/app/page.tsx`

- [ ] **Step 1: Replace old source guards with new expectations**

In `frontend/src/app/dashboardCompletedWeekCard.test.ts`, replace `dashboard third task card shows completed tasks for the last 7 days` with:

```ts
test("dashboard task row groups overdue tasks inside the main task block", () => {
  const source = readSource("app/page.tsx");

  assert.match(source, /splitDashboardOpenTasks/);
  assert.match(source, /scopedOpenTaskGroups/);
  assert.match(source, /Просрочено/);
  assert.match(source, /Активные/);
  assert.doesNotMatch(source, /\/\* Overdue Tasks \*\//);
  assert.doesNotMatch(source, /blockKey="overdue"/);
});

test("dashboard activity card replaces the completed-week task card", () => {
  const source = readSource("app/page.tsx");

  assert.match(source, /DashboardActivityCard/);
  assert.match(source, /getDashboardActivity/);
  assert.match(source, /Активность за 7 дней/);
  assert.match(source, /Выполнено/);
  assert.match(source, /Создано/);
  assert.match(source, /В работе > 7 дней/);
  assert.match(source, /К прошлой неделе/);
  assert.doesNotMatch(source, /title="Выполнено за 7 дней"/);
  assert.doesNotMatch(source, /blockKey="completed"/);
});
```

Update the empty-state test to check the merged task block:

```ts
test("dashboard task empty states use one compact icon pattern", () => {
  const source = readSource("app/page.tsx");

  assert.match(source, /function DashboardEmptyState/);
  assert.match(source, /icon:\s*ElementType/);
  assert.match(source, /text-sm font-heading font-semibold text-foreground/);
  assert.match(source, /text-xs text-muted-foreground/);

  const taskBlock = source.match(
    /\{\/\* Scoped Tasks \*\/\}[\s\S]*?\{\/\* Activity \*\//,
  );
  assert.ok(taskBlock, "merged dashboard task block source should exist");
  assert.match(taskBlock[0], /icon=\{ClipboardList\}/);
  assert.match(taskBlock[0], /<DashboardEmptyState[\s\S]*icon=\{ClipboardList\}/);
  assert.doesNotMatch(taskBlock[0], /<EmptyState/);
  assert.doesNotMatch(taskBlock[0], /variant="tasks"/);
});
```

Remove `dashboard overdue empty state is honest when active task data is truncated`; the separate overdue card no longer exists.

- [ ] **Step 2: Run source guard tests to verify failure**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/app/dashboardCompletedWeekCard.test.ts
```

Expected: FAIL because the dashboard still contains the separate overdue and completed blocks.

## Task 6: Dashboard UI Redesign

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Test: `frontend/src/app/dashboardCompletedWeekCard.test.ts`

- [ ] **Step 1: Update imports and local types**

In `frontend/src/app/page.tsx`, update the dashboard utils import:

```ts
  splitDashboardOpenTasks,
```

Update type imports:

```ts
  DashboardActivityAnalytics,
  DashboardActivityMetric,
  DashboardActivityScope,
```

Replace:

```ts
type DashboardTaskBlockKey = "active" | "overdue" | "completed";
```

with:

```ts
type DashboardTaskBlockKey = "tasks";
type ActivityMetricKey = "completed" | "created" | "in_progress_over_7_days";
```

- [ ] **Step 2: Add activity card component**

Add this component after `DashboardTaskBlock`:

```tsx
function DashboardActivityCard({
  activity,
  selectedMetric,
  onSelectedMetricChange,
  showAssignee,
}: {
  activity: DashboardActivityAnalytics | null;
  selectedMetric: ActivityMetricKey | null;
  onSelectedMetricChange: (metric: ActivityMetricKey | null) => void;
  showAssignee: boolean;
}) {
  const metrics: Array<{
    key: ActivityMetricKey;
    label: string;
    metric: DashboardActivityMetric;
  }> = [
    {
      key: "completed",
      label: "Выполнено",
      metric: activity?.completed ?? { count: 0, tasks: [], truncated: false },
    },
    {
      key: "created",
      label: "Создано",
      metric: activity?.created ?? { count: 0, tasks: [], truncated: false },
    },
    {
      key: "in_progress_over_7_days",
      label: "В работе > 7 дней",
      metric: activity?.in_progress_over_7_days ?? { count: 0, tasks: [], truncated: false },
    },
  ];
  const selected = metrics.find((metric) => metric.key === selectedMetric);
  const delta = activity?.completed_delta.delta ?? 0;
  const deltaLabel = delta > 0 ? `+${delta}` : String(delta);

  return (
    <>
      <SectionHeader title="Активность за 7 дней" icon={CheckCircle2} />
      <div className="space-y-3">
        <div className="grid gap-2">
          {metrics.map(({ key, label, metric }) => (
            <button
              key={key}
              type="button"
              aria-pressed={selectedMetric === key}
              onClick={() =>
                onSelectedMetricChange(selectedMetric === key ? null : key)
              }
              disabled={metric.count === 0}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                selectedMetric === key
                  ? "border-primary/40 bg-primary/5 text-foreground"
                  : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground"
              } ${metric.count === 0 ? "opacity-60" : ""}`}
            >
              <span className="text-sm font-medium">{label}</span>
              <span className="text-base font-semibold text-foreground">
                {metric.count}
              </span>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">К прошлой неделе</span>
            <span className={delta >= 0 ? "text-sm font-semibold text-emerald-600" : "text-sm font-semibold text-destructive"}>
              {deltaLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Сравнение по выполненным задачам
          </p>
        </div>
        {selected && selected.metric.count > 0 && (
          <div className="space-y-2" aria-label={selected.label}>
            {selected.metric.tasks.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                variant={task.status === "done" ? "completed" : "default"}
                showAssignee={showAssignee}
              />
            ))}
            {selected.metric.truncated && (
              <p className="text-xs text-muted-foreground">
                Показаны первые {selected.metric.tasks.length} задач.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Update dashboard state**

Replace the old expanded block state with:

```ts
  const [expandedTaskBlocks, setExpandedTaskBlocks] = useState<
    Record<DashboardTaskBlockKey, boolean>
  >({
    tasks: false,
  });
  const [selectedActivityMetric, setSelectedActivityMetric] =
    useState<ActivityMetricKey | null>(null);
  const [dashboardActivity, setDashboardActivity] =
    useState<DashboardActivityAnalytics | null>(null);
  const [taskScope, setTaskScope] = useState<DashboardActivityScope>("my");
```

Update the reset effect:

```ts
  useEffect(() => {
    setExpandedTaskBlocks({ tasks: false });
    setSelectedActivityMetric(null);
  }, [currentScope, selectedDepartmentId]);
```

- [ ] **Step 4: Add team scope availability**

Add:

```ts
  const canUseTeamView = isModerator;
  const currentScope: DashboardActivityScope =
    canUseTeamView && taskScope === "team"
      ? "team"
      : canUseDepartmentView && taskScope === "department"
        ? "department"
        : "my";
```

Replace the old `currentScope` constant. Update the effect that resets invalid scope:

```ts
  useEffect(() => {
    if (taskScope === "team" && !canUseTeamView) {
      setTaskScope("my");
      return;
    }
    if (taskScope === "department" && !canUseDepartmentView) {
      setTaskScope("my");
    }
  }, [canUseDepartmentView, canUseTeamView, taskScope]);
```

Add a `Команда` segmented button next to `Мои` and `Отдел`, rendered only when `canUseTeamView` is true.

- [ ] **Step 5: Fetch team tasks and activity**

Add state:

```ts
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [teamTasksTruncated, setTeamTasksTruncated] = useState(false);
  const [teamTasksTotal, setTeamTasksTotal] = useState(0);
```

Remove the completed-week dashboard task states and setters:

```ts
  const [myCompletedWeekTasks, setMyCompletedWeekTasks] = useState<Task[]>([]);
  const [departmentCompletedWeekTasks, setDepartmentCompletedWeekTasks] =
    useState<Task[]>([]);
  const [myCompletedWeekTasksTruncated, setMyCompletedWeekTasksTruncated] =
    useState(false);
  const [
    departmentCompletedWeekTasksTruncated,
    setDepartmentCompletedWeekTasksTruncated,
  ] = useState(false);
```

In `fetchData`, keep this `Promise.all` result order:

```ts
        const results = await Promise.all([
          api
            .getDashboardTasksAnalytics(selectedDepartmentParam)
            .catch(catchLog("getDashboardTasksAnalytics")),
          api
            .getTasks({
              assignee_id: userId,
              ...(selectedDepartmentParam
                ? { department_id: selectedDepartmentParam }
                : {}),
              status: openStatuses,
              per_page: "200",
              sort: "created_at_desc",
            })
            .catch(catchLog("getMyTasks")),
          selectedDepartmentParam
            ? api
                .getTasks({
                  department_id: selectedDepartmentParam,
                  status: openStatuses,
                  per_page: "200",
                  sort: "created_at_desc",
                })
                .catch(catchLog("getDepartmentTasks"))
            : Promise.resolve(emptyTasksPage),
          isModerator
            ? api
                .getTasks({
                  status: openStatuses,
                  per_page: "200",
                  sort: "created_at_desc",
                })
                .catch(catchLog("getTeamTasks"))
            : Promise.resolve(emptyTasksPage),
          api
            .getDashboardActivity({
              scope: currentScope,
              departmentId:
                currentScope === "department" ? selectedDepartmentParam : undefined,
              detailLimit: 20,
            })
            .catch(catchLog("getDashboardActivity")),
          api.getMeetings({ upcoming: true, member_id: userId }).catch(catchLog("getMyUpcomingMeetings")),
          api.getMeetings({ past: true, member_id: userId }).catch(catchLog("getMyPastMeetings")),
          selectedDepartmentParam
            ? api.getMeetings({ upcoming: true, department_id: selectedDepartmentParam }).catch(catchLog("getDeptUpcomingMeetings"))
            : Promise.resolve([]),
          api.getTeam().catch(catchLog("getTeam")),
          isModerator
            ? api
                .getTasks({
                  status: "new",
                  per_page: "20",
                  sort: "created_at_desc",
                })
                .catch(catchLog("getUnassignedTasks"))
            : Promise.resolve(emptyTasksPage),
        ]);
```

Read the results with these indexes:

```ts
        const dashboardData = results[0] as DashboardTasksAnalytics | null;
        const myTasksData = results[1] as { items: Task[]; total?: number } | null;
        const departmentTasksData = results[2] as { items: Task[]; total?: number } | null;
        const teamTasksData = results[3] as { items: Task[]; total?: number } | null;
        const activityData = results[4] as DashboardActivityAnalytics | null;
        const myMeetingsData = results[5] as Meeting[] | null;
        const myPastMeetingsData = results[6] as Meeting[] | null;
        const deptMeetingsData = results[7] as Meeting[] | null;
        const teamData = results[8] as TeamMember[] | null;
        const unassignedData = results[9] as { items: Task[] } | null;
```

Set team task and activity state:

```ts
        const teamTaskItems = Array.isArray(teamTasksData?.items)
          ? teamTasksData.items.filter(Boolean)
          : [];
        setTeamTasks(sortDashboardActiveTasks(teamTaskItems));
        setTeamTasksTruncated((teamTasksData?.total ?? 0) > teamTaskItems.length);
        setTeamTasksTotal(teamTasksData?.total ?? teamTaskItems.length);
        setDashboardActivity(activityData);
```

Include `currentScope` in the fetch effect dependency list.

- [ ] **Step 6: Derive grouped task lists**

Replace `scopedTasks` and `scopedOverdueTasks` derivation with:

```ts
  const scopedTasks =
    currentScope === "team"
      ? teamTasks
      : currentScope === "department"
        ? departmentTasks
        : myTasks;
  const scopedTasksTruncated =
    currentScope === "team"
      ? teamTasksTruncated
      : currentScope === "department"
        ? departmentTasksTruncated
        : myTasksTruncated;
  const scopedOpenTaskGroups = splitDashboardOpenTasks(scopedTasks);
  const mergedTaskList = [
    ...scopedOpenTaskGroups.overdue,
    ...scopedOpenTaskGroups.active,
  ];
```

Replace task badges with scope-aware active and overdue counts:

```ts
  const scopedActiveTotal =
    currentScope === "team"
      ? teamTasksTotal
      : currentScope === "department"
        ? (departmentMetrics?.active ?? scopedTasks.length)
        : (myMetrics?.active ?? scopedTasks.length);
  const taskBadges: BadgeInfo[] = [
    { label: "активных", value: scopedActiveTotal, color: "default" },
  ];
  if (scopedOpenTaskGroups.overdue.length > 0) {
    taskBadges.push({
      label: "просрочено",
      value: scopedOpenTaskGroups.overdue.length,
      color: "red",
    });
  }
```

Remove `overdueBadges`, `completedWeekBadges`, `completedInScopeThisWeek`, `completedWeekTasks`, and `completedWeekTasksTruncated`.

Update titles:

```ts
  const taskListTitle =
    currentScope === "team"
      ? "Задачи команды"
      : currentScope === "department"
        ? "Задачи отдела"
        : "Мои задачи";
```

- [ ] **Step 7: Render merged task block and activity card**

Replace the three task cards with:

```tsx
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Scoped Tasks */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 lg:col-span-2">
            <DashboardTaskBlock
              blockKey="tasks"
              title={taskListTitle}
              icon={ClipboardList}
              badges={taskBadges}
              tasks={mergedTaskList}
              expanded={expandedTaskBlocks.tasks}
              onExpandedChange={(expanded) =>
                setTaskBlockExpanded("tasks", expanded)
              }
              emptyContent={
                <DashboardEmptyState
                  icon={ClipboardList}
                  title={emptyTaskTitle}
                  description={emptyTaskDescription}
                  iconContainerClassName="bg-primary/10"
                  iconClassName="text-primary"
                />
              }
              itemVariant="default"
              showAssignee={currentScope !== "my"}
              orderingHint="Сначала просроченные, затем срочные и ближайшие дедлайны"
              truncated={scopedTasksTruncated}
              truncationMessage={`Загружены первые ${scopedTasks.length} задач; в полном списке может быть больше.`}
              linkHref="/tasks"
              linkLabel="На доску"
              groups={[
                {
                  title: "Просрочено",
                  tasks: scopedOpenTaskGroups.overdue,
                  itemVariant: "overdue",
                },
                {
                  title: "Активные",
                  tasks: scopedOpenTaskGroups.active,
                  itemVariant: "default",
                },
              ]}
            />
          </div>

          {/* Activity */}
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <DashboardActivityCard
              activity={dashboardActivity}
              selectedMetric={selectedActivityMetric}
              onSelectedMetricChange={setSelectedActivityMetric}
              showAssignee={currentScope !== "my"}
            />
          </div>
        </div>
```

To support `groups`, extend `DashboardTaskBlock` props:

```ts
  groups?: Array<{
    title: string;
    tasks: Task[];
    itemVariant: "default" | "overdue" | "completed";
  }>;
```

Inside `DashboardTaskBlock`, render grouped lists when `groups` is provided:

```tsx
  const visibleTaskIds = new Set(visibleTasks.map((task) => task.id));
  const visibleGroups = groups
    ? groups.map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => visibleTaskIds.has(task.id)),
      }))
    : undefined;
```

Then replace the list body with:

```tsx
          <div id={listId} className="space-y-3">
            {visibleGroups
              ? visibleGroups
                  .filter((group) => group.tasks.length > 0)
                  .map((group) => (
                    <div key={group.title} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {group.title}
                      </p>
                      {group.tasks.map((task) => (
                        <TaskListItem
                          key={task.id}
                          task={task}
                          variant={group.itemVariant}
                          showAssignee={showAssignee}
                        />
                      ))}
                    </div>
                  ))
              : visibleTasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    variant={
                      itemVariant === "default" && isOverdue(task)
                        ? "overdue"
                        : itemVariant
                    }
                    showAssignee={showAssignee}
                  />
                ))}
          </div>
```

Set `hiddenCount` and `canExpand` from the flattened `tasks` list so the button remains accurate.

- [ ] **Step 8: Run dashboard source guard tests**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/app/dashboardCompletedWeekCard.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit dashboard UI**

```bash
git add frontend/src/app/page.tsx frontend/src/app/dashboardCompletedWeekCard.test.ts
git commit -m "Redesign dashboard task activity row"
```

## Task 7: Full Verification and Status Update

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Run backend focused tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_dashboard_activity_api.py -q
```

Expected: PASS.

- [ ] **Step 2: Run frontend tests**

Run:

```bash
cd frontend && npm test
```

Expected: PASS.

- [ ] **Step 3: Run frontend typecheck, lint, build**

Run:

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
```

Expected: all PASS.

- [ ] **Step 4: Run whitespace verification**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Update status**

Update the `Dashboard Task Activity Redesign` section in `docs/STATUS.md`:

```markdown
- Current phase: implemented; automated verification passed
...
- Latest progress:
  - Implemented merged dashboard task block with `Просрочено` and `Активные` groups.
  - Implemented role-aware `Команда` scope for admin/moderator users.
  - Implemented dashboard activity API and inline activity card drill-downs.
  - Verified `В работе > 7 дней` uses status-transition history.
- Latest verification:
  - `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_dashboard_activity_api.py -q` passed.
  - `cd frontend && npm test` passed.
  - `cd frontend && npx tsc --noEmit` passed.
  - `cd frontend && npm run lint` passed.
  - `cd frontend && npm run build` passed.
  - `git diff --check` passed.
```

- [ ] **Step 6: Commit status**

```bash
git add docs/STATUS.md
git commit -m "Record dashboard activity verification"
```

## Final Validation

Run the full command set before claiming completion:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_dashboard_activity_api.py -q
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Expected: all commands pass.
