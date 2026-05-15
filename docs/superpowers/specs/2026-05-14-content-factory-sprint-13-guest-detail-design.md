# Content Factory Sprint 13 Guest Detail Design

## Context

Sprint 11 added the guest story backend foundation and Sprint 12 added the first `Гости и истории` list/create/edit workspace. The list is good for triage, but a real guest story needs a focused object page where the team can read the full context without opening a large edit dialog.

The backend already exposes `GET /api/content-factory/guests/{id}`. Sprint 13 should use that contract and stay frontend-focused.

## Goal

Add `/content-factory/guests/[id]` as a dedicated guest or patient story detail page.

The page should let Content Factory users:

- Open a guest story from the list.
- Read the full pipeline, consent, boundary, source, and follow-up context.
- See linked campaign, publication, and nosology records when present.
- Refresh the page data.
- Edit the story through the existing guest story dialog.
- Return to the guest list.

## Non-Goals

- Do not add backend fields, migrations, or endpoints.
- Do not add stage history, comments, uploads, reminders, or intake imports.
- Do not add hard delete.
- Do not change the Sprint 12 create/edit contract.
- Do not build a generic activity timeline until the backend stores real events.

## User Experience

The list should make the story title or a clear action open the detail page.

The detail page should follow existing Content Factory detail patterns:

- Back link to `Гости и истории`.
- Compact title block with status, role, consent, source, owner, next-step date, refresh, and edit.
- Summary cards for:
  - current stage;
  - next action deadline;
  - consent state;
  - publication boundary;
  - gift/follow-up state.
- Main content column:
  - story brief;
  - source notes;
  - screening notes;
  - medical factcheck notes;
  - rejection or pause reason when present.
- Side content column:
  - contact reference;
  - allowed channels;
  - sensitive topics;
  - legal notes;
  - linked campaign, publication, and nosology.

Empty fields should render friendly Russian fallback text, not raw `null`, empty arrays, or technical names.

## Frontend Data Flow

Add API client method:

- `api.getCFGuestStory(id)`

The detail route should load:

- `api.getCFGuestStory(id)`;
- `api.getTeam()` for owner names and edit dialog options;
- `api.getCFBundles({ limit: 500 })` for linked campaign and edit options;
- `api.getCFPublications({ limit: 500 })` for linked publication and edit options;
- `api.getCFNosologies({ only_active: false })` for linked nosology and edit options.

Reference-data failures should not blank the story. Only the primary guest story request should determine whether the page can render.

## Components

Create a focused display component:

- `ContentFactoryGuestStoryDetailPanels`

Responsibilities:

- render read-only story sections;
- resolve names from passed reference arrays;
- link to campaign and publication pages;
- show operational warnings for overdue next steps and due follow-up;
- stay independent from data fetching.

The route component remains responsible for fetching, loading/error states, page title, refresh, and edit dialog state.

## Error Handling

- Primary story load failure should show a toast and a friendly not-found state with a link back to `Гости и истории`.
- Reference load failures should fall back to readable labels.
- Edit save should refresh the detail page after the existing dialog completes.
- Invalid dates should render `Без даты`.

## Testing

Use source-guard TDD before implementation:

- API source guard for `getCFGuestStory`.
- Route source guard for `/content-factory/guests/[id]/page.tsx`.
- Detail component source guard for readable Russian sections and linked campaign/publication routes.
- Table source guard that a story row links to `/content-factory/guests/${story.id}`.
- Existing helper tests should continue to cover guest labels, due-state helpers, summaries, and filters.

Validation commands:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

## Future Work

After the detail page is validated with real records, later guest-story sprints can add stage history, comment threads, consent-document links, reminder automation, intake-form imports, and gift delivery tracking.
