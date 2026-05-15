# Content Factory Sprint 16 Threaded Activity Plan

**Goal:** Add threaded replies to the guest story activity journal.

**Architecture:** Extend the existing Sprint 14 event table with optional self-referential `parent_event_id`, validate reply parents in `GuestStoryService`, keep the API response flat for backward compatibility, and build the nested display in the existing guest activity panel.

**Design:** `docs/superpowers/specs/2026-05-14-content-factory-sprint-16-threaded-activity-design.md`

## Files

- Modify `backend/app/db/models.py`
- Modify `backend/app/db/schemas.py`
- Create `backend/alembic/versions/044_cf_guest_story_event_threads.py`
- Modify `backend/app/services/content_factory/guest_story_service.py`
- Modify `backend/app/api/content_factory/guests.py`
- Modify backend focused tests:
  - `backend/tests/test_content_factory_models.py`
  - `backend/tests/test_content_factory_schemas.py`
  - `backend/tests/test_content_factory_guest_story_migration.py`
  - `backend/tests/test_cf_guest_story_service.py`
  - `backend/tests/test_content_factory_guest_stories_api.py`
- Modify `frontend/src/lib/types.ts`
- Modify `frontend/src/components/content-factory/ContentFactoryGuestActivityPanel.tsx`
- Modify frontend source guards:
  - `frontend/src/lib/contentFactoryApiSourceGuards.test.ts`
  - `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`
- Update durable docs:
  - `docs/PLAN.md`
  - `docs/STATUS.md`
  - `docs/TEST_PLAN.md`
  - `docs/BACKLOG.md`

## Phase 1: Plan And Test Shape

- [x] Make Sprint 16 the active repository plan.
- [x] Add backend tests expecting `parent_event_id` in model, schema, migration, service, and API behavior.
- [x] Add frontend source guards expecting `parent_event_id`, reply state, reply action, and nested reply rendering.
- [x] Run focused tests once to confirm the new expectations fail for the right reasons.

## Phase 2: Backend Thread Contract

- [x] Add `parent_event_id` to `CFGuestStoryEvent`.
- [x] Add self-referential relationship metadata and index.
- [x] Add Alembic revision `044_cf_guest_event_threads`.
- [x] Add `parent_event_id` to create and response schemas.
- [x] Validate reply parent ownership in `GuestStoryService`.
- [x] Pass `parent_event_id` through the create endpoint and return 404 for invalid parents.

## Phase 3: Frontend Thread UI

- [x] Add `parent_event_id` to event types and create request.
- [x] Build a parent/reply tree from the flat event response.
- [x] Render replies nested under their parent.
- [x] Add `Ответить` and `Отменить ответ` interactions.
- [x] Submit replies with `parent_event_id`.
- [x] Keep the panel compact and readable on desktop and mobile.

## Phase 4: Verification And Integration

- [x] Run backend focused tests.
- [x] Run `alembic heads`.
- [x] Run frontend source guards.
- [x] Run frontend full test, typecheck, lint, and build.
- [x] Run `git diff --check`.
- [x] Update status docs with final verification.
- [x] Commit, merge to `main`, and push.

## Validation Commands

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_content_factory_guest_stories_api.py tests/test_cf_guest_story_service.py tests/test_content_factory_models.py tests/test_content_factory_schemas.py tests/test_content_factory_guest_story_migration.py -q
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test alembic heads
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```
