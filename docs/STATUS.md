# Status

## Task Urgency and Create Checklist

- Current phase: implementation planning complete
- Spec: `docs/superpowers/specs/2026-05-06-task-urgency-and-create-checklist-design.md`
- Plan: `docs/superpowers/plans/2026-05-06-task-urgency-and-create-checklist.md`
- Scope: binary urgency across backend, frontend, bot, AI, notifications, reminders, analytics, and create-dialog checklist
- Latest progress:
  - Approved design recorded and committed.
  - Detailed implementation plan created and linked from `docs/PLAN.md`.
  - Planned legacy mapping is `urgent/high -> urgent` and `medium/low -> normal`.
- Latest verification:
  - Pending implementation.

## Task Label Management

- Current phase: implemented and verified
- Spec: `docs/superpowers/specs/2026-05-06-task-label-management-design.md`
- Plan: `docs/PLAN.md`
- Scope: web portal label colors, member-owned label actions, moderator cleanup UI
- Latest progress:
  - Backend label palette, capability fields, management endpoints, archived-label behavior, and shared-label permission checks are implemented.
  - Frontend picker color creation, member-owned edit/archive actions, and moderator Settings management UI are implemented.
  - Task 1 through Task 6 passed spec compliance and code quality review checkpoints.
- Latest verification:
  - `cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_task_label_repository.py tests/test_task_label_api.py tests/test_task_label_task_api.py tests/test_task_permission_service.py tests/test_task_update_permissions.py -q` passed: 66 tests.
  - `cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q` passed: 309 tests.
  - `cd frontend && npm test` passed: 14 tests.
  - `cd frontend && npx tsc --noEmit` passed.
  - `cd frontend && npm run lint` passed.
  - `git diff --check` passed.
  - Browser smoke started the frontend at `http://127.0.0.1:3001`; unauthenticated `/tasks` and `/settings?tab=task-labels` requests redirected to `/login`, so authenticated moderator UI smoke remains a manual check.

## Task Labels

- Current phase: implementation verification
- Spec: `docs/superpowers/specs/2026-05-05-task-labels-design.md`
- Plan: `docs/PLAN.md`
- Scope: web portal task labels only
- Out of scope: Telegram labels, label analytics, personal labels, moderator cleanup UI
- Latest verification:
  - Full backend test suite passes.
  - Frontend TypeScript check passes.
  - Frontend Node test script passes after fixing its direct TypeScript import resolution.
  - Frontend dev server smoke-tested on `http://127.0.0.1:3001/login`.

## Task Filter Sheet

- Current phase: implemented and verified
- Spec: `docs/superpowers/specs/2026-05-06-task-filter-sheet-design.md`
- Plan: `docs/PLAN.md`
- Scope: frontend task board filter layout only
- Latest verification:
  - Frontend Node test script passes.
  - Frontend ESLint check passes.
  - Frontend TypeScript check passes.
  - Frontend production build passes.
  - Narrow/mobile browser QA passed against a local mock API: filters open in a bottom sheet, labels are first, all filter controls share the same trigger visual, labels support multi-select without closing the sheet, and active label chips collapse to `+N меток`.
  - Final review fixes were applied: quick reset returned to the active chip row, filter controls gained small accessibility polish, and background refresh loading/rendering is scoped to the current user.
  - Narrow/mobile browser QA rechecked the quick reset path after final review fixes.
  - Desktop/right-sheet behavior was reviewed in code and by implementation reviewers; visual desktop QA remains limited by the fixed in-app browser viewport.
