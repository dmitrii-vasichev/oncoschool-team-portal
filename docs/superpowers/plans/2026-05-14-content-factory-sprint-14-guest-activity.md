# Content Factory Sprint 14 Guest Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guest story activity journal with comments and automatic change events.

**Architecture:** Add a small backend event table and service methods, expose list/create comment endpoints under guest stories, then render the activity panel on the existing guest detail page. Keep event editing, deletion, reminders, and file audit trails out of scope.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, PostgreSQL JSONB, Pydantic, pytest, Next.js App Router, React client components, TypeScript, Node test runner.

---

## File Structure

- Modify `backend/app/db/models.py`: add `CFGuestStoryEvent` and `CFGuestStory.events`.
- Modify `backend/app/db/schemas.py`: add event type literal, create schema, and response schema.
- Create `backend/alembic/versions/043_content_factory_guest_story_events.py`: create the event table and indexes.
- Modify `backend/app/services/content_factory/guest_story_service.py`: list/create events, create comments, and auto-log watched field changes.
- Modify `backend/app/api/content_factory/guests.py`: add event list/create endpoints and pass actor id to create/update.
- Modify backend tests:
  - `backend/tests/test_content_factory_models.py`
  - `backend/tests/test_content_factory_schemas.py`
  - `backend/tests/test_cf_guest_story_service.py`
  - `backend/tests/test_content_factory_guest_stories_api.py`
  - `backend/tests/test_content_factory_guest_story_migration.py`
- Modify `frontend/src/lib/types.ts`: add guest story event types.
- Modify `frontend/src/lib/api.ts`: add guest story event methods.
- Create `frontend/src/components/content-factory/ContentFactoryGuestActivityPanel.tsx`: render activity and comment form.
- Modify `frontend/src/app/content-factory/guests/[id]/page.tsx`: load events and render panel.
- Modify frontend source guards:
  - `frontend/src/lib/contentFactoryApiSourceGuards.test.ts`
  - `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`
- Modify `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`.

## Tasks

### Task 1: Backend Failing Tests

**Files:**
- Modify backend model, schema, service, API, and migration tests listed above.

- [ ] Add tests that expect `CFGuestStoryEvent` model, event schemas, service comment creation, service auto-events, event endpoints, and migration revision `043_cf_guest_story_events`.
- [ ] Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_content_factory_guest_stories_api.py tests/test_cf_guest_story_service.py tests/test_content_factory_models.py tests/test_content_factory_schemas.py tests/test_content_factory_guest_story_migration.py -q
```

Expected: fail because the event model, schemas, service methods, endpoints, and migration do not exist yet.

### Task 2: Backend Event Model, Schema, Migration

**Files:**
- Modify `backend/app/db/models.py`
- Modify `backend/app/db/schemas.py`
- Create `backend/alembic/versions/043_content_factory_guest_story_events.py`

- [ ] Add `CFGuestStoryEvent`.
- [ ] Add `events` relationship to `CFGuestStory`.
- [ ] Add `CFGuestStoryEventType`, `CFGuestStoryEventCreate`, and `CFGuestStoryEventResponse`.
- [ ] Add Alembic table with indexes for guest story and created time.
- [ ] Run focused backend tests.

Expected: model, schema, and migration tests pass; service/API tests still fail.

### Task 3: Backend Service And API

**Files:**
- Modify `backend/app/services/content_factory/guest_story_service.py`
- Modify `backend/app/api/content_factory/guests.py`

- [ ] Add `list_events`, `create_event`, and `create_comment`.
- [ ] Update `create` to accept optional `actor_id` and create a `created` event.
- [ ] Update `update` to accept optional `actor_id` and auto-log watched field changes.
- [ ] Add `GET /events` and `POST /events` endpoints under guest story detail.
- [ ] Pass `member.id` from create/update endpoints.
- [ ] Run focused backend tests.

Expected: backend Sprint 14 focused tests pass.

### Task 4: Frontend Failing Source Guards

**Files:**
- Modify `frontend/src/lib/contentFactoryApiSourceGuards.test.ts`
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] Assert event types and API methods exist.
- [ ] Assert `ContentFactoryGuestActivityPanel.tsx` exists.
- [ ] Assert the guest detail route loads `api.getCFGuestStoryEvents(id)` and renders `ContentFactoryGuestActivityPanel`.
- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because frontend event types, API methods, and panel do not exist yet.

### Task 5: Frontend Event Types, API, Panel, Route

**Files:**
- Modify `frontend/src/lib/types.ts`
- Modify `frontend/src/lib/api.ts`
- Create `frontend/src/components/content-factory/ContentFactoryGuestActivityPanel.tsx`
- Modify `frontend/src/app/content-factory/guests/[id]/page.tsx`

- [ ] Add event types and API client methods.
- [ ] Build activity panel with Russian labels, newest-first list, old/new values, actor names, and comment form.
- [ ] Load activity on guest detail route and refresh after comment or edit.
- [ ] Run focused frontend tests.

Expected: focused frontend source guards pass.

### Task 6: Validate, Document, Commit

**Files:**
- Modify docs listed above.

- [ ] Run backend focused tests.
- [ ] Run frontend focused tests.
- [ ] Run full frontend test, typecheck, lint, build.
- [ ] Run `git diff --check`.
- [ ] Update docs with actual verification results.
- [ ] Commit Sprint 14.
