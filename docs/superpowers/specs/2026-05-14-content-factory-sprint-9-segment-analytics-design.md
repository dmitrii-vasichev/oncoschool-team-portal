# Content Factory Sprint 9 Segment Usage Analytics Design

## Context

Sprint 8 added the segment registry, segment detail page, population refreshes, and snapshot history. The next backlog item is to show how external segments are actually used across publications and bundles, without introducing publishing integrations or a separate analytics backend too early.

The current API already exposes the required operational records:

- `GET /api/content-factory/segments?only_active=false`
- `GET /api/content-factory/publications?limit=500`
- `GET /api/content-factory/bundles?limit=500`
- `GET /api/content-factory/publications/{id}/segment-targets`
- `GET /api/content-factory/publications/{id}/metrics`

Sprint 9 should therefore stay frontend-heavy. It should aggregate these records in the browser into a practical usage workspace for the content team.

## Goal

Add a Content Factory segment usage analytics workspace that answers:

- Which segments are used, unused, or overused?
- Which publications and bundles depend on each segment?
- Which targeting roles are used for a segment?
- Which segments have published/outcome evidence through publication status and manual metric snapshots?

## Non-Goals

- Do not add a new backend analytics table.
- Do not add GetCourse synchronization.
- Do not infer business performance from arbitrary metric values.
- Do not make segment update/deactivate/delete flows part of this sprint.
- Do not build charts that imply statistical accuracy before enough metric discipline exists.

## User Experience

Add `/content-factory/segments/analytics` as a dense operational workspace.

The page has:

- Summary cards for segments in use, unused active segments, target links, published publications, and metric evidence.
- Filters for search, usage state, and segment role.
- A compact row for each segment showing population, publication count, bundle count, role mix, bundle status mix, published count, metric evidence count, and latest activity.
- Links back to segment detail and the most recent related publications.

The existing segment registry should expose a small `Analytics` action so users naturally move from maintaining the registry to understanding usage.

## Data Model

Use pure frontend helper types:

- `ContentFactorySegmentUsageInput`
- `ContentFactorySegmentUsageRow`
- `ContentFactorySegmentUsageSummary`
- `ContentFactorySegmentUsageFilters`

The builder joins:

- segment rows by `CFExternalSegment.id`
- publication target rows by `CFPublicationSegmentTarget.external_segment_id`
- publications by `CFPublication.id`
- bundles by `CFBundle.id`
- metric snapshots by `CFMetricSnapshot.publication_id`

Role counts and bundle status counts should use stable Content Factory enum keys. Latest activity should prefer latest manual metric capture, then actual publish time, scheduled time, and publication update time.

## Error Handling

The analytics page should load core lists together. Per-publication target and metric requests may fail independently, because missing one publication should not blank the whole workspace. If any secondary request fails, show the page with available data and a toast explaining that some analytics evidence could not be loaded.

If all core records fail to load, show the existing toast error pattern and an empty state.

## Testing

Add TDD coverage before implementation:

- Helper test: usage rows aggregate publication counts, bundle counts, role counts, published counts, metric evidence, and latest activity.
- Helper test: summary detects unused active segments.
- Helper test: filters combine search, usage state, and role.
- Source guard test: analytics route exists, loads segments/publications/bundles, loads target and metric evidence, uses the aggregation helpers, and is linked from navigation.

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

## Open Questions

- A backend aggregate endpoint may be needed later if the publication count grows enough for browser-side fan-out to become slow.
- Numeric outcome rollups should wait until metric names and windows are standardized by real usage.
