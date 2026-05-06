# Task Urgency and Create Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace task priority with binary task urgency across the system, remove status/priority icons from task cards, and allow checklist items during task creation.

**Architecture:** Keep the existing `priority` storage/API field for this iteration, but normalize all values into the new domain values `normal` and `urgent`. Add a backend urgency normalization helper used by schemas, services, API filters, bot flows, and AI parsing; add frontend urgency helpers used by filters, cards, dialogs, analytics, and meeting previews. The UI removes icon-only task status/priority affordances and uses an urgent left edge plus text badge, while overdue remains a separate card state.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy async ORM, Alembic, PostgreSQL, aiogram Telegram bot, Next.js 14, React 18, TypeScript, Tailwind CSS, Radix/shadcn UI primitives, lucide-react, Python `pytest`, frontend Node test runner.

---

## Source Documents

- Approved design spec: `docs/superpowers/specs/2026-05-06-task-urgency-and-create-checklist-design.md`
- Active repo plan index: `docs/PLAN.md`
- Existing backend task schemas: `backend/app/db/schemas.py`
- Existing backend task API: `backend/app/api/tasks.py`
- Existing backend task service: `backend/app/services/task_service.py`
- Existing AI parsing service: `backend/app/services/ai_service.py`
- Existing reminder digest service: `backend/app/services/reminder_service.py`
- Existing Telegram task handlers: `backend/app/bot/handlers/tasks.py`
- Existing Telegram voice handlers: `backend/app/bot/handlers/voice.py`
- Existing frontend task types: `frontend/src/lib/types.ts`
- Existing task board card: `frontend/src/components/tasks/TaskCard.tsx`
- Existing task create dialog: `frontend/src/components/tasks/CreateTaskDialog.tsx`
- Existing task detail page: `frontend/src/app/tasks/[id]/page.tsx`

## Scope Check

This is one cohesive feature because the data model change must be consistent across task creation, editing, filtering, display, bot parsing, AI extraction, reminders, notifications, and analytics. The work should not be split into separate product releases because partial rollout would leave conflicting priority and urgency language in user-facing flows.

## File Structure

- Create `backend/app/services/task_urgency.py`: canonical urgency constants, legacy alias normalization, display labels, and urgency rank.
- Create `backend/tests/test_task_urgency.py`: backend normalization, schema, service parser, and API filter tests.
- Create `backend/alembic/versions/030_task_urgency_binary.py`: data migration from `urgent/high/medium/low` to `urgent/normal` and default update.
- Modify `backend/app/db/schemas.py`: `TaskCreate` and `TaskEdit` normalize `priority` into `normal` or `urgent`; default becomes `normal`.
- Modify `backend/app/services/task_service.py`: creation default and inline marker parsing use urgency semantics.
- Modify `backend/app/api/tasks.py`: priority query filter normalizes legacy inputs; priority sort keeps urgent before normal.
- Modify `backend/app/services/ai_service.py`: prompts request binary urgency; duplicate merge prefers urgent over normal.
- Modify `backend/app/services/meeting_service.py`: parsed meeting tasks are normalized before creation.
- Modify `backend/app/services/notification_service.py`: task notifications render urgency language only for urgent tasks.
- Modify `backend/app/services/reminder_service.py`: digest task line priority field renders urgent-only copy and settings text remains compatible.
- Modify `backend/app/bot/handlers/tasks.py`, `backend/app/bot/handlers/voice.py`, `backend/app/bot/handlers/summary.py`, and `backend/app/bot/keyboards.py`: bot copy and edits use urgency language and aliases.
- Modify backend tests that currently assert priority strings: `backend/tests/test_task_update_permissions.py`, `backend/tests/test_reminder_digest_section_order.py`, and related task/bot tests found by `rg`.
- Create `frontend/src/lib/taskUrgency.ts`: frontend urgency normalization and labels.
- Create `frontend/src/lib/taskUrgency.test.ts`: frontend helper tests.
- Modify `frontend/src/lib/types.ts`: `TaskPriority` becomes `normal | urgent`; labels become urgency labels while keeping compatibility exports where needed.
- Modify `frontend/src/components/shared/PriorityBadge.tsx`: reshape into urgency badge compatibility component; no task-card icon use.
- Modify `frontend/src/components/shared/StatusBadge.tsx`: keep detail/list badge support; task cards stop importing `StatusIcon`.
- Modify `frontend/src/components/tasks/taskFilterUtils.ts` and `.test.ts`: filter chips use urgency labels and legacy values normalize.
- Modify `frontend/src/components/tasks/TaskFilters.tsx`: filter label changes from priority to urgency with normal/urgent options only.
- Modify `frontend/src/components/tasks/TaskCard.tsx`: remove status/priority icons, add urgent left edge and text badge, preserve overdue state.
- Modify `frontend/src/components/tasks/CreateTaskDialog.tsx`: replace four priority buttons with a switch and add draft checklist editing to create payload.
- Modify `frontend/src/app/tasks/page.tsx`: filter urgent/normal through helper instead of raw equality.
- Modify `frontend/src/app/tasks/[id]/page.tsx`: replace priority select with urgency switch or compact binary control.
- Modify `frontend/src/app/page.tsx`, `frontend/src/components/meetings/MeetingTasksTab.tsx`, `frontend/src/components/meetings/SummaryTab.tsx`, `frontend/src/app/analytics/page.tsx`, and `frontend/src/components/settings/RemindersSection.tsx`: urgency copy and display.
- Modify `frontend/package.json`: include `taskUrgency.test.ts` in `npm test`.
- Modify `docs/STATUS.md` and `docs/TEST_PLAN.md`: document rollout state and validation commands.

