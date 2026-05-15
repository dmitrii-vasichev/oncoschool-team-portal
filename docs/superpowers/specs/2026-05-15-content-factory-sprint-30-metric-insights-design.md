# Content Factory Sprint 30 Metric Insights Design

## Context

Sprint 29 added a frontend-only paste import flow for publication metric snapshots. Users can now bring several rows from TGStat, VK, GetCourse, email dashboards, or spreadsheets into a publication without entering every metric manually.

The remaining usability gap is interpretation. The publication detail page still treats metrics mostly as a chronological log. That is useful for audit, but it does not immediately answer whether the publication has enough evidence, which metric is currently strongest, whether key reporting windows are covered, or what the team should measure next.

## Goal

Add a compact publication-level metric insights panel that turns existing metric snapshots into a readable operational summary.

The panel should help a user answer:

- which metric groups have evidence;
- what the latest value is per metric name;
- what the best numeric value is per metric name;
- which standard windows have at least one metric;
- which follow-up measurement is still missing.

## Scope

- Frontend-only implementation.
- Pure helper in `frontend/src/lib/contentFactoryUtils.ts`.
- New component under `frontend/src/components/content-factory`.
- Publication detail page wiring above the metric history log.
- Helper tests and source guards.
- Durable plan/status/test docs.

## Non-Goals

- No backend schema, migration, endpoint, or aggregate API.
- No chart library.
- No automatic platform integrations.
- No metric editing or deletion.
- No deduplication or rollback logic.
- No cross-publication dashboard changes.

## UX

The new panel appears on the publication detail page before the full metric history. It should be titled `Сводка метрик`.

The panel has three compact parts:

1. Summary strip: total metric count, number of unique metric names, latest captured metric, and primary next action.
2. Metric groups: one row per metric name with latest value, readable labels, and best numeric value when numeric evidence exists.
3. Window coverage: standard windows `3h`, `24h`, `72h`, `7d`, and `final`, each marked as covered or missing.

Empty state:

- If there are no metrics, the panel explains that metrics can be added manually or imported from a report.

## Data Design

Add a helper named `getContentFactoryPublicationMetricInsights(metrics)`.

It returns:

- `totalMetrics`;
- `uniqueMetricNames`;
- `latestMetric`;
- `latestMetricLabel`;
- `nextAction`;
- `groups`;
- `windows`;
- `missingWindows`.

Each group includes:

- normalized display name;
- metric count;
- latest metric snapshot;
- latest value label;
- best numeric metric snapshot or `null`;
- best numeric value label or `null`;
- covered windows.

Sorting rules:

- Metric snapshots are sorted by `captured_at` descending for latest values.
- Groups sort by latest captured time descending.
- Best numeric value uses the highest numeric `metric_value`.
- Missing or non-numeric values do not participate in best numeric selection.

## Next Action Rules

- No metrics: `Добавьте первые метрики вручную или через импорт.`
- Missing `24h`: `Добавьте срез 24 часа.`
- Missing `7d`: `Добавьте срез 7 дней.`
- Missing `final`: `Добавьте финальный срез.`
- Any low-confidence metric: `Проверьте метрики с низким доверием.`
- Otherwise: `Метрики покрывают основные срезы.`

The order intentionally favors early operational windows before final cleanup.

## Testing

Automated tests:

- helper groups metrics by name and picks latest and best numeric values;
- helper reports missing window coverage and next action;
- helper handles empty metrics;
- source guard confirms the publication detail page renders the insights component above metric history.

Manual QA:

- open a publication with no metrics and confirm the empty state;
- add or import metrics for `24h` and `7d`;
- confirm latest/best values and window coverage update after refresh;
- confirm the full metric history still works below the insights panel.
