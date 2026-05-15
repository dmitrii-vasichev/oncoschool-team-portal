# Content Factory Sprint 21 Metric Capture UX Design

## Context

Content Factory already supports manual metric snapshots on publication detail pages. This matches the recovered market research recommendation: start with a manual or semi-automated publishing ledger before attempting fragile channel API integrations.

The current metric UI is functional, but still exposes internal values such as `24h`, `tgstat`, `vk_api`, and `medium`. That weakens the user-facing Content Factory polish established in the previous UI sprints.

## Goal

Make manual metric capture readable for non-technical users.

Users should be able to:

- Pick common metric names without typing from scratch.
- See measurement windows in Russian.
- See metric sources in Russian or familiar product names.
- See confidence values as human labels.
- Read metric history and effectiveness evidence without raw enum values.

## Scope

In scope:

- Add shared frontend labels for metric windows, metric sources, and confidence values.
- Add shared metric-name presets for the manual metric dialog.
- Use the shared labels in `ContentFactoryMetricDialog`.
- Use the shared labels in `ContentFactoryMetricHistory`.
- Use the shared labels in `ContentFactoryEffectivenessTable`.
- Add focused helper tests and source guards.

Out of scope:

- Backend schema or API changes.
- Editing or deleting metric snapshots.
- Bulk metric import.
- Automatic API collection from Telegram, VK, GetCourse, email, Dzen, Max, or OK.
- Platform-specific metric validation rules.

## UI

The metric dialog should keep the existing compact production feel, but add a `Быстрый выбор` row with common metric names:

- `Просмотры`
- `Охват`
- `Клики`
- `Регистрации`
- `Заявки`
- `Переходы`
- `Реакции`
- `Комментарии`
- `Репосты`

Select controls should store the existing backend enum values, but display readable labels:

- `24h` -> `Через 24 часа`
- `tgstat` -> `TGStat`
- `vk_api` -> `VK API`
- `medium` -> `Среднее`

Metric history should read like production evidence, not a database row. For example:

`Через 24 часа · TGStat · Доверие: среднее`

Effectiveness rows should also show labeled window, source, and confidence badges for the latest metric.

## Data Flow

No API contract changes are needed.

The dialog continues to submit the same payload:

- `window`
- `metric_name`
- `metric_value`
- `metric_value_text`
- `source`
- `source_method`
- `confidence`
- `note`

Labels and presets live in `frontend/src/lib/contentFactoryUtils.ts` so all Content Factory surfaces can reuse them.

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
