# Content Factory Sprint 9.5 UX Consolidation Design

## Context

Content Factory now has a working MVP across dashboard, calendar, campaigns, publications, audiences, review queues, retrospectives, dictionaries, and audience analytics. The module grew one page at a time, so global navigation now exposes too many separate `CF ...` items and some forms still show implementation terms such as `Bundle`, `Segment`, `best_by_objective`, and raw JSON placeholders.

Before Sprint 10 outcome analytics, the Content Factory interface should be consolidated into a friendly product workspace.

## Goal

Make Content Factory understandable for non-technical users:

- Keep only one global sidebar entry for the module.
- Add internal Content Factory navigation inside `/content-factory/*`.
- Replace system-oriented English labels with clear Russian product language.
- Add a help surface explaining what the module does and how each section works.
- Remove raw JSON/snake_case labels from the retrospective user flow.

## Navigation Design

The global sidebar should show a single module entry:

- `Контент-фабрика`

Inside the Content Factory layout, add compact internal navigation:

- `Обзор`
- `Календарь`
- `Кампании`
- `Очередь проверки`
- `Аудитории`
- `Аналитика аудиторий`
- `Ретроспективы`
- `Справочники`
- `Справка`

This keeps the main portal sidebar clean while preserving fast movement inside the module.

## Naming Rules

Use these UI names consistently:

- Content Factory -> `Контент-фабрика`
- Bundle -> `Кампания`
- Publication -> `Публикация`
- Segment -> `Аудитория`
- Segment analytics -> `Аналитика аудиторий`
- Review -> `Очередь проверки`
- Retros -> `Ретроспективы`
- References -> `Справочники`
- Metrics -> `Метрики`
- Metric evidence -> `Замеры метрик`
- Source ID -> `Внешний ID`
- Population -> `Размер аудитории`
- Owner -> `Ответственный`
- Published -> `Опубликовано`

Avoid user-facing `CF`, snake_case, raw enum names, and implementation labels.

## Retrospective Design

The retrospective dialog should use natural fields:

- `Что сработало`
- `Что сломалось`
- `Выводы`
- `Решения`
- `Следующие действия`
- `Дополнительные заметки`

Users should type normal text, one idea per line. The frontend can still store the existing JSON-compatible backend shape by converting lines into arrays or `notes` objects. Existing JSON data should be rendered back as readable lines.

## Help Design

Add `/content-factory/help` as a dedicated help page. It should explain:

- What Content Factory is.
- How the workflow moves from campaign to publications, review, publishing, metrics, and retrospectives.
- What each section is for.
- Which data is manual today and which integrations are intentionally deferred.

Add a small `Справка` affordance in the internal Content Factory navigation so users can find it from every section.

## Non-Goals

- Do not change backend schemas.
- Do not add Sprint 10 outcome analytics yet.
- Do not rebuild every page layout from scratch.
- Do not translate internal TypeScript function names or API fields unless they appear in the UI.

## Testing

Use source guard tests and existing frontend verification:

- Assert the global sidebar exposes only one Content Factory entry.
- Assert the Content Factory layout renders internal navigation.
- Assert header metadata uses Russian route names.
- Assert the help route exists and covers the core module sections.
- Assert the retrospective dialog no longer exposes raw `best_by_objective`, `broken`, `learnings`, `decisions`, `actions`, or JSON placeholder labels to users.

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts src/lib/contentFactoryUtils.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```
