# Status

## Meeting Board Focus

- Current phase: implemented; automated verification passed
- Spec: `docs/superpowers/specs/2026-05-08-meeting-board-focus-design.md`
- Plan: `docs/superpowers/plans/2026-05-08-meeting-board-focus.md`
- Scope: meeting board topical focus labels, new section, section wording cleanup, compact scope settings
- Latest progress:
  - Added `focus_label_ids` to meeting board settings data contract and migration.
  - Added backend focus filtering for participant, added-member, and added-department tasks.
  - Kept pinned tasks as focus-filter exceptions while preserving existing visibility checks.
  - Added the `new` board group and excluded cancelled tasks from board grouping.
  - Updated frontend board section order and wording.
  - Added a restricted meeting-focus label picker, compact scope summary, and moderator settings sheet.
- Key approved decisions:
  - Use existing task labels for meeting focus; do not add a Project or Workspace entity.
  - If no focus labels are selected, preserve current task selection behavior.
  - Focus labels do not grant visibility and do not attach labels to tasks.
  - Pinned tasks bypass only the focus filter, not task visibility.
  - MeetingSchedule-level default focus labels stay a future enhancement.
- Latest verification:
  - `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_board_service.py tests/test_meeting_board_api.py -q` passed: 11 tests.
  - `cd frontend && npm test` passed: 36 tests.
  - `cd frontend && npx tsc --noEmit` passed.
  - `cd frontend && npm run lint` passed.
  - `cd frontend && npm run build` passed, including `/meetings/[id]/board`.
  - `git diff --check` passed.

## Long Meeting Audio Transcription

- Current phase: implemented; automated verification passed
- Spec: `docs/superpowers/specs/2026-05-07-long-meeting-audio-transcription-design.md`
- Plan: `docs/superpowers/plans/2026-05-07-long-meeting-audio-transcription.md`
- Scope: durable queued transcription for one- to two-hour Zoom recordings, OpenAI-safe chunking, progress UI, and requester notifications
- Latest progress:
  - Added durable queue/progress fields to `meeting_ai_processing`.
  - Added `ffmpeg` audio preparation that converts long recordings into safe MP3 chunks.
  - Reworked manual audio transcription so the API queues work instead of blocking the browser.
  - Added a backend scheduler that claims queued/stale transcription jobs from PostgreSQL.
  - Added in-app and Telegram notifications for the moderator who started transcription.
  - Added frontend processing polling, progress labels, and leave-the-page guidance.
  - Added `ffmpeg` to backend Docker images for Railway deployment.
- Key approved decisions:
  - Keep the first release in the existing backend service rather than adding Redis/Celery or a separate Railway worker.
  - Use PostgreSQL as the durable queue.
  - Transcribe chunks sequentially for simpler reliability and rate-limit behavior.
  - Keep Zoom audio temporary only; store the final transcript and metadata.
- Latest verification:
  - `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_ai_outcomes_service.py tests/test_meeting_ai_outcomes_api.py -q` passed: 38 tests.
  - `cd frontend && npm test -- MeetingAiOutcomesPanelUtils.test.ts` passed: 34 tests.
  - `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q` passed: 363 tests.
  - `cd frontend && npm test` passed: 34 tests.
  - `cd frontend && npx tsc --noEmit` passed.
  - `cd frontend && npm run lint` passed.
  - `cd frontend && npm run build` passed, including `/meetings/[id]`.
  - `git diff --check` passed.

## Meeting Board and AI Outcomes

- Current phase: implemented and verified
- Spec: `docs/superpowers/specs/2026-05-07-meeting-board-and-ai-outcomes-design.md`
- Plan: `docs/superpowers/plans/2026-05-07-meeting-board-and-ai-outcomes.md`
- Scope: shareable meeting board, hybrid task context, manual Zoom audio transcription, moderator-reviewed AI outcomes
- Latest progress:
  - Backend meeting board settings, scope computation, visible task sections, and board API are implemented.
  - Manual Zoom audio transcription is moderator-triggered, uses temporary audio files only, and stores transcript text plus processing metadata.
  - AI outcome draft generation creates editable summary, decisions, and task candidates.
  - Publishing is moderator-confirmed and now requires `draft_ready` on both the frontend and backend API path.
  - The frontend meeting detail page opens a separate shareable board route and shows a moderator-only AI outcomes panel.
  - The board route displays scope counts, task sections, materials, and notes; inline board-composition editing remains a follow-up UI on top of the implemented settings API.
