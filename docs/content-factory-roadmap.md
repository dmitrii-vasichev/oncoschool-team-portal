# Content Factory Completion Roadmap

_Created on 2026-05-15 to preserve the agreed direction after Sprint 36._

## Purpose

This roadmap is the durable source of truth for the next Content Factory work. It keeps the product thread together so future sprints do not become a disconnected list of screens.

The target is not a generic social-media scheduler. Content Factory should become an internal content operations layer for Oncoschool: campaign planning, publication production, channel adaptation, scheduling, publishing evidence, metric capture, effectiveness learning, and a clear help system that explains why the workflow exists.

## Planning Inputs

- Recovered design: `docs/content-factory-design.md`.
- Preserved market and best-practice research: `docs/content-factory-market-context-report.md`.
- Current implementation from Sprint 1 through Sprint 36.
- The original manual Excel planning workflow, represented by the lost and later referenced `Контент.xlsx` source.
- User feedback from the running product: users need friendly Russian naming, consolidated navigation, detailed help, and a path from manual planning to automation.

## Current Capability After Sprint 36

The system already supports the manual operating loop:

- Create and browse campaigns, publications, review queue items, calendar items, audiences, metrics, effectiveness views, retrospectives, and reference data.
- Create publications and set platform, format, rubric, nosology, status, planned date, responsible user, UTM fields, body text, and published evidence.
- Track publication workflow status and history.
- Build publication readiness from source text, scheduling, review status, publish evidence, metrics, and channel adaptations.
- Generate, edit, save, check, and copy channel adaptations for Telegram, VK, email, push, Max, and Dzen.
- Record published URLs and published timestamps manually.
- Add or paste-import metric snapshots manually.
- Review metric summaries, effectiveness analytics, audience analytics, and retrospectives.

This is a strong manual and semi-automated foundation. It is not yet the final automated publishing and analytics system.

## Explicitly Not Done Yet

These items remain planned work rather than existing functionality:

- Bulk import of the publication plan from the manual Excel workflow.
- A cross-channel planning matrix that turns one campaign idea into a visible set of channel publications.
- Scheduled automatic publishing to external platforms.
- Automatic capture of post URLs and external post identifiers.
- Automatic metric collection from Telegram, VK, GetCourse, email tools, or other social platforms.
- Integration credentials, publishing queues, retry logs, platform error handling, and audit trails.
- A detailed user-facing help system for every Content Factory section.

## Target End State

Content Factory should be considered functionally complete for the first production release when a team member can:

1. Understand the module through detailed help and section-level explanations.
2. Import or enter a publication plan without rebuilding the old Excel workflow by hand.
3. Group work by campaign and see every channel item that belongs to the campaign.
4. Prepare a publication with source text, metadata, UTM, audience targets, review status, and channel adaptations.
5. Schedule publications and see operational risks before the date arrives.
6. Publish manually with a reliable handoff package, or through the first supported platform integrations where the API is stable enough.
7. Save actual publication links and platform identifiers.
8. Capture metrics manually, by paste import, or through supported integrations.
9. Compare performance, record learnings, and turn retrospective decisions into future planning inputs.

## Operating Principles