## Task 1: Backend Urgency Domain and Migration

**Files:**

- Create: `backend/app/services/task_urgency.py`
- Create: `backend/tests/test_task_urgency.py`
- Create: `backend/alembic/versions/030_task_urgency_binary.py`
- Modify: `backend/app/db/schemas.py`
- Modify: `backend/app/services/task_service.py`
- Modify: `backend/app/api/tasks.py`

- [ ] **Step 1: Write failing backend urgency helper tests**

Create `backend/tests/test_task_urgency.py` with these tests:

```python
import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.api import tasks as tasks_api
from app.db.schemas import TaskCreate, TaskEdit
from app.services.task_service import TaskService


class TaskUrgencyTests(unittest.IsolatedAsyncioTestCase):
    def test_normalize_task_urgency_maps_legacy_values(self) -> None:
        from app.services.task_urgency import normalize_task_urgency

        cases = {
            "urgent": "urgent",
            "high": "urgent",
            "срочно": "urgent",
            "важно": "urgent",
            "medium": "normal",
            "low": "normal",
            "normal": "normal",
            "обычная": "normal",
            "не срочно": "normal",
            None: "normal",
            "": "normal",
            "unknown": "normal",
        }

        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(normalize_task_urgency(raw), expected)

    def test_task_create_normalizes_legacy_priority(self) -> None:
        self.assertEqual(TaskCreate(title="Task", priority="high").priority, "urgent")
        self.assertEqual(TaskCreate(title="Task", priority="low").priority, "normal")
        self.assertEqual(TaskCreate(title="Task").priority, "normal")

    def test_task_edit_normalizes_legacy_priority_when_present(self) -> None:
        self.assertEqual(TaskEdit(priority="high").priority, "urgent")
        self.assertEqual(TaskEdit(priority="medium").priority, "normal")
        self.assertIsNone(TaskEdit().priority)

    def test_parse_task_text_maps_legacy_markers_to_binary_urgency(self) -> None:
        urgent = TaskService.parse_task_text("Запустить отчет !high @26.02.2026")
        normal = TaskService.parse_task_text("Проверить письмо !low")

        self.assertEqual(urgent["title"], "Запустить отчет")
        self.assertEqual(urgent["priority"], "urgent")
        self.assertEqual(urgent["deadline"], date(2026, 2, 26))
        self.assertEqual(normal["title"], "Проверить письмо")
        self.assertEqual(normal["priority"], "normal")

    async def test_create_task_normalizes_priority_before_persistence(self) -> None:
        service = TaskService()
        creator = SimpleNamespace(id="creator-id", role="member")
        task = SimpleNamespace(id="task-id", assignee_id="creator-id")
        service.task_repo.create = AsyncMock(return_value=task)
        service.in_app_notifications.notify_task_assigned = AsyncMock()
        service.in_app_notifications.notify_task_created_unassigned = AsyncMock()

        await service.create_task(
            SimpleNamespace(),
            title="Task",
            creator=creator,
            priority="high",
        )

        self.assertEqual(service.task_repo.create.await_args.kwargs["priority"], "urgent")

    async def test_list_tasks_normalizes_priority_filter(self) -> None:
        member = SimpleNamespace(id="member-id", role="moderator")
        session = AsyncMock()
        session.execute = AsyncMock()
        session.execute.return_value.scalar_one.return_value = 0
        session.execute.return_value.scalars.return_value.all.return_value = []

        with patch.object(tasks_api, "resolve_visible_department_ids", AsyncMock(return_value=None)):
            await tasks_api.list_tasks(priority="high", member=member, session=session)

        executed_text = " ".join(str(call.args[0]) for call in session.execute.await_args_list)
        self.assertIn("urgent", executed_text)
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_task_urgency.py -q
```

Expected: fail because `app.services.task_urgency` does not exist and schemas still use four-level priority.

- [ ] **Step 3: Implement canonical backend urgency helper**

Create `backend/app/services/task_urgency.py`:

```python
from __future__ import annotations

NORMAL_URGENCY = "normal"
URGENT_URGENCY = "urgent"
TASK_URGENCY_VALUES = (NORMAL_URGENCY, URGENT_URGENCY)

URGENT_ALIASES = {
    "urgent",
    "high",
    "срочно",
    "срочный",
    "срочная",
    "важно",
    "важный",
    "важная",
    "критично",
    "высокий",
    "высокая",
}

NORMAL_ALIASES = {
    "normal",
    "medium",
    "low",
    "обычная",
    "обычный",
    "обычно",
    "не срочно",
    "несрочно",
    "средний",
    "средняя",
    "низкий",
    "низкая",
}

TASK_URGENCY_LABELS = {
    NORMAL_URGENCY: "Обычная",
    URGENT_URGENCY: "Срочная",
}


def normalize_task_urgency(value: str | None, default: str = NORMAL_URGENCY) -> str:
    normalized_default = URGENT_URGENCY if default == URGENT_URGENCY else NORMAL_URGENCY
    if value is None:
        return normalized_default
    normalized = " ".join(str(value).strip().lower().split())
    if not normalized:
        return normalized_default
    if normalized in URGENT_ALIASES:
        return URGENT_URGENCY
    if normalized in NORMAL_ALIASES:
        return NORMAL_URGENCY
    return normalized_default


def is_task_urgent(value: str | None) -> bool:
    return normalize_task_urgency(value) == URGENT_URGENCY


def task_urgency_rank(value: str | None) -> int:
    return 1 if is_task_urgent(value) else 0
```

- [ ] **Step 4: Normalize Pydantic task schemas**

In `backend/app/db/schemas.py`, import `field_validator` and the helper:

```python
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.services.task_urgency import normalize_task_urgency
```

Change the domain type:

```python
TaskPriorityType = Literal["normal", "urgent"]
```

Add validators to `TaskCreate` and `TaskEdit`:

```python
class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    checklist: list[TaskChecklistItem] = Field(default_factory=list)
    priority: TaskPriorityType = "normal"
    assignee_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None
    source: TaskSourceType = "text"
    deadline: date | None = None
    label_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, value: str | None) -> str:
        return normalize_task_urgency(value)


class TaskEdit(BaseModel):
    title: str | None = None
    description: str | None = None
    checklist: list[TaskChecklistItem] | None = None
    status: TaskStatusType | None = None
    priority: TaskPriorityType | None = None
    assignee_id: uuid.UUID | None = None
    deadline: date | None = None
    reminder_at: datetime | None = None
    reminder_comment: str | None = None
    label_ids: list[uuid.UUID] | None = None

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_task_urgency(value)
```

- [ ] **Step 5: Normalize backend service creation and marker parsing**

In `backend/app/services/task_service.py`, import the helper:

```python
from app.services.task_urgency import normalize_task_urgency
```

Change `create_task` default and persistence:

```python
        priority: str = "normal",
```

and:

```python
            priority=normalize_task_urgency(priority),
```

In `parse_task_text`, use binary defaults and markers:

```python
        priority = "normal"
        priority_map = {
            "!urgent": "urgent",
            "!high": "urgent",
            "!medium": "normal",
            "!low": "normal",
        }
```

- [ ] **Step 6: Normalize API priority filter and urgent sort**

In `backend/app/api/tasks.py`, import:

```python
from app.services.task_urgency import normalize_task_urgency
```

Replace priority filtering with:

```python
    if priority:
        base_stmt = base_stmt.where(Task.priority == normalize_task_urgency(priority))
```

Keep `priority_desc` as a compatibility sort key, but make urgent deterministic:

```python
        "priority_desc": case((Task.priority == "urgent", 1), else_=0).desc(),
```

and add `case` to the SQLAlchemy imports.

- [ ] **Step 7: Add Alembic migration**

Create `backend/alembic/versions/030_task_urgency_binary.py`:

```python
"""Convert task priority to binary urgency

Revision ID: 030
Revises: 029
Create Date: 2026-05-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "030"
down_revision: Union[str, None] = "029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE tasks
        SET priority = CASE
            WHEN lower(coalesce(priority, '')) IN ('urgent', 'high') THEN 'urgent'
            ELSE 'normal'
        END
        """
    )
    op.alter_column(
        "tasks",
        "priority",
        existing_type=sa.String(length=20),
        server_default="normal",
        existing_nullable=False,
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE tasks
        SET priority = CASE
            WHEN priority = 'urgent' THEN 'urgent'
            ELSE 'medium'
        END
        """
    )
    op.alter_column(
        "tasks",
        "priority",
        existing_type=sa.String(length=20),
        server_default="medium",
        existing_nullable=False,
    )
```

- [ ] **Step 8: Run Task 1 tests**

Run:

```bash
cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_task_urgency.py tests/test_task_update_permissions.py -q
```

Expected: pass after updating any existing priority assertions from `high` to normalized `urgent`.

- [ ] **Step 9: Commit Task 1**

Run:

```bash
git add backend/app/services/task_urgency.py backend/tests/test_task_urgency.py backend/alembic/versions/030_task_urgency_binary.py backend/app/db/schemas.py backend/app/services/task_service.py backend/app/api/tasks.py backend/tests/test_task_update_permissions.py
git commit -m "feat: normalize task urgency backend"
```

## Task 2: Backend AI, Bot, Notifications, Reminders, and Analytics

**Files:**

- Modify: `backend/app/services/ai_service.py`
- Modify: `backend/app/services/meeting_service.py`
- Modify: `backend/app/services/notification_service.py`
- Modify: `backend/app/services/reminder_service.py`
- Modify: `backend/app/bot/handlers/tasks.py`
- Modify: `backend/app/bot/handlers/voice.py`
- Modify: `backend/app/bot/handlers/summary.py`
- Modify: `backend/app/bot/keyboards.py`
- Modify: `backend/tests/test_reminder_digest_section_order.py`
- Modify: `backend/tests/test_task_urgency.py`