- Key approved decisions:
  - The meeting board is a separate shareable surface from the meeting detail page.
  - Audio transcription is manual-only in the first release.
  - Zoom audio is not persisted in portal storage.
  - Default transcription model is `gpt-4o-mini-transcribe`.
  - AI creates only editable drafts; moderator confirmation is required before tasks are created.
- Latest verification:
  - `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_board_service.py tests/test_meeting_board_api.py tests/test_meeting_ai_outcomes_service.py tests/test_meeting_ai_outcomes_api.py -q` passed: 37 tests.
  - `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q` passed: 354 tests.
  - `cd frontend && npm test` passed: 32 tests.
  - `cd frontend && npx tsc --noEmit` passed.
  - `cd frontend && npm run lint` passed.
  - `cd frontend && npm run build` passed, including `/meetings/[id]/board`.
  - `git diff --check` passed.
  - Frontend dev server started at `http://127.0.0.1:3003`; in-app browser smoke confirmed unauthenticated `/meetings` and `/meetings/{id}/board` reach the existing login flow.
  - Authenticated visual QA for the actual meeting board and AI outcomes panel remains a manual check because no logged-in local session/backend fixture was available in this run.

## Task Board Visual Polish

- Current phase: implemented, automated verification passed; authenticated browser QA pending
- Spec: `docs/superpowers/specs/2026-05-06-task-board-visual-polish-design.md`
- Plan: `docs/superpowers/plans/2026-05-06-task-board-visual-polish.md`
- Scope: frontend-only visual cleanup for the new task dialog, task board cards, checklist card spacing, and empty Kanban columns
- Latest progress:
  - New task dialog compact layout is implemented.
  - Description starts collapsed and expands on demand.
  - Labels and urgency share one row on desktop dialog widths.
  - Urgent board cards keep the red left edge and no longer show the footer `Срочно` badge.
  - Empty Kanban columns use a quiet dashed drop-zone instead of the old illustration and copy.
- Latest verification:
  - Baseline `cd frontend && npm test` passed before implementation: 18 tests.
  - `cd frontend && npm test` passed: 18 tests.
  - `cd frontend && npx tsc --noEmit` passed.
  - `cd frontend && npm run lint` passed.
  - `cd frontend && npm run build` passed.
  - `git diff --check` passed.
  - Frontend dev server started at `http://127.0.0.1:3002`; in-app browser opened `/tasks` and reached the login screen. Authenticated visual QA for the actual task board remains a manual check because no logged-in local session/backend fixture was available in this run.

## Task Urgency and Create Checklist

- Current phase: implemented and verified
- Spec: `docs/superpowers/specs/2026-05-06-task-urgency-and-create-checklist-design.md`
- Plan: `docs/superpowers/plans/2026-05-06-task-urgency-and-create-checklist.md`
- Scope: binary urgency across backend, frontend, bot, AI, notifications, reminders, analytics, and create-dialog checklist
- Latest progress:
  - Approved design recorded and committed.
  - Detailed implementation plan created and linked from `docs/PLAN.md`.
  - Planned legacy mapping is `urgent/high -> urgent` and `medium/low -> normal`.
  - Backend urgency domain, migration, schemas, service creation, API filters, AI parsing, meeting task creation, bot flows, notifications, and reminder digests now normalize to `normal` or `urgent`.
  - Backend task defaults now use `normal`; legacy `high`, `medium`, and `low` inputs remain accepted and normalized.
  - Frontend urgency helpers, filter chips, task board filters, task cards, dashboard task cards, create-dialog checklist drafting, and task detail urgency editing are implemented.
  - Meeting preview, meeting task list, analytics distribution, and reminder settings copy now use urgency language.
- Latest verification:
  - `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_task_urgency.py tests/test_task_update_permissions.py tests/test_reminder_digest_section_order.py tests/test_task_label_task_api.py tests/test_task_permission_service.py -q` passed: 45 tests.
  - `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q` passed: 317 tests.
  - `cd frontend && npm test && npx tsc --noEmit` passed: 18 tests plus TypeScript check.
  - `cd frontend && npm run lint && npm run build` passed.
  - `git diff --check` passed.
  - Frontend dev server started at `http://127.0.0.1:3001`; `curl -I -L http://127.0.0.1:3001/tasks` returned `HTTP 200 OK`.
  - Browser automation for in-app visual QA was unavailable in the active tool set, so authenticated visual checks for urgent/overdue card coexistence and create-dialog checklist submission remain a manual check in the running app.

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
