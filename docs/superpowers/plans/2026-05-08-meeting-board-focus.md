# Meeting Board Focus Implementation Plan

> **For agentic workers:** Execute only after the design in `docs/superpowers/specs/2026-05-08-meeting-board-focus-design.md` is approved. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add topical focus labels and improved task sections to the meeting board while preserving existing task visibility and backwards-compatible empty-focus behavior.

**Architecture:** Extend the existing per-meeting `meeting_board_settings` record with `focus_label_ids`. Keep task labels as the classification layer. Compute board candidates as focused people/department scope plus pinned exceptions, then apply the existing visibility checks. On the frontend, reuse label display/picker primitives in a restricted board-focus mode and replace the persistent scope panel with a compact summary plus expandable settings surface.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, Pydantic, Alembic, PostgreSQL UUID arrays, Next.js, React, TypeScript, Tailwind, existing task label components, Python pytest, frontend Node tests.

---

## Source Documents

- Design spec: `docs/superpowers/specs/2026-05-08-meeting-board-focus-design.md`
- Existing meeting board spec: `docs/superpowers/specs/2026-05-07-meeting-board-and-ai-outcomes-design.md`
- Existing task labels spec: `docs/superpowers/specs/2026-05-05-task-labels-design.md`

## File Structure

- Modify `backend/app/db/models.py`: add `MeetingBoardSettings.focus_label_ids`.
- Add Alembic migration under `backend/alembic/versions/`: add the `focus_label_ids` UUID array with empty default.
- Modify `backend/app/db/schemas.py`: add `focus_label_ids` to board settings update/response; add a `new` board group to response.
- Modify `backend/app/services/meeting_board_service.py`: add focused scope filtering, pinned exceptions, cancelled exclusion, and a `new` group.
- Modify `backend/app/api/meetings.py`: return the new board group and validate updated settings through schemas.
- Modify `backend/tests/test_meeting_board_service.py`: cover focused filtering, pinned exceptions, new section, cancelled exclusion, and completed window behavior.
- Modify `backend/tests/test_meeting_board_api.py`: cover update/response shape and moderator-only update.
- Modify `frontend/src/lib/types.ts`: add `focus_label_ids` and the `new` board section type.
- Modify `frontend/src/lib/api.ts`: allow `focus_label_ids` in board settings updates.
- Modify `frontend/src/components/meetings/meetingBoardUtils.ts`: include `new`, rename review label, and update completed wording.
- Modify `frontend/src/components/meetings/meetingBoardUtils.test.ts`: update section order and labels.
- Modify `frontend/src/components/meetings/meetingBoardPresentationUtils.ts`: include focus label count/summary helpers.
- Modify `frontend/src/components/meetings/MeetingBoardScopePanel.tsx`: convert the current panel into a compact summary plus expandable settings surface.
- Modify `frontend/src/app/meetings/[id]/board/page.tsx`: pass update/reload handlers into the scope component.
- Optionally modify `frontend/src/components/tasks/TaskLabelPicker.tsx`: add props to disable create/manage actions for board focus usage.
- Update `docs/STATUS.md` and `docs/TEST_PLAN.md` after implementation.

## Tasks

### Task 1: Backend Data Contract

- [ ] Add `focus_label_ids` to `MeetingBoardSettings`.
- [ ] Add a migration with `server_default="{}"` and `nullable=False`.
- [ ] Add `focus_label_ids` to `MeetingBoardSettingsUpdate`.
- [ ] Add `focus_label_ids` to `MeetingBoardSettingsResponse`.
- [ ] Add the `new` section to `MeetingBoardResponse`.
- [ ] Run focused backend schema/API tests.

Validation:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_board_api.py -q
```

### Task 2: Backend Board Selection Logic

- [ ] Update `BoardTaskGroups` with `new`.
- [ ] Update `group_board_tasks` to exclude `cancelled` first.
- [ ] Keep urgent active tasks in `urgent`.
- [ ] Add non-urgent `new` tasks to the new section.
- [ ] Keep `done` tasks in the completed section only when `completed_at` is within the last 7 days.
- [ ] Update `_load_visible_tasks` so focus labels filter only participant, added-member, and added-department scope.
- [ ] Keep pinned tasks as separate exceptions to focus labels.
- [ ] Keep existing visible department filtering and final `can_access_task` checks.

Validation:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_board_service.py -q
```

### Task 3: Frontend Types and Section Labels

- [ ] Add `new` to `MeetingBoardSectionKey`.
- [ ] Add `new: Task[]` to `MeetingBoardResponse`.
- [ ] Add `focus_label_ids` to `MeetingBoardSettings`.
- [ ] Allow `focus_label_ids` in `updateMeetingBoardSettings`.
- [ ] Update `MEETING_BOARD_SECTIONS` order to urgent, new, in progress, review, done.
- [ ] Rename review section display text to `На согласовании`.
- [ ] Rename completed section display text to `Выполнено за 7 дней`.
- [ ] Update frontend section tests.

Validation:

```bash
cd frontend && npm test -- meetingBoardUtils.test.ts
cd frontend && npx tsc --noEmit
```

### Task 4: Focus Picker UX

- [ ] Add a restricted task label picker mode if the existing picker cannot disable create/edit/archive/manage actions cleanly.
- [ ] Use the restricted picker for `Фокус встречи`.
- [ ] Let moderators update `focus_label_ids` from the meeting board.
- [ ] Reload the board after saving focus settings.
- [ ] Show selected focus labels as chips in the compact board scope summary.
- [ ] Show a clear empty state when no focus is selected.
- [ ] Keep regular participants read-only.

Validation:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
```

### Task 5: Compact Scope Surface

- [ ] Replace the always-visible left scope panel with a compact summary that does not consume the task grid column.
- [ ] Add a moderator-only settings trigger.
- [ ] Open scope settings in a drawer/sheet.
- [ ] Keep added people, departments, pinned tasks, focus labels, and counts understandable.
- [ ] Preserve the current materials and board notes display unless the implementation naturally moves them into the same settings surface.
- [ ] Check desktop and narrow layouts so task sections receive more space than before.

Validation:

```bash
cd frontend && npm run build
```

### Task 6: Documentation and Final Verification

- [ ] Update `docs/STATUS.md`.
- [ ] Update `docs/TEST_PLAN.md`.
- [ ] Run focused backend tests.
- [ ] Run full frontend tests and typecheck.
- [ ] Run lint/build where touched code requires it.
- [ ] Run `git diff --check`.

Validation:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_board_service.py tests/test_meeting_board_api.py -q
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

## Manual QA

1. Open a meeting board without focus labels and confirm the board behaves like the current board, with the added `New` section.
2. Select a focus label and confirm unrelated participant tasks disappear.
3. Confirm a participant task with any selected focus label remains visible.
4. Confirm a pinned task without the selected label remains visible.
5. Log in as a user with narrower task visibility and confirm matching focus labels do not reveal hidden tasks.
6. Confirm cancelled tasks do not appear.
7. Move a task to `done` and confirm it appears in `Выполнено за 7 дней`.
8. Confirm the `review` status appears as `На согласовании`.
9. Confirm the compact scope summary leaves more room for task sections during screen sharing.
