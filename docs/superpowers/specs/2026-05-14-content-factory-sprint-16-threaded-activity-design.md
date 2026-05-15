# Content Factory Sprint 16 Threaded Activity Design

## Context

Sprint 14 added the guest story activity journal with manual comments and automatic key-change events. Sprint 15 added attention signals so producers can see which stories need action.

The next useful slice is conversation structure inside that journal. A flat list works for basic logging, but follow-up questions, consent clarifications, and producer/editor decisions need a lightweight way to reply to a specific event without creating a separate task system.

## Goal

Add threaded replies to guest story activity.

Users should be able to:

- Reply to an existing guest story activity event.
- See replies nested under the event they answer.
- Keep using the existing comment form for top-level comments.
- Understand reply context without seeing raw ids or system field names.

## Scope

In scope:

- Add an optional `parent_event_id` to `cf_guest_story_event`.
- Validate that a reply parent belongs to the same guest story.
- Expose `parent_event_id` in event create and response schemas.
- Allow `POST /api/content-factory/guests/{guest_story_id}/events` to create a top-level comment or a reply.
- Render nested replies inside `ContentFactoryGuestActivityPanel`.
- Add a visible reply affordance and a clear cancel-reply state.

Out of scope:

- Notifications.
- Mentions.
- Editing or deleting events.
- File attachments.
- Separate discussion pages.
- Arbitrary user-created system events.
- Stage-history redesign.

## Backend Contract

`CFGuestStoryEvent` gains:

- `parent_event_id: UUID | None`

Rules:

- `parent_event_id` is optional.
- If provided, it must reference an existing `cf_guest_story_event` row.
- The parent event must have the same `guest_story_id` as the event being created.
- Automatic system events remain top-level.
- Deleting a guest story still deletes all its activity.
- Deleting a parent event should delete replies through the self-referential cascade, even though event deletion is not exposed in the UI yet.

## API

`CFGuestStoryEventCreate`:

- `body`
- `parent_event_id`

`CFGuestStoryEventResponse`:

- existing fields
- `parent_event_id`

`POST /api/content-factory/guests/{guest_story_id}/events`:

- Creates a comment when `parent_event_id` is omitted.
- Creates a reply when `parent_event_id` is provided.
- Returns `404` with a Russian user-facing detail when the parent event is missing or belongs to another guest story.

## Frontend

The guest detail activity panel remains the only UI surface.

Behavior:

- Top-level events render newest first.
- Replies render under their parent with visual indentation.
- Reply chains can be nested, but the layout should stay compact.
- Each event has an `Ответить` action.
- When replying, the form shows a small context line with the selected event and an `Отменить ответ` action.
- Submitting a reply sends `parent_event_id`.
- After submit, the reply state resets and the activity list refreshes.

## Risks

- Recursive rendering can loop if bad data ever introduces a cycle. The UI should keep rendering simple and defensively avoid re-rendering already visited events.
- A flat API response is easier to keep backward-compatible, but the frontend must build the tree deterministically.
- A self-referential Alembic revision id must stay under the production `alembic_version.version_num` 32-character limit.

## Verification

Automated checks:

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
