# Content Factory Sprint 17 Guest Stage Timeline Design

## Context

Sprint 14 added guest story activity events. Sprint 15 added attention signals. Sprint 16 added threaded replies. The guest detail page now has enough data to show not only the current state, but the route a guest story took through the pipeline.

The preserved research describes patient and guest sourcing as a pipeline: sourcing, screening, consent, preparation, publication, gift delivery, and follow-up. The current UI shows the current status and activity, but it does not make stage movement easy to scan.

## Goal

Add a readable `Путь истории` panel to the guest story detail page.

Users should be able to:

- See the status path for one guest story.
- Understand when the story entered each stage.
- See which stage is current.
- See how long the current stage has been active.
- Spot stories that are active but have no next-step deadline.

## Scope

In scope:

- Build a frontend helper that derives a timeline from `CFGuestStory` and flat `CFGuestStoryEvent[]`.
- Use existing `created` and `status_changed` events.
- Fall back to the current story status and `created_at` when old stories have no activity events.
- Add a compact `ContentFactoryGuestStageTimelinePanel` to `/content-factory/guests/[id]`.
- Add source guards and helper tests.

Out of scope:

- New backend tables.
- New API endpoints.
- Backfilling historical stage rows.
- Editing stage history.
- Notifications or reminders.
- Intake imports, consent document storage, or gift automation.

## Timeline Derivation

The helper should:

1. Sort relevant guest story events oldest first.
2. Choose the first stage from:
   - a `created` event `new_value`, if it is a known guest story status;
   - otherwise the first `status_changed.old_value`, if it is known;
   - otherwise the story current status.
3. Start the first stage at the `created` event date or `story.created_at`.
4. For every `status_changed` event with a known `new_value`, close the previous stage and start the new one at the event date.
5. Mark the last item as current.
6. Use `now` for the current item end time so tests stay deterministic.

The helper should not expose raw enum values in labels. Unknown or malformed event values should be ignored.

## UI

Place the panel on the guest detail page between the attention panel and the detailed story panels.

The panel should show:

- Title: `Путь истории`
- Subtitle: `Этапы, через которые прошла история гостя.`
- A small summary row with:
  - current stage label;
  - days in current stage;
  - next-step date or `Срок не назначен`.
- A vertical timeline of stages:
  - status label;
  - start date;
  - duration label;
  - current-stage badge.

For active stories with no `stage_due_at`, show a gentle warning: `Назначьте следующий шаг, чтобы история не зависла.`

## Risks

- Older guest stories may have no activity events. The fallback should keep the panel useful instead of empty.
- Status events can be duplicated or malformed. The helper should skip duplicates and unknown statuses.
- The UI should stay compact because the detail page already has attention, detail, and activity panels.

## Verification

Automated checks:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```