- [ ] **Step 1: Add failing AI and digest behavior tests**

Append to `backend/tests/test_task_urgency.py`:

```python
    def test_ai_priority_normalizer_maps_high_to_urgent(self) -> None:
        from app.bot.handlers.tasks import _normalize_ai_priority

        self.assertEqual(_normalize_ai_priority("high"), "urgent")
        self.assertEqual(_normalize_ai_priority("urgent"), "urgent")
        self.assertEqual(_normalize_ai_priority("medium"), "normal")
        self.assertEqual(_normalize_ai_priority("low"), "normal")
        self.assertEqual(_normalize_ai_priority("unexpected"), "normal")

    def test_bot_priority_input_accepts_binary_and_legacy_aliases(self) -> None:
        from app.bot.handlers.tasks import _normalize_priority_input

        self.assertEqual(_normalize_priority_input("срочно"), "urgent")
        self.assertEqual(_normalize_priority_input("high"), "urgent")
        self.assertEqual(_normalize_priority_input("обычная"), "normal")
        self.assertEqual(_normalize_priority_input("low"), "normal")
```

Update `test_send_daily_digest_applies_task_line_format` in `backend/tests/test_reminder_digest_section_order.py` so the urgent line expectation becomes:

```python
        self.assertIn("Срочно", sent_text)
        self.assertNotIn("⚡ urgent", sent_text)
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_task_urgency.py tests/test_reminder_digest_section_order.py -q
```

Expected: fail because bot normalizers and reminder task lines still return four-level priority text.

- [ ] **Step 3: Update AI prompts and merge ranking**

In `backend/app/services/ai_service.py`, change `ParsedTask.priority` and `ParsedVoiceTask.priority` defaults to `"normal"`.

In both prompt JSON schemas, replace:

```text
"priority": "low | medium | high | urgent",
```

with:

```text
"priority": "normal | urgent",
```

Replace priority rules with binary urgency language:

```text
- Определи срочность: "срочно", "критично", "ASAP", "важно" -> urgent; по умолчанию и для "не горит"/"когда будет время" -> normal.
```

Import `normalize_task_urgency` and `task_urgency_rank`, then replace the meeting duplicate merge rank:

```python
                if task_urgency_rank(task.priority) > task_urgency_rank(existing.priority):
                    existing.priority = normalize_task_urgency(task.priority)
```

Also normalize each parsed task after JSON parsing in `parse_meeting_summary` and `parse_voice_task` before returning.

- [ ] **Step 4: Normalize meeting service task creation**

In `backend/app/services/meeting_service.py`, import `normalize_task_urgency` and use:

```python
                priority=normalize_task_urgency(pt.get("priority")),
```

- [ ] **Step 5: Update bot constants and edit prompts**

In `backend/app/bot/handlers/tasks.py`, import `normalize_task_urgency`, `is_task_urgent`, and `TASK_URGENCY_LABELS`.

Replace priority constants with binary language:

```python
PRIORITY_EMOJI = {
    "urgent": "🔴",
    "normal": "",
}

PRIORITY_LABELS = {
    "urgent": "Срочно",
    "normal": "Обычная",
}

TASK_PRIORITY_ALIASES = {
    "urgent": "urgent",
    "high": "urgent",
    "срочно": "urgent",
    "срочный": "urgent",
    "важно": "urgent",
    "высокий": "urgent",
    "normal": "normal",
    "medium": "normal",
    "low": "normal",
    "обычная": "normal",
    "обычный": "normal",
    "не срочно": "normal",
    "средний": "normal",
    "низкий": "normal",
}
AI_PRIORITY_VALUES = {"normal", "urgent", "low", "medium", "high"}
```

Change `TASK_EDIT_FIELD_LABELS["priority"]` to:

```python
"priority": "🔴 Срочность",
```

Change `_task_edit_prompt_text("priority")` to:

```python
"priority": "🔴 Срочная задача? Введите urgent/normal, срочно/обычная.",
```

Change `_normalize_ai_priority`:

```python
def _normalize_ai_priority(raw_value: str | None) -> str:
    return normalize_task_urgency(raw_value)
```

Change invalid priority messages to:

```python
"❌ Неверная срочность. Доступные: urgent/normal, срочно/обычная"
```

- [ ] **Step 6: Update bot task rendering**

In `_format_task_list_item`, only include urgency when urgent:

```python
    urgency_part = " · 🔴 Срочно" if is_task_urgent(task.priority) else ""
    return (
        f"• <b>#{task.short_id}</b> {title}\n"
        f"  {status_icon} {status_label}{urgency_part} · 📅 {deadline_str}"
    )
```

In `_format_task_detail`, replace priority line:

```python
        f"🔴 Срочность: {PRIORITY_LABELS.get(normalize_task_urgency(task.priority), 'Обычная')}\n"
```

In task creation responses, render:

