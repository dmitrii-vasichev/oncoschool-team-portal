# Content Factory Sprint 49 Production Readiness Design

## Context

Content Factory now has the core operating model in place: planning, campaigns, publications, channel adaptations, publishing queue, Telegram/VK publishing, metric capture, VK metric collection, audiences, effectiveness analytics, guest stories, retrospectives, references, and a help section.

Sprint 49 is the stabilization and onboarding pass before treating the module as ready for day-to-day non-developer use. It should not introduce another large domain subsystem. The goal is to make the existing product understandable, checkable, and safe to hand to real users.

## Goal

Prepare Content Factory for practical rollout by creating a complete production-readiness checklist, improving onboarding/help around the implemented workflow, and fixing first-use blockers found in the existing UI and documentation.

## Non-Goals

- Do not add new social platforms or metric providers.
- Do not redesign the whole Content Factory navigation.
- Do not replace the current help page with a separate documentation app.
- Do not require live Telegram or VK credentials for automated tests.
- Do not solve every manual QA item from the historical backlog in this sprint.
- Do not add broad refactors unrelated to onboarding, clarity, readiness, or release safety.

## Recommended Approach

Use a QA-first readiness pass:

1. Map the full Content Factory workflow as it exists now.
2. Define launch-readiness checks that a product owner or operator can follow.
3. Improve the user-facing help and onboarding path so a first-time user understands why the module exists and what to do first.
4. Fix focused blockers in UI text, empty states, action visibility, and layout only where they affect first-use readiness.
5. Record remaining release risks and post-release backlog explicitly instead of leaving them implicit.

This approach is preferred over help-first or bugfix-only work because it keeps the sprint anchored to actual usability of the built product.

## Readiness Document

Create a tracked production-readiness document at:

`docs/content-factory-production-readiness.md`

The document should include:

- Purpose and rollout status.
- Current implemented capability map by section.
- End-to-end workflow checklist from campaign planning to publication, publishing, metrics, and retrospective.
- First-user onboarding path.
- Manual QA checklist grouped by module.
- External credential and access checklist for Telegram, VK publishing, VK metrics, GetCourse-style segments, and team access.
- Known limits and deferred work.
- Release decision checklist with clear pass/fail criteria.

This document is for operators and future developers. It should be written in English, like the rest of project documentation.

## Help And Onboarding Updates

Update `/content-factory/help` so it answers four practical questions immediately:

1. What is Content Factory for?
2. What should a first-time user do first?
3. Which parts are automated now, and which parts still need manual confirmation?
4. How do publication, publishing, metrics, and retrospective evidence connect?

The help page should keep the existing detailed section explanations, but add a launch-ready first-use guide near the top. It should reference the implemented state after Sprint 48, including:

- Campaign planning and the planning matrix.
- Publication records and channel adaptations.
- Publishing queue, Telegram publishing, and VK publishing.
- Manual metric capture, table import, metric source configs, and VK metric collection.
- Retrospectives as the place where evidence becomes decisions.
- Known limitation: Telegram post analytics are not collected automatically by the bot-based integration.

## UI Readiness Pass

Inspect the current Content Factory screens and fix only issues that block or confuse first use:

- Empty states that do not explain the next action.
- Buttons or actions whose labels are unclear to non-developers.
- Copy that still sounds like internal implementation language.
- Missing links to relevant help from complex sections.
- Text overflow, cramped controls, or obvious mobile/desktop layout problems.
- Pages that do not explain why there is no data yet.

The readiness pass should be focused. Cosmetic redesigns and broad component rewrites are out of scope unless a layout bug blocks use.

## Source-Level Guards

Add or extend source-level tests to lock the readiness work:

- Help page exposes a first-use path, automation boundaries, and release-readiness language.
- Production readiness document exists and mentions the key workflow stages.
- Content Factory navigation still reaches all production sections.
- Critical pages expose readable empty-state or next-action copy.

Prefer existing source guard patterns in `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts` and document/source checks rather than brittle browser automation for this sprint.

## Manual QA Plan

Sprint 49 should not require real credentials for automated tests, but the manual checklist must be ready for real use.

Manual QA should cover:

- Access and navigation.
- Campaign creation and planning matrix.
- Publication creation, edit, readiness, variants, and review queue.
- Publishing queue, send-now, Telegram/VK configured and missing-config paths.
- Manual publish evidence.
- Metric entry, metric paste import, VK metric source run, dedupe, and metric history provenance.
- Audience segments and audience analytics.
- Effectiveness analytics.
- Guest story workspace.
- Retrospectives.
- Reference administration.
- Help/onboarding readability.

## Documentation Updates

Update:

- `docs/PLAN.md`
- `docs/STATUS.md`
- `docs/TEST_PLAN.md`
- `docs/BACKLOG.md`
- `docs/content-factory-roadmap.md`

After implementation, Sprint 49 should become the active top section in the durable docs. The backlog should separate:

- launch blockers,
- manual QA still requiring credentials or real data,
- post-release enhancements.

## Success Criteria

Sprint 49 is complete when:

- `docs/content-factory-production-readiness.md` exists and can be used as the rollout checklist.
- `/content-factory/help` explains first use, implemented automation, and evidence flow clearly.
- Critical Content Factory screens have readable next-action or empty-state copy.
- Source guards cover the readiness document and first-use help path.
- Existing frontend checks pass.
- Focused backend checks relevant to Content Factory still pass where local infrastructure allows.
- Remaining risks are explicit in docs/backlog instead of hidden in conversation history.

## Validation

Expected automated validation:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_metric_collector_service.py tests/test_cf_metric_import_scheduler_service.py tests/test_content_factory_metric_sources_api.py tests/test_content_factory_metrics_api.py -q
git diff --check
```

Full backend DB-dependent validation should be attempted if local Postgres on `localhost:5434` is available. If it is not available, record the infrastructure limitation explicitly, as in Sprint 48.
