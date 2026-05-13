# Projects Phase 2 Design

## Metadata

| Field | Value |
| --- | --- |
| Date | 2026-05-13 |
| Status | Approved for implementation planning |
| Parent Spec | `docs/superpowers/specs/2026-05-12-ideas-projects-tasks-design.md` |
| Feature | Projects layer for Ideas and Tasks |
| Scope | Web portal Phase 2 MVP |

## Purpose

Phase 2 adds `Projects` as a planning layer between approved ideas and execution tasks.

The product model becomes:

```text
Idea -> Tasks
Idea -> Project -> Tasks
Project -> Tasks
```

The key rule is that Projects must extend the Ideas workflow, not replace it. Small ideas can still become direct tasks. Larger approved ideas can become projects when the implementation needs an owner, departments, stages, and project-level progress.

## MVP Goals

- Add a new portal section named `Проекты`.
- Let admin/moderator users create projects directly.
- Let an accepted idea become a project without losing the existing idea detail and history.
- Let project owners manage the project plan and create tasks in the project context.
- Show project progress by linked task completion and department involvement.
- Keep linked task visibility consistent with the existing task permissions.
- Keep Phase 2 focused on organizing work, not full project management.

## Non-Goals

- No project analytics dashboard in Phase 2 MVP.
- No Telegram project creation or project notifications.
- No AI project decomposition.
- No budget, capacity planning, SLA, approvals, or Gantt chart.
- No voting, project templates, or duplicate detection.
- No migration that forces every idea task into a project.
- No removal of direct idea-to-task creation.

## Navigation

Add a main portal section:

```text
Проекты
```

The section contains:

- `/projects` - project register;
- `/projects/{id}` - project detail page.

The existing `Идеи` section remains unchanged except for project creation and project-link affordances on accepted ideas.

## Project Entity

A Project is a larger initiative that answers:

> How do we organize and track this implementation?

A project has:

- title;
- description;
- status;
- owner;
- optional source idea;
- involved departments;
- milestones or stages;
- linked tasks;
- comments;
- event history;
- created, updated, completed, and soft-delete metadata.

## Project Status Model

Use these project statuses:

| Status | User Label | Meaning |
| --- | --- | --- |
| `planned` | `Запланирован` | Project is defined but execution has not started. |
| `in_progress` | `В работе` | Project has active execution. |
| `paused` | `На паузе` | Project is intentionally stopped for now. |
| `completed` | `Завершён` | Project work is finished. |
| `cancelled` | `Отменён` | Project will not continue. |

Primary lifecycle:

```text
Запланирован -> В работе -> Завершён
```

Side states:

```text
На паузе
Отменён
```

Project completion is a deliberate manual action. The UI should make completion available when all linked visible or hidden tasks are closed, but admin/moderator users and the project owner still perform the close explicitly.

## Creation Flows

### Create Project From Idea

Available from an accepted idea and from an idea already in tasks.

Required fields:

- project title, prefilled from the idea title;
- description, prefilled from the idea description;
- project owner;
- involved departments, prefilled from the idea departments when present.

After creation:

- the project stores `source_idea_id`;
- the idea stores `project_id`;
- existing idea-linked tasks are also linked to the project by default, while remaining visible from the idea;
- idea department task links keep department context when the matching project department exists;
- future tasks can be created either directly from the idea or inside the project;
- the idea detail page shows a link to the project.

### Create Project Directly

Available to admin/moderator users.

Required fields:

- title;
- description;
- project owner.

Optional fields:

- involved departments;
- initial milestones or stages.

Direct projects have no source idea.

## Project Detail Page

The project detail page contains:

- header with status, title, owner, source idea link if present, and last updated date;
- description;
- project controls for status and owner;
- department involvement block;
- milestones/stages block;
- linked tasks block;
- comments;
- event history.

The page should feel operational and compact, consistent with the Ideas detail page. It should not be a marketing-style project overview.

## Project Register

The `/projects` page is a register, not a kanban board.

Primary controls:

- `Новый проект` button;
- status tabs:
  - `Все`;
  - `Запланированы`;
  - `В работе`;
  - `На паузе`;
  - `Завершённые`;
  - `Отменённые`;
- filters:
  - project owner;
  - involved department;
  - source idea;
  - created date range.

Each project row/card shows:

- title;
- status;
- owner;
- source idea when present;
- involved departments;
- milestone progress;
- linked task progress;
- created date;
- last updated date.

## Departments

Projects can involve one or more departments.

Each involved department has:

- department;
- department owner for this project;
- status;
- optional note;
- linked project tasks for that department.

Department statuses:

| Status | User Label | Meaning |
| --- | --- | --- |
| `not_started` | `Не начато` | Department is included but has not started. |
| `in_progress` | `В работе` | Department is executing its part. |
| `ready` | `Готово` | Department finished its part. |
| `not_required` | `Не требуется` | Department no longer needs to contribute. |

These labels intentionally match the Ideas department contribution model.

## Milestones Or Stages

Phase 2 MVP should support lightweight milestones, not a complex Gantt system.

Each milestone has:

- title;
- status;
- optional due date;
- sort order.

Milestone statuses:

| Status | User Label |
| --- | --- |
| `planned` | `Запланирован` |
| `in_progress` | `В работе` |
| `done` | `Готово` |

Milestones are project-level planning markers. Tasks are not assigned to milestones in the Phase 2 MVP. The first implementation should prefer a simple project milestone list over a task scheduling system.

## Tasks

Phase 2 should add project-linked tasks without breaking existing task behavior.