```python
    urgency_str = "\n🔴 Срочно" if is_task_urgent(task.priority) else ""
```

and remove raw `task.priority` output.

In `backend/app/bot/handlers/voice.py`, make the same constants and edit validation changes, and change preview line to:

```python
        f"🔴 Срочность: {'Срочно' if is_task_urgent(data.get('priority')) else 'Обычная'}\n"
```

In `backend/app/bot/handlers/summary.py`, map parsed priorities through `normalize_task_urgency` before choosing an emoji and show `Срочно` only for urgent tasks.

In `backend/app/bot/keyboards.py`, change the voice edit button text from `⚡ Приоритет` to `🔴 Срочность`.

- [ ] **Step 7: Update notifications and reminders**

In `backend/app/services/notification_service.py`, import `is_task_urgent` and replace raw priority lines with:

```python
                urgency_str = "\n🔴 Срочно" if is_task_urgent(task.priority) else ""
```

and include `{urgency_str}` before deadline/assignee lines.

In `backend/app/services/reminder_service.py`, import `is_task_urgent` and replace the priority field renderer:

```python
            elif field_key == "priority":
                if is_task_urgent(task.priority):
                    parts.append("Срочно")
```

- [ ] **Step 8: Run Task 2 tests**

Run:

```bash
cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_task_urgency.py tests/test_reminder_digest_section_order.py tests/test_group_task_mentions.py -q
```

Expected: pass after updating any remaining expected priority strings to urgency strings.

- [ ] **Step 9: Commit Task 2**

Run:

```bash
git add backend/app/services/ai_service.py backend/app/services/meeting_service.py backend/app/services/notification_service.py backend/app/services/reminder_service.py backend/app/bot/handlers/tasks.py backend/app/bot/handlers/voice.py backend/app/bot/handlers/summary.py backend/app/bot/keyboards.py backend/tests/test_task_urgency.py backend/tests/test_reminder_digest_section_order.py
git commit -m "feat: update task urgency integrations"
```

## Task 3: Frontend Urgency Helpers, Types, and Filters

**Files:**

- Create: `frontend/src/lib/taskUrgency.ts`
- Create: `frontend/src/lib/taskUrgency.test.ts`
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/components/tasks/taskFilterUtils.ts`
- Modify: `frontend/src/components/tasks/taskFilterUtils.test.ts`
- Modify: `frontend/src/components/tasks/TaskFilters.tsx`
- Modify: `frontend/src/app/tasks/page.tsx`
- Modify: `frontend/package.json`

- [ ] **Step 1: Write failing frontend urgency helper tests**

Create `frontend/src/lib/taskUrgency.test.ts`:

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import {
  isTaskUrgent,
  normalizeTaskUrgency,
  TASK_URGENCY_LABELS,
} from "./taskUrgency.ts";

test("normalizeTaskUrgency maps legacy values to binary urgency", () => {
  assert.equal(normalizeTaskUrgency("urgent"), "urgent");
  assert.equal(normalizeTaskUrgency("high"), "urgent");
  assert.equal(normalizeTaskUrgency("срочно"), "urgent");
  assert.equal(normalizeTaskUrgency("medium"), "normal");
  assert.equal(normalizeTaskUrgency("low"), "normal");
  assert.equal(normalizeTaskUrgency("normal"), "normal");
  assert.equal(normalizeTaskUrgency("не срочно"), "normal");
  assert.equal(normalizeTaskUrgency(undefined), "normal");
});

test("isTaskUrgent reads legacy high as urgent", () => {
  assert.equal(isTaskUrgent("high"), true);
  assert.equal(isTaskUrgent("urgent"), true);
  assert.equal(isTaskUrgent("medium"), false);
});

test("TASK_URGENCY_LABELS uses user-facing Russian labels", () => {
  assert.deepEqual(TASK_URGENCY_LABELS, {
    normal: "Обычная",
    urgent: "Срочная",
  });
});
```

Add the file to `frontend/package.json`:

```json
"test": "node --test --experimental-strip-types src/lib/dateUtils.test.ts src/lib/compactHeaderControls.test.ts src/lib/taskUrgency.test.ts src/components/tasks/taskFilterUtils.test.ts src/components/tasks/taskLabelUtils.test.ts"
```

- [ ] **Step 2: Run frontend tests to verify failure**

Run:

```bash
cd frontend && npm test
```

Expected: fail because `frontend/src/lib/taskUrgency.ts` does not exist.

- [ ] **Step 3: Implement frontend urgency helper**

Create `frontend/src/lib/taskUrgency.ts`:

```typescript
export type TaskUrgency = "normal" | "urgent";

export const TASK_URGENCY_LABELS: Record<TaskUrgency, string> = {
  normal: "Обычная",
  urgent: "Срочная",
};

const urgentAliases = new Set([
  "urgent",
  "high",
  "срочно",
  "срочный",
  "срочная",
  "важно",
  "важный",
  "важная",
  "критично",
  "высокий",
  "высокая",
]);

const normalAliases = new Set([
  "normal",
  "medium",
  "low",
  "обычная",
  "обычный",
  "обычно",
  "не срочно",
  "несрочно",
  "средний",
  "средняя",
  "низкий",
  "низкая",
]);

export function normalizeTaskUrgency(value: unknown): TaskUrgency {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (urgentAliases.has(normalized)) return "urgent";
  if (normalAliases.has(normalized)) return "normal";
  return "normal";
}

export function isTaskUrgent(value: unknown): boolean {
  return normalizeTaskUrgency(value) === "urgent";
}
```

