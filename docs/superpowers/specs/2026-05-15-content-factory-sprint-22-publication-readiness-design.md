# Content Factory Sprint 22 Publication Readiness Design

## Context

The Content Factory now supports publication creation, publication detail pages, UTM generation, audience targeting, publication fact capture, and manual metric snapshots. These pieces are useful, but a user still has to scan several panels to understand whether a publication is ready to publish and what remains after it goes live.

The recovered research recommends a manual or semi-automated publishing ledger before fragile auto-publishing integrations. A readiness checklist is the next operational layer for that ledger.

## Goal

Add a readable publication readiness checklist to the publication operations panel.

Users should be able to see:

- Whether the publication has text.
- Whether it has a scheduled date.
- Whether UTM tags are present.
- Whether at least one audience target is attached.
- Whether the publication fact is complete after publishing.
- Whether at least one metric snapshot has been recorded after publishing.

## Scope

In scope:

- Add a pure frontend helper that derives checklist items from publication fields, segment targets, and metric snapshots.
- Render the checklist inside `ContentFactoryPublicationOperationsPanel`.
- Pass publication segment targets from the publication detail page into the operations panel.
- Add focused helper tests and source guards.

Out of scope:

- Backend schema or API changes.
- Blocking status transitions based on checklist state.
- Automatic publishing.
- Automatic metric collection.
- Editing UTM, audiences, or metrics directly inside the checklist.

## UI

The operations panel should keep its current `Публикация и статистика` identity and add a compact `Чек-лист готовности` block.

Checklist item labels:

- `Текст публикации`
- `Дата в плане`
- `UTM-метки`
- `Аудитория`
- `Факт выхода`
- `Первые метрики`

Each item should show one of three human statuses:

- `Готово`
- `Нужно заполнить`
- `После публикации`

This keeps the checklist useful before and after publication without creating hard validation gates.

## Data Flow

The publication detail page already loads:

- `publication`
- `segmentTargets`
- `metrics`

It should pass `segmentTargets` into `ContentFactoryPublicationOperationsPanel`.

The panel should call `getContentFactoryPublicationReadiness(publication, segmentTargets, metrics)` and render the returned items. The helper stays in `contentFactoryUtils.ts` so future calendar/list badges can reuse the same logic.

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
