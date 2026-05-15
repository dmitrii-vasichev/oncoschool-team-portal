# Content Factory Sprint 27 Publication Workflow History Design

## Context

Sprint 26 added quick workflow actions on the publication detail page. Users can now move a publication from text to factcheck, doctor review, approval, scheduling, cancellation, and similar states without opening the full edit dialog.

The missing operational piece is traceability. The backend already has `cf_publication_version`, and the frontend already renders `ContentFactoryPublicationVersionList`, but the service currently creates a new history row only when `body_text` changes. Pure status moves do not leave a visible trail.

## Goal

Record workflow status changes in the existing publication history so users can see how a publication moved through review and scheduling.

## Scope

In scope:

- Backend service records a `CFPublicationVersion` row when `status` changes, even if the body text does not change.
- Backend records only one version row when body text and status change in the same update.
- Backend maps target publication status to the existing `approval_event` vocabulary.
- Backend stores a readable note for status moves, such as `Статус: Нужен текст -> Фактчек`.
- The publication versions endpoint continues to return the same response schema.
- Frontend copy changes from `История версий` to `История публикации`.
- Frontend adds short explanatory copy and keeps showing version notes.
- Backend and frontend tests/source guards cover the behavior.
- Durable documentation updates.

Out of scope:

- New database tables or migrations.
- A dedicated approval-events API.
- Status-change comments from the user.
- Reverting to previous versions.
- Notifications, mentions, or assignments.
- Full diff visualization between versions.

## Backend Design

`PublicationService.update` already computes `changes`, applies fields, and creates a version row when the body changes. Sprint 27 extends it:

- Capture `old_status` before applying changes.
- Compute `status_changed = "status" in changes and changes["status"] != old_status`.
- Create one `CFPublicationVersion` row when `body_changed or status_changed`.
- Increment `pub.version_number` once for that combined update.
- Set `body_text` on the version to the current publication body.
- Set `approval_event` from the explicit `approval_event` argument when provided, otherwise from the target status:
  - `draft` -> `drafted`
  - `needs_copy`, `needs_design`, `factcheck`, `doctor_review` -> `reviewed`
  - `approved` -> `doctor_approved`
  - `scheduled` -> `scheduled`
  - `published` -> `published`
  - `failed`, `cancelled` -> `rolled_back`
- Set `notes` to a status transition sentence only when the status changed.

The existing metadata-only behavior remains unchanged: changing platform, format, rubric, responsible person, UTM, schedule, post URL, or post ID without body/status changes does not create a history row.

## Frontend Design

The existing version list stays in the main publication detail column. Sprint 27 makes it less text-version-only:

- Title becomes `История публикации`.
- Header copy explains: `Версии текста и переходы по workflow.`
- Empty state becomes `Истории публикации пока нет`.
- Existing event badges remain.
- Existing `notes` rendering remains visible, which now shows status transition notes.

No new network calls are added.

## Testing

Backend:

- Unit test: status-only update creates a new version row with incremented `version_number`, target-derived `approval_event`, and status note.
- Unit test: body+status update creates exactly one version row and preserves explicit `approval_event` when supplied.
- Existing metadata-only update test continues to assert that no version row is created.
- API test: publication PATCH no longer passes a hard-coded `approval_event="reviewed"` so service can derive workflow events.

Frontend:

- Source guard verifies the version list title is `История публикации`.
- Source guard verifies explanatory copy mentions workflow.
- Source guard verifies version notes still render.

## Manual Checks

1. Open a publication detail page.
2. Use `Быстрые действия` to move the publication to another status.
3. Confirm the page refreshes.
4. Confirm `История публикации` shows a new row with the status note.
5. Edit only metadata and confirm no extra history row appears.
6. Edit body text and status in one save and confirm only one history row appears.