- [ ] **Step 4: Update frontend task types**

In `frontend/src/lib/types.ts`, import or inline the new binary type. Use this shape:

```typescript
export type TaskPriority = "normal" | "urgent";
```

Replace `TASK_PRIORITY_LABELS` with compatibility labels:

```typescript
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  normal: "Обычная",
  urgent: "Срочная",
};
```

Do not leave `high`, `medium`, or `low` in the exported task priority type.

- [ ] **Step 5: Update filter helpers and tests**

In `frontend/src/components/tasks/taskFilterUtils.ts`, import `normalizeTaskUrgency` and `TASK_URGENCY_LABELS`. When building the priority chip, use:

```typescript
  if (filters.priority) {
    const urgency = normalizeTaskUrgency(filters.priority);
    chips.push({
      type: "field",
      key: "priority",
      label: `Срочность: ${TASK_URGENCY_LABELS[urgency]}`,
    });
  }
```

Update `frontend/src/components/tasks/taskFilterUtils.test.ts` so expected priority chip labels become:

```typescript
"Срочность: Срочная"
```

for `urgent` or `high`, and:

```typescript
"Срочность: Обычная"
```

for `low` or `medium`.

- [ ] **Step 6: Update task filter UI**

In `frontend/src/components/tasks/TaskFilters.tsx`, remove `PRIORITY_DOT_COLORS`. Change the filter field label to `Срочность`, trigger placeholder to `Срочность`, and select content to:

```tsx
<SelectItem value="all">Все задачи</SelectItem>
<SelectItem value="urgent">Срочные</SelectItem>
<SelectItem value="normal">Обычные</SelectItem>
```

On value change, keep writing to `filters.priority` for compatibility:

```tsx
priority: v === "all" ? "" : v,
```

- [ ] **Step 7: Update task board filtering**

In `frontend/src/app/tasks/page.tsx`, import `normalizeTaskUrgency`. Replace raw priority equality with:

```typescript
      if (
        filters.priority &&
        normalizeTaskUrgency(t.priority) !== normalizeTaskUrgency(filters.priority)
      ) {
        return false;
      }
```

- [ ] **Step 8: Run Task 3 tests**

Run:

```bash
cd frontend && npm test
```

Expected: pass.

- [ ] **Step 9: Commit Task 3**

Run:

```bash
git add frontend/src/lib/taskUrgency.ts frontend/src/lib/taskUrgency.test.ts frontend/src/lib/types.ts frontend/src/components/tasks/taskFilterUtils.ts frontend/src/components/tasks/taskFilterUtils.test.ts frontend/src/components/tasks/TaskFilters.tsx frontend/src/app/tasks/page.tsx frontend/package.json
git commit -m "feat: add frontend task urgency filters"
```

## Task 4: Task Cards, Create Dialog Checklist, and Detail Urgency Editing

**Files:**

- Modify: `frontend/src/components/shared/PriorityBadge.tsx`
- Modify: `frontend/src/components/tasks/TaskCard.tsx`
- Modify: `frontend/src/components/tasks/CreateTaskDialog.tsx`
- Modify: `frontend/src/app/tasks/[id]/page.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Create visual regression target in code**

Update `frontend/src/components/shared/PriorityBadge.tsx` so the compatibility component renders urgency text, not priority icons. Use this interface:

```tsx
export function PriorityBadge({
  priority,
  showNormal = true,
}: {
  priority: TaskPriority | string | null | undefined;
  showNormal?: boolean;
}) {
  const urgency = normalizeTaskUrgency(priority);
  if (urgency === "normal" && !showNormal) return null;
  const className =
    urgency === "urgent"
      ? "bg-priority-urgent-bg text-priority-urgent-fg ring-1 ring-inset ring-priority-urgent-dot/40"
      : "bg-muted text-muted-foreground ring-1 ring-inset ring-border/70";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {urgency === "urgent" ? "Срочно" : "Обычная"}
    </span>
  );
}

export function PriorityIcon() {
  return null;
}
```

Add the imports:

```tsx
import { normalizeTaskUrgency } from "@/lib/taskUrgency";
```

- [ ] **Step 2: Remove status/priority icons from task cards**

In `frontend/src/components/tasks/TaskCard.tsx`, remove `PriorityIcon` and `StatusIcon` imports. Import `isTaskUrgent`.

Compute:

```typescript
  const urgent = isTaskUrgent(task.priority);
```

Update `cardClass` so urgent and overdue can coexist:

```typescript
  const cardClass = cn(
    "relative bg-card",
    urgent && "border-l-4 border-l-priority-urgent-dot",
    overdue
      ? "border-destructive/35 bg-destructive/[0.05] shadow-[0_0_0_1px_hsl(var(--destructive)/0.12)_inset] hover:bg-destructive/[0.08] hover:border-destructive/45"
      : "border-border/50 hover:border-primary/20"
  );
