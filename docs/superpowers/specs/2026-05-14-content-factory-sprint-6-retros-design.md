# Content Factory Sprint 6 Retrospective Workspace Design

## Goal

Make Content Factory learning durable by adding a retrospective workspace where the team can create weekly, monthly, bundle, and ad-hoc retrospectives tied back to bundles, publications, and metric evidence.

## Context

Sprint 5 added the operational evidence layer: segment targets, UTM discipline, manual metric snapshots, and review queues. The next roadmap step in `docs/content-factory-design.md` is the retrospective workflow. Backend persistence and REST endpoints already exist for `cf_retro_note`, so Sprint 6 should be frontend-heavy and should not introduce publishing integrations or new database tables.

## Scope

- Add `/content-factory/retros` list view with type filtering, compact cards, bundle/facilitator context, and create action.
- Add `/content-factory/retros/[id]` detail view with period, type, linked bundle, facilitator, notes, and structured evidence sections.
- Add create/edit dialog for retro fields already supported by the backend.
- Add frontend API methods for single retro fetch, create, and update.
- Add helper functions for retro labels, period display, title display, and structured section counts.
- Add sidebar and header navigation for the retrospective workspace.

## Data Model

Use existing frontend types:

- `CFRetroNote`
- `CFRetroNoteCreateRequest`
- `CFRetroNoteUpdateRequest`
- `CFRetroType`

Structured fields stay JSON-backed:

- `best_by_objective`: object
- `learnings`: object
- `decisions`: object
- `broken`: array
- `actions`: array

The first UI should use JSON text areas for structured fields. This keeps the workflow faithful to the current backend contract and avoids inventing a rigid retrospective taxonomy before real usage.

## UX

The UI should stay operational and dense, matching the existing Content Factory screens:

- No hero or marketing-style page.
- Cards should show period, retro type, linked bundle, facilitator, and counts for evidence sections.
- Detail view should read like a working review note: structured summaries first, free-form notes second.
- Create dialog should collect period, type, optional bundle, facilitator, structured JSON, and notes.
- Edit dialog should update supported fields only: best-by-objective, broken, learnings, decisions, actions, and notes.

## Error Handling

- Invalid JSON in dialog fields should be caught client-side with a clear inline message.
- Missing retro detail should render a not-found empty state.
- API failures should use existing toast patterns.
- Optional bundle/member lookups should degrade to ID fragments through existing display-name helper behavior.

## Validation

- Add source guards for retro API methods and routes.
- Add pure helper tests for retro labels, period/title formatting, and section counts.
- Run frontend focused tests, full frontend tests, TypeScript, lint, build, and `git diff --check`.

## Out Of Scope

- New backend persistence or migrations.
- Rich structured editors for each retrospective field.
- Automatic metric aggregation.
- AI-generated retro summaries.
- Publishing or metric API integrations.
