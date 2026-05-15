# Content Factory Sprint 19 Publications Index Design

## Context

Sprint 18 added publication operations to the publication detail page, but there is still no obvious top-level place called `Публикации`. Users can reach publications from campaigns, calendar, review, and analytics, yet the mental model needs a direct list of all posts.

## Goal

Add a dedicated `Публикации` section to the Content Factory workspace.

Users should be able to:

- Open one obvious page for all publications.
- Search publications by title, text, campaign, platform, format, responsible person, or status.
- Filter by status, platform, format, responsible person, and campaign.
- See planned and actual publication facts without opening each record.
- Jump from a row to the publication detail page.

## Scope

In scope:

- Add `/content-factory/publications`.
- Add `Публикации` to the horizontal Content Factory navigation.
- Update header metadata and breadcrumbs so detail pages live under `Публикации`.
- Add frontend helpers for publication index filtering, sorting, and summary counts.
- Reuse the existing `/api/content-factory/publications` list endpoint.
- Reuse existing reference endpoints for display names.
- Add source guards and helper tests.

Out of scope:

- New backend endpoints.
- Bulk edit operations.
- Drag-and-drop calendar changes.
- Automatic publishing or metric collection.
- Creating publications outside a campaign.

## UI

The page should be quiet and operational:

- Title: `Публикации`
- Subtitle: `Все посты, письма и материалы Контент-фабрики в одном списке.`
- Summary tiles:
  - total publications;
  - in-production publications;
  - scheduled publications;
  - published publications;
  - published rows without post URL.
- Search input above the existing structured filters.
- Count row: `Показано X из Y`.
- List rows with:
  - title and status;
  - campaign;
  - platform and format;
  - responsible person;
  - planned date;
  - actual date;
  - post link state.

Rows should be links to `/content-factory/publications/[id]`.

## Data Flow

The route loads:

- `api.getCFPublications({ limit: 500 })`
- `api.getCFBundles({ limit: 500 })`
- `api.getCFPlatforms()`
- `api.getCFFormats()`
- `api.getTeam()`

Filtering and sorting stays client-side for this sprint. If the list becomes too large, a later backend aggregate/search endpoint can replace the client-side logic without changing the UI model.

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
