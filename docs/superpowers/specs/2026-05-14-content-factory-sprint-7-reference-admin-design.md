# Content Factory Sprint 7 Reference Admin Design

## Goal

Make Content Factory reference data manageable inside the portal, so admins can maintain platforms, formats, rubrics, nosologies, and funnel templates without direct database edits.

## Context

Sprints 3 through 6 made the operational Content Factory workflow usable: dashboard, calendar, bundle/publication workspace, outcomes, review queues, and retrospectives. The backend reference-table CRUD endpoints already exist from Sprints 1 and 2, including admin-only write permissions and delete pre-checks. Sprint 7 should therefore be frontend-heavy and should avoid new migrations or backend behavior changes unless implementation uncovers a contract mismatch.

## Scope

- Add `/content-factory/references` as a compact operational admin page.
- Show five reference tables:
  - Platforms
  - Formats
  - Rubrics
  - Nosologies
  - Funnel templates
- Load active and inactive records with `only_active=false`.
- Allow all users with Content Factory access to view reference records.
- Allow only admins to create, edit, and delete reference records.
- Add frontend API client methods for create, update, delete, and list-with-inactive reads.
- Add reusable table and dialog components for the five reference-table shapes.
- Add sidebar and header navigation for the reference workspace.

## Permissions

The route should remain under the existing Content Factory access guard:

- Admin users can view and mutate reference records.
- Non-admin users with `has_content_factory_access=true` can view records read-only.
- Non-admin users without Content Factory access continue to be blocked by the existing guard.

The frontend should hide or disable mutation controls for non-admin users, but backend authorization remains the source of truth.

## Data Model

Use the existing backend contracts:

- Platform create/update:
  - `code` on create only
  - `display_name`
  - `is_active`
  - `capabilities`
  - `display_order`
- Format create/update:
  - `code` on create only
  - `display_name`
  - `default_objective`
  - `requires_medical_review`
  - `is_active`
  - `display_order`
- Rubric create/update:
  - `code` on create only
  - `display_name`
  - `is_active`
- Nosology create/update:
  - `code` on create only
  - `display_name`
  - `is_active`
- Funnel template create/update:
  - `code` on create only
  - `name`
  - `description`
  - `template_publications`
  - `is_active`

JSON fields should stay JSON-backed in the first UI:

- `capabilities`: object
- `template_publications`: array

## UX

The screen should match the existing Content Factory operational style:

- No hero, marketing copy, or decorative page shell.
- A dense header with table switcher, record count, active/inactive summary, and admin-only create action.
- Tabs or segmented navigation for the five reference tables.
- Compact row/table presentation that makes code, display label, active status, ordering, and table-specific metadata easy to scan.
- Create/edit dialog with field-level validation and clear JSON errors.
- Admin delete action with confirmation.
- Non-admin users should see the same data with a small read-only state instead of hidden navigation.

## Error Handling

- Invalid JSON should be caught client-side before the API request.
- API failures should use existing toast patterns.
- Backend 409 delete failures should surface as a clear "record is in use" style message.
- Empty tables should render a stable empty state and keep the create action available for admins.

## Out Of Scope

- New database tables, migrations, or backend endpoints.
- Bulk import/export.
- Drag-and-drop ordering.
- Dedicated deprecation date editing for rubrics/nosologies.
- Complex funnel-template visual builder.
- Publishing or metric integrations.