- Build the manual workflow first, then automate the parts that are stable and valuable.
- Keep manual fallback paths even after integrations exist.
- Do not pretend every channel can support the same automation level.
- Treat Telegram, VK, Dzen, Max, email, and GetCourse as different operational surfaces with different constraints.
- Store publication evidence and metric provenance, including source and confidence.
- Make help and explanation a product deliverable, not an afterthought.
- Use Russian UI labels and section names that explain the user task, not internal database vocabulary.
- Before each large block, create a sprint-level design and implementation plan in `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- Keep `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md` current during rollout.

## Roadmap Waves

### Wave A: Explain The System

Goal: reduce intimidation and make the existing Content Factory understandable before adding more complexity.

#### Sprint 37: Master Roadmap And Help Architecture

- Preserve the completion roadmap.
- Define the help system structure.
- Decide how global help, section help, and contextual page help should work together.
- Update durable repo docs so the next development work has a clear source of truth.

#### Sprint 38: Help Overview And Operating Model

- Add a rich overview help page for Content Factory as a whole.
- Explain what Content Factory is, which manual workflows it replaces, and why the module is designed around campaigns, publications, channels, readiness, metrics, and retrospectives.
- Explain which parts are manual today and which parts are planned for automation.

#### Sprint 39: Help For Calendar, Publications, Adaptations, And Readiness

- Add detailed help for the calendar and publication detail workflow.
- Explain statuses, scheduling, body text, UTM, channel adaptations, saved variants, handoff copy, readiness checklist, and publish evidence.
- Make it clear how a user can plan a post today even before automatic publishing exists.

#### Sprint 40: Help For Campaigns, Review Queue, And Audiences

- Add detailed help for campaign workspace, review queue triage, audience segments, and audience analytics.
- Explain how campaign/bundle thinking replaces scattered one-off posts.
- Explain medical review, responsible users, segment targeting, and why audience fields matter.

#### Sprint 41: Help For Metrics, Effectiveness, Retrospectives, And References

- Add detailed help for metric capture, metric import, insights, effectiveness analytics, retrospectives, and reference data.
- Explain source, confidence, metric windows, performance learning, and why retrospectives feed future planning.
- Explain when reference data should be edited and who should own it.

### Wave B: Scale Planning From Excel

Goal: help the team move the existing manual plan into Content Factory without painful duplicate entry.

#### Sprint 42: Publication Plan Import

- Build an import flow for publication plans from spreadsheet-like data.
- Start with paste/import preview if that is safer than direct XLSX upload.
- Map common manual columns to campaign, publication, platform, format, scheduled date, responsible user, status, rubric, nosology, body draft, and notes.
- Show validation errors before saving.

#### Sprint 43: Cross-Channel Planning Matrix

- Add a campaign-level planning matrix that shows required or expected channel items.
- Let users see missing channel publications for a campaign.
- Provide creation shortcuts from a campaign idea into channel-specific publication records.
- Keep independent publication records as the source of truth while making the campaign-level picture obvious.

### Wave C: Controlled Publishing Automation

Goal: move from manual handoff to safe publishing automation only where it reduces real work and the external platform API is stable enough.

#### Sprint 44: Publishing Queue Foundation

- Add backend publishing job records, queue states, retry metadata, and audit history.
- Keep jobs platform-neutral.
- Support dry-run/manual confirmation states before any external posting integration is trusted.
- Keep manual publish evidence compatible with queued jobs.

#### Sprint 45: First Platform Publishing Integration

- Integrate the first practical platform, likely Telegram if credentials and API permissions are available.
- Support scheduled job execution, success/failure status, returned post URL or post id, and clear operator error messages.
- Keep manual override and retry controls.

#### Sprint 46: Second Platform Publishing Integration

- Add the next highest-value practical channel, likely VK if the API and account model fit the team's workflow.
- Reuse the queue foundation rather than adding channel-specific one-off logic.
- Document any channel limitations directly in the UI help.

### Wave D: Metrics Automation

Goal: reduce manual metric entry while preserving evidence quality.

#### Sprint 47: Metrics Integration Foundation

- Add metric source configuration, import runs, source freshness, confidence labels, and deduplication rules.
- Keep manual and paste-imported metric snapshots valid.
- Make integration errors visible without blocking editorial work.

#### Sprint 48: First Automated Metric Sources

- Integrate the first feasible metric sources, based on API reality and account access.
- Candidate sources: Telegram statistics provider, VK metrics, GetCourse registrations/conversions, email provider reports.
- Store raw payloads when useful for audit and later recalculation.

### Wave E: Stabilization And Onboarding

Goal: prepare Content Factory for everyday use by non-developers.

#### Sprint 49: Production Readiness Pass

- Run authenticated manual QA across the entire Content Factory workflow.
- Fix naming, empty states, form hints, mobile readability, and slow screens.
- Ensure the help system links from every section and matches the implemented behavior.
- Update final release notes and open remaining post-release backlog.

## How Each Future Sprint Should Start

Each block should be expanded only when it becomes the next active work:

1. Re-read this roadmap, `docs/content-factory-design.md`, and the relevant parts of the market research.
2. Write a focused design/spec document for the sprint.
3. Write an implementation plan with validation commands and manual QA.
4. Update `docs/PLAN.md` and `docs/STATUS.md`.
5. Implement, validate, fix, update docs, commit, merge, and push.

This preserves the big direction while still letting each block be designed carefully when we have the newest product context.

