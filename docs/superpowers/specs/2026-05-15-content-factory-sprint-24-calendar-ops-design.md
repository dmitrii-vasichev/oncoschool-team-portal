# Content Factory Sprint 24 Calendar Operations Design

## Goal

Turn the Content Factory calendar into an operational planning surface. Users should not only see when publications are planned, but also understand which posts are ready, overdue, missing essentials, or need post-publication cleanup.

## Context

Sprint 19 added a first-class publications index. Sprint 20 added publication creation. Sprint 22 added a readiness checklist on publication detail, and Sprint 23 added a manual publishing package. The calendar still works mainly as a grouped list by date. Sprint 24 keeps the scope frontend-only and adds planning intelligence from existing publication fields.

## User Experience

The `/content-factory/calendar` page gains:

- a compact summary strip for the filtered calendar view;
- row-level operational badges such as `Просрочен план`, `Сегодня`, `Готово к выходу`, `Нужен текст`, `Нужны UTM`, `Заполнить факт`, and `Опубликовано`;
- a short next-action sentence on each publication row;
- a direct `Открыть` action to the publication detail page.

The visual tone stays utilitarian and dense: this is an operations screen for repeated scanning, not a marketing page.

## Architecture

The feature is frontend-only.

- Add `getContentFactoryCalendarPublicationState(publication, now)` to `frontend/src/lib/contentFactoryUtils.ts`.
- Add `summarizeContentFactoryCalendar(publications, now)` for the summary strip.
- Add focused helper tests to `frontend/src/lib/contentFactoryUtils.test.ts`.
- Update `frontend/src/app/content-factory/calendar/page.tsx` to render summary cards, row-level state badges, next actions, and publication detail links.
- Add source guards to `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`.

## State Rules

- Published posts with missing actual publication date or post reference show `Заполнить факт`.
- Published posts with fact and post reference show `Опубликовано`.
- Cancelled or failed posts show `Не выходит`.
- Missing schedule shows `Без даты`.
- Active unpublished posts with a past scheduled time show `Просрочен план`.
- Posts scheduled for the current UTC date show `Сегодня`.
- Scheduled or approved posts with body text and UTM show `Готово к выходу`.
- Missing body text wins over missing UTM.
- Missing UTM wins over generic preparation.
- Everything else remains `В подготовке`.

## Out Of Scope

- No drag-and-drop rescheduling.
- No backend schema or endpoint changes.
- No automatic publishing.
- No platform API integrations.
- No automatic metric collection.
- No full readiness calculation that requires per-publication segment target and metric fan-out.

## Validation

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Manual QA should open `/content-factory/calendar`, apply filters, confirm the summary changes with the filtered view, confirm each row shows a readable operational badge and next action, and confirm `Открыть` navigates to the publication detail page.