```

Replace the header right icon block with no status/priority block. Add urgent badge to the footer metadata before overdue:

```tsx
                {urgent && (
                  <span className="rounded-full bg-priority-urgent-bg px-2 py-0.5 text-2xs font-medium text-priority-urgent-fg">
                    Срочно
                  </span>
                )}
```

- [ ] **Step 3: Update dashboard task mini-cards**

In `frontend/src/app/page.tsx`, remove `StatusIcon` and `PriorityIcon` imports and usage in task mini-cards. Import `isTaskUrgent`, compute urgent, and add a `Срочно` pill in the metadata line using the same urgent badge classes from task cards.

- [ ] **Step 4: Replace create dialog priority buttons with urgency switch and checklist draft**

In `frontend/src/components/tasks/CreateTaskDialog.tsx`, remove priority option icon imports and add:

```tsx
import { Switch } from "@/components/ui/switch";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import type { TaskChecklistItem } from "@/lib/types";
```

Add local id helper:

```typescript
function createChecklistId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
```

Replace priority state with:

```typescript
  const [isUrgent, setIsUrgent] = useState(false);
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
```

Reset these fields in `resetForm`.

Submit:

```typescript
        checklist,
        priority: isUrgent ? "urgent" : "normal",
```

Add checklist handlers:

```typescript
  function handleAddChecklistItem() {
    const itemTitle = newChecklistTitle.trim();
    if (!itemTitle) return;
    setChecklist((items) => [
      ...items,
      { id: createChecklistId(), title: itemTitle, is_completed: false },
    ]);
    setNewChecklistTitle("");
  }

  function handleRemoveChecklistItem(itemId: string) {
    setChecklist((items) => items.filter((item) => item.id !== itemId));
  }
```

Replace the priority button grid with:

```tsx
          <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="create-urgent" className="text-sm font-medium">
                  Срочная задача
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Покажем красную грань на карточке задачи
                </p>
              </div>
              <Switch
                id="create-urgent"
                checked={isUrgent}
                onCheckedChange={setIsUrgent}
                disabled={saving}
              />
            </div>
          </div>
