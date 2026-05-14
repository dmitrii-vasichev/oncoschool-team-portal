# Content Factory Sprint 8 Segment Workspace Design

## Goal

Make audience segments visible and maintainable as a first-class Content Factory workspace, so the team can inspect GetCourse segment mirrors, create manual segment records, refresh population counts, and compare snapshot changes over time.

## Context

Sprint 5 connected publications to segment targets, but segment management still happens indirectly from the publication detail page. The backend already exposes segment creation, list/read, population refresh, and snapshot history endpoints. Sprint 8 should use those existing endpoints and stay frontend-heavy.

## Scope

- Add `/content-factory/segments` as a segment registry.
- Add `/content-factory/segments/[id]` as a segment detail and snapshot history view.
- Add a create dialog for manual segment mirror records.
- Add a refresh dialog that records a new population count snapshot.
- Add helper functions for segment count formatting, search/filtering, owner/source labels, and latest-vs-previous snapshot deltas.
- Add sidebar and header navigation for the segment workspace.

## Permissions

Use the existing Content Factory guard:

- Admin users can access the segment workspace.
- Non-admin users with `has_content_factory_access=true` can access the same workspace.
- The backend currently allows create and refresh for Content Factory access users, so the first UI should follow that contract.

If stricter segment-owner or admin-only controls become necessary later, they should be added in the backend first.

## Data Model

Use the existing frontend/backend contracts:

- `CFExternalSegment`
- `CFExternalSegmentCreateRequest`
- `CFSegmentRefreshRequest`
- `CFSegmentSnapshot`

Supported create fields:

- `source`
- `source_segment_id`
- `source_url`
- `name`
- `description`
- `population_count`
- `is_active`
- `owner_id`

Supported refresh fields:

- `population_count`

The backend request type includes `note`, but the current service does not persist notes on snapshots. The first UI should avoid promising note storage.

## UX

The UI should remain operational and compact:

- Registry header with total/active/inactive counts, source filter, active filter, search, create action, and refresh action per row.
- Segment rows/cards should show name, source identity, population count, active state, owner, last fetched time, and link to detail.
- Detail view should show segment metadata, latest population, latest snapshot, previous snapshot, absolute delta, percentage delta, and snapshot history.
- Refresh dialog should be a small numeric form with clear validation.
- Empty state should explain that segments are created from known external segment IDs.

## Error Handling

- Invalid population counts should be caught client-side.
- API failures should use existing toast patterns.
- Missing segment detail should render a stable not-found empty state.
- Snapshot comparison should handle zero, one, and many snapshots without division-by-zero or misleading percentages.

## Out Of Scope

- Backend update/deactivate/delete endpoints.
- Automatic GetCourse API synchronization.
- Snapshot notes until the backend persists them.
- Segment deduplication, merge workflows, or ownership enforcement.
- Segment usage analytics across all publications.