Supported task paths:

- task created directly from an idea;
- task created from a project;
- task created from a project department.

Project tasks remain normal portal tasks. Existing task permissions, labels, assignees, statuses, reminders, and visibility rules still apply.

The project detail page shows:

- all linked task count;
- visible linked task count;
- hidden linked task count;
- completed/cancelled linked task count;
- task rows only when the current user can see the task.

Users without task visibility see neutral hidden-task counts, not hidden task content.

## Data Model

### `projects`

Core fields:

- `id`;
- `title`;
- `description`;
- `status`;
- `owner_id`;
- `source_idea_id`;
- `completed_at`;
- `deleted_at`;
- `deleted_by_id`;
- `created_at`;
- `updated_at`.

### `project_departments`

Core fields:

- `id`;
- `project_id`;
- `department_id`;
- `owner_id`;
- `status`;
- `note`;
- `created_by_id`;
- `created_at`;
- `updated_at`.

Use a unique constraint on `(project_id, department_id)`.

### `project_milestones`

Core fields:

- `id`;
- `project_id`;
- `title`;
- `status`;
- `due_date`;
- `sort_order`;
- `created_at`;
- `updated_at`.

### `project_tasks`

Core fields:

- `id`;
- `project_id`;
- `project_department_id`;
- `task_id`;
- `created_by_id`;
- `created_at`.

Use a unique constraint on `task_id`, matching the current `idea_tasks` pattern. A task belongs to at most one project in the MVP.

### `project_comments`

Core fields:

- `id`;
- `project_id`;
- `author_id`;
- `body`;
- `created_at`;
- `updated_at`.

### `project_events`

Core fields:

- `id`;
- `project_id`;
- `actor_id`;
- `event_type`;
- `payload`;
- `created_at`.

### Existing Table Changes

Add to `ideas`:

- `project_id`, nullable FK to `projects.id`.

Do not add `tasks.project_id` in the MVP if `project_tasks` is sufficient. The join table matches the existing `idea_tasks` design and avoids expanding the core task model in this phase.

## Permissions

### Everyone

Every active team member can:

- view the shared project register;
- view project detail pages;
- comment on projects.

### Admins And Moderators

Admins and moderators can:

- create projects directly;
- create projects from accepted ideas;
- edit all project fields;
- change project status;
- add or remove departments;
- assign project owners;
- create linked tasks;
- soft-delete projects without linked tasks.

### Project Owner

The project owner can:

- edit project title and description;
- change status;
- manage departments;
- manage milestones;
- create linked project tasks;
- complete the project when completion rules are satisfied.

### Source Idea Review Owner

The review owner of an accepted source idea can:

- create a project from that idea;
- become the default project owner unless another owner is selected.

### Department Head

A department head can:

- add their own department to a `planned`, `in_progress`, or `paused` project;
- manage their department's project block;
- create tasks for their department;
- mark their department `ready` or `not_required`.

### Project Department Owner

A project department owner can:

- manage their department's project block;
- create tasks for their department;
- mark the department `ready` when work is complete.

## Deletion

Projects should use soft deletion, consistent with Ideas.

Rules:

- admin/moderator users can delete projects only when no linked tasks exist;
- project owners can delete their own `planned` project only when no linked tasks exist;
- projects with linked tasks cannot be deleted through Phase 2 MVP;
- deleted projects are excluded from normal register/detail reads.

## Events

Project history should show readable Russian labels, not technical event keys.

Initial event types:

- `project_created`;
- `project_updated`;
- `status_changed`;
- `department_added`;
- `department_updated`;
- `milestone_added`;
- `milestone_updated`;
- `task_linked`;
- `comment_added`;
- `project_completed`;
- `project_deleted`.

## Idea Integration

Idea detail should add:

- `Создать проект` action for accepted ideas without a linked project;
- project link card when a project exists;
- no project link card when the linked project has been soft-deleted;
- event history entry when a project is created from the idea.

Creating a project from an idea should not automatically complete the idea. The idea remains in its own lifecycle. It can move to `in_tasks` when implementation begins and to `completed` when completion rules are satisfied.

## Error Handling

- Return `404` for missing, inactive, or soft-deleted projects.
- Return `403` when the user lacks permission for the action.
- Return `400` for invalid lifecycle actions, such as completing a project with open linked tasks.
- Return `409` for duplicate project departments or duplicate task links.
- Keep user-facing error text in Russian.

## Testing Strategy

Backend tests should cover:

- project model and migration smoke checks;
- project creation direct and from idea;
- project list filters;
- project permission rules;
- project soft deletion rules;
- project department ownership rules;
- milestone CRUD rules;
- linked project task creation through the existing task service;
- linked task visibility shaping;
- completion gating.

Frontend tests should cover:

- project status labels;
- project progress helpers;
- event label formatting;
- project register source guards;
- idea detail source guards for project actions.

Full validation should run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_project_service.py tests/test_projects_api.py -q
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

## Acceptance Criteria

- A new `Проекты` section exists in the web portal.
- Admin/moderator users can create direct projects.
- Accepted ideas can be converted into linked projects.
- Idea detail pages show linked projects.
- Project register supports status, owner, department, source idea, and created date filtering.
- Project detail pages show departments, milestones, linked tasks, comments, and history.
- Project tasks are created through the existing task service.
- Linked task details follow existing task visibility rules.
- Project completion is blocked until linked tasks are closed.
- Project deletion is soft deletion and is blocked once linked tasks exist.
- Direct `Idea -> Tasks` remains available for small ideas.