```

Add checklist draft UI before deadline/assignee:

```tsx
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5 text-sm font-medium">
              <ListChecks className="h-3.5 w-3.5" />
              Чек-лист
            </Label>
            {checklist.length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-2">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg bg-card px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Удалить пункт ${item.title}`}
                      onClick={() => handleRemoveChecklistItem(item.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={saving}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                value={newChecklistTitle}
                onChange={(e) => setNewChecklistTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
                placeholder="Добавить пункт"
                className="h-9 bg-muted/30 border-border/60"
                disabled={saving}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Добавить пункт чек-листа"
                onClick={handleAddChecklistItem}
                disabled={saving || !newChecklistTitle.trim()}
                className="h-9 w-9"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
```

- [ ] **Step 5: Replace task detail priority selector**

In `frontend/src/app/tasks/[id]/page.tsx`, remove `PRIORITY_OPTIONS`, `Select` usage for priority, and priority select imports if unused. Import `Switch` and `normalizeTaskUrgency`.

Change `handlePriorityChange` to:

```typescript
  async function handleUrgencyChange(checked: boolean) {
    if (!task || !canEditTask) return;
    try {
      const updated = await api.updateTask(shortId, {
        priority: checked ? "urgent" : "normal",
      });
      setTask(updated);
      toastSuccess(checked ? "Задача отмечена срочной" : "Задача стала обычной");
    } catch {
      toastError("Не удалось обновить срочность");
    }
  }
```

Replace the priority badge/select block with a switch:

```tsx
          {canEditTask ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5">
              <Label htmlFor="task-urgent" className="text-xs font-medium">
                Срочная задача
              </Label>
              <Switch
                id="task-urgent"
                checked={normalizeTaskUrgency(task.priority) === "urgent"}
                onCheckedChange={handleUrgencyChange}
              />
            </div>
          ) : (
            <PriorityBadge priority={task.priority} showNormal />
          )}
```

- [ ] **Step 6: Run frontend checks for Task 4**

Run:

```bash
cd frontend && npm test && npx tsc --noEmit
```

Expected: pass. Fix imports and type mismatches only in files touched by this task.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git add frontend/src/components/shared/PriorityBadge.tsx frontend/src/components/tasks/TaskCard.tsx frontend/src/components/tasks/CreateTaskDialog.tsx frontend/src/app/tasks/[id]/page.tsx frontend/src/app/page.tsx
git commit -m "feat: update task urgency UI"
```

## Task 5: Meeting Preview, Analytics, Settings Copy, and Documentation

**Files:**

- Modify: `frontend/src/components/meetings/SummaryTab.tsx`
- Modify: `frontend/src/components/meetings/MeetingTasksTab.tsx`
- Modify: `frontend/src/app/analytics/page.tsx`
- Modify: `frontend/src/components/settings/RemindersSection.tsx`
- Modify: `frontend/src/app/globals.css`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`

- [ ] **Step 1: Update meeting summary preview choices**

In `frontend/src/components/meetings/SummaryTab.tsx`, replace four priority choices with `normal` and `urgent` only:

```tsx
{(["normal", "urgent"] as TaskPriority[]).map((p) => (
```

Use labels:

```typescript
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  normal: "Обычная",
  urgent: "Срочная",
};
```

Use `normalizeTaskUrgency` when loading parsed tasks:

```typescript
setEditTasks(result.tasks.map((t) => ({ ...t, priority: normalizeTaskUrgency(t.priority) })));
```

- [ ] **Step 2: Update meeting task list urgency badge**

In `frontend/src/components/meetings/MeetingTasksTab.tsx`, render:

```tsx
<PriorityBadge priority={task.priority} showNormal={false} />
```

so normal tasks do not add noise.

- [ ] **Step 3: Update analytics copy and aggregation display**

In `frontend/src/app/analytics/page.tsx`, change `PRIORITY_CHART` to only:

```typescript
const URGENCY_CHART: Record<string, { label: string; color: string }> = {
  urgent: { label: "Срочные", color: "hsl(0, 72%, 51%)" },
  normal: { label: "Обычные", color: "hsl(210, 10%, 60%)" },
};
```

When mapping rows, normalize keys:

```typescript
const urgency = normalizeTaskUrgency(key);
```

Combine duplicate legacy buckets by reducing into a `Record<string, number>` before rendering. Change section copy from `Источники и приоритеты` to `Источники и срочность`, and chart title from `По приоритетам` to `По срочности`.

- [ ] **Step 4: Update reminders settings copy**

In `frontend/src/components/settings/RemindersSection.tsx`, change visible user-facing labels from `Приоритет` to `Срочность`, and preview text from:

```typescript
priority: "⚡ high",
```

to:

```typescript
priority: "Срочно",
```

Keep API field names unchanged.

- [ ] **Step 5: Simplify priority CSS tokens where safe**

In `frontend/src/app/globals.css`, keep `--priority-urgent-*` because task cards use it. Remove reliance on high/medium/low tokens in updated components, but do not delete tokens in this iteration if untouched older CSS still references them indirectly.

- [ ] **Step 6: Update docs status and test plan**

In `docs/STATUS.md`, add:

```markdown
## Task Urgency and Create Checklist

- Current phase: implementation in progress
- Spec: `docs/superpowers/specs/2026-05-06-task-urgency-and-create-checklist-design.md`
- Plan: `docs/superpowers/plans/2026-05-06-task-urgency-and-create-checklist.md`
- Scope: binary urgency across backend, frontend, bot, AI, notifications, reminders, analytics, and create-dialog checklist
- Latest progress:
  - Backend urgency normalization and migration implemented.
  - Frontend urgency filters, task cards, create dialog checklist, and task detail editing implemented.
- Latest verification:
  - Pending final automated and browser validation.
```

In `docs/TEST_PLAN.md`, add the automated and manual checks from the approved spec.

- [ ] **Step 7: Run frontend checks for Task 5**

Run:

```bash
cd frontend && npm test && npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 8: Commit Task 5**

Run:

```bash
git add frontend/src/components/meetings/SummaryTab.tsx frontend/src/components/meetings/MeetingTasksTab.tsx frontend/src/app/analytics/page.tsx frontend/src/components/settings/RemindersSection.tsx frontend/src/app/globals.css docs/STATUS.md docs/TEST_PLAN.md
git commit -m "feat: update urgency reporting copy"
```

## Task 6: Final Verification and Browser QA

**Files:**

- Modify only files needed to fix verification failures from Task 1 through Task 5.

- [ ] **Step 1: Run targeted backend suite**

Run:

```bash
cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_task_urgency.py tests/test_task_update_permissions.py tests/test_reminder_digest_section_order.py tests/test_task_label_task_api.py tests/test_task_permission_service.py -q
```

Expected: all selected tests pass.

- [ ] **Step 2: Run full backend suite**

Run:

```bash
cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q
```

Expected: all backend tests pass.

- [ ] **Step 3: Run frontend test, typecheck, lint, and build**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
```

Expected: all commands pass.

- [ ] **Step 4: Run diff whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Browser QA on task UI**

Start the app:

```bash
cd frontend && npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open `http://127.0.0.1:3001/tasks`. If unauthenticated redirect prevents UI access, record that limitation in `docs/STATUS.md`. With an authenticated test session, validate:

- normal cards have no status or priority icons;
- urgent cards show the red left edge and `Срочно`;
- overdue cards show overdue state and `Просрочено`;
- urgent overdue cards show both urgency and overdue signals;
- new task dialog creates a task with checklist items;
- new task dialog creates `normal` by default and `urgent` when the switch is enabled;
- task detail urgency switch updates the task.

- [ ] **Step 6: Update final status**

In `docs/STATUS.md`, replace `Pending final automated and browser validation` with the exact commands and results from Steps 1 through 5.

- [ ] **Step 7: Commit verification updates**

Run:

```bash
git add docs/STATUS.md
git commit -m "docs: record task urgency verification"
```
