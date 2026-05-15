# Content Factory Sprint 20 Publication Creation Design

## Context

Sprint 19 added a first-class `Публикации` section. The page makes publications discoverable, but creation still starts only inside a campaign detail page. That is now inconsistent: users can see all publications in one place, but cannot add a publication from that same place.

## Goal

Add a publication creation flow directly from `/content-factory/publications`.

Users should be able to:

- Click `Новая публикация` from the publications index.
- Choose the campaign that will own the publication.
- Fill the same production fields already used inside campaigns.
- Save the publication through the existing bundle publication endpoint.
- Land on the new publication detail page after creation.

## Scope

In scope:

- Add a create button to `/content-factory/publications`.
- Load active rubrics and nosologies on that page so the existing publication dialog can be reused.
- Extend `ContentFactoryPublicationDialog` with an optional campaign selector for create flows without a fixed `bundleId`.
- Redirect to `/content-factory/publications/[id]` after creation from the publications index.
- Add source guards and focused frontend verification.

Out of scope:

- Creating publications without a campaign.
- Bulk publication creation.
- Calendar drag-and-drop.
- Template-driven publication generation.
- Backend endpoint changes.
- Social publishing integrations.

## UI

The publications index header should include:

- Primary button: `Новая публикация`
- Secondary button: `К календарю`

When the dialog is opened from the publications index:

- Show a required `Кампания` select above the existing production fields.
- If no campaign is available, saving should show `Выберите кампанию`.
- The rest of the form should stay the same as the campaign detail create flow.

When the dialog is opened from a campaign detail page:

- Do not show the campaign selector because the campaign is already known.

## Data Flow

The publications page should load:

- `api.getCFPublications({ limit: 500 })`
- `api.getCFBundles({ limit: 500 })`
- `api.getCFPlatforms()`
- `api.getCFFormats()`
- `api.getCFRubrics()`
- `api.getCFNosologies()`
- `api.getTeam()`

On save:

1. The dialog resolves `targetBundleId` from fixed `bundleId` or selected campaign.
2. It calls `api.createCFPublicationForBundle(targetBundleId, payload)`.
3. The publications page refreshes data.
4. The user is redirected to the created publication detail page.

## Verification

Automated checks:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```
