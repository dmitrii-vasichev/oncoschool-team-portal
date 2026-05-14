# Content Factory Sprint 10 Effectiveness Analytics Design

## Context

Sprint 5 introduced manual metric snapshots on publication detail pages. Sprint 8 and Sprint 9 added audience registry and audience usage analytics. Sprint 9.5 consolidated navigation, Russian labels, and help so the Content Factory is easier to use before deeper analytics work.

The next useful layer is not automated publishing or external metric integrations. The research explicitly warns against making reactions the main KPI and recommends objective-aware operating reviews based on metric snapshots, confidence, freshness, and funnel intent.

The current API already exposes the data needed for a first effectiveness view:

- `GET /api/content-factory/publications?limit=500`
- `GET /api/content-factory/bundles?limit=500`
- `GET /api/content-factory/platforms`
- `GET /api/content-factory/formats`
- `GET /api/content-factory/publications/{id}/segment-targets`
- `GET /api/content-factory/publications/{id}/metrics`

Sprint 10 should therefore stay frontend-heavy. It should aggregate existing operational records in the browser and make missing/stale evidence visible before any backend analytics endpoint is added.

## Goal

Add a Content Factory effectiveness workspace that answers:

- Which published or scheduled publications have outcome evidence?
- Which publications still have no manual metric snapshots?
- Which metric evidence is stale enough to revisit before retrospectives?
- Which objectives, channels, formats, and campaigns have the most evidence?
- Which publication rows should be opened next to add metrics or inspect results?

## Non-Goals

- Do not add a new backend analytics table or aggregate endpoint in this sprint.
- Do not connect external platform APIs.
- Do not create revenue attribution or paid-media reporting.
- Do not rank creative quality from reactions alone.
- Do not infer medical, commercial, or editorial success from a single universal metric.
- Do not replace retrospective judgment with a score.

## User Experience

Add `/content-factory/effectiveness` as a dense operational workspace named `Эффективность`.

The page has:

- Summary cards for total analyzed publications, published publications, rows with evidence, rows without evidence, and stale evidence.
- Filters for search, objective, metric state, and platform.
- A compact table for each publication showing campaign, platform, format, inferred objective, publication status, latest metric, metric count, freshness state, target audience evidence, and links to publication/campaign detail.
- A small note when per-publication metric or target evidence only partially loaded.

The page should feel like an internal operating dashboard: compact, scannable, and evidence-first. It must not look like a marketing landing page or a decorative report.

## Data Model

Use pure frontend helper types:

- `ContentFactoryEffectivenessInput`
- `ContentFactoryEffectivenessRow`
- `ContentFactoryEffectivenessSummary`
- `ContentFactoryEffectivenessFilters`

The row builder joins:

- publications by `CFPublication.id`
- bundles by `CFBundle.id`
- platforms by `CFPlatform.id`
- formats by `CFFormat.id`
- segment targets by `CFPublicationSegmentTarget.publication_id`
- metric snapshots by `CFMetricSnapshot.publication_id`

Objective inference:

- Prefer `CFFormat.default_objective`.
- Fall back to `unknown` when no format or objective exists.

Metric health:

- `fresh`: at least one metric snapshot captured within the configured freshness window.
- `stale`: metric snapshots exist, but the latest snapshot is older than the freshness window.
- `missing`: no metric snapshots exist.

Freshness window:

- Use 8 days by default so the 7-day metric window has one operational day of slack.

Latest metric:

- Prefer the most recently captured metric snapshot.
- Display the metric name, formatted metric value, window, confidence, and captured time.

## Error Handling

The effectiveness page should load core lists together. Per-publication target and metric requests may fail independently. If a secondary request fails, render the page with available data and show a toast explaining that some evidence could not be loaded.

If core records fail to load, show the existing toast error pattern and an empty state.

## Testing

Add TDD coverage before implementation:

- Helper test: effectiveness rows infer objective from format, attach campaign/platform/format labels, count metrics, identify latest metric, and sum target evidence.
- Helper test: summary counts published publications, evidence coverage, missing evidence, and stale evidence.
- Helper test: filters combine search, objective, metric health, and platform.
- Source guard test: effectiveness route exists, loads publications/bundles/platforms/formats, loads per-publication segment targets and metrics, uses effectiveness helpers, and is present in Content Factory navigation/header/help.

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

- A backend aggregate endpoint may be needed later if browser-side fan-out becomes slow.
- Real team usage may reveal a stable objective-to-primary-metric map; until then Sprint 10 should show evidence, not overfit a scoring model.
- External metric integrations should be evaluated after the manual ledger has enough real rows to justify maintenance cost.
