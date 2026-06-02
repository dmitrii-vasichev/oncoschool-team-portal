# Content Factory Sprint 50 Launch QA Guide Design

## Goal

Sprint 50 turns the Sprint 49 production-readiness checklist into a practical in-product launch QA guide. The goal is to help a non-developer operator open Content Factory, understand what must be verified before rollout, run one real campaign-to-retrospective path, and record blockers without needing the development chat for context.

## Context

Sprint 49 created `docs/content-factory-production-readiness.md`, clarified first-use help, and added first-use empty states. The durable backlog now says the next action is launch decision QA with real or production-like authenticated data.

The next slice should not add another Content Factory menu item. The horizontal workspace navigation is already dense, and the user has explicitly pushed for clearer consolidation rather than more links. The existing `/content-factory/help` route is the correct place for the operator-facing guide.

## User Problem

The current help page explains the system and first-use path, but it does not yet turn launch QA into a concrete checklist that a user can follow while opening screens. A user can still wonder:

- Which sections should be checked before launch?
- What is a blocker versus a known limitation?
- What evidence proves publishing or metrics work?
- Where should blockers be recorded?
- Why are Telegram analytics and media publishing not automatic yet?

## Scope

### In Scope

- Add a new "Launch QA" section to `/content-factory/help`.
- Describe launch readiness as a sequence of verification groups:
  - Access and navigation
  - Campaign planning
  - Publication readiness
  - Review and approval
  - Publishing queue
  - Metric collection
  - Retrospective and blocker recording
- Add clear blocker criteria and known-limit wording.
- Link the guide back to the tracked readiness document.
- Add source guards so this launch QA guide cannot disappear silently.
- Update durable docs for Sprint 50.

### Out Of Scope

- No new database tables.
- No new REST API endpoints.
- No new navigation item.
- No provider changes for Telegram, VK, media publishing, or metrics.
- No attempt to run real authenticated QA inside this sprint, because credentials and real channel access are operator-controlled.

## UX Design

The help page should keep its existing narrative structure. The new section should sit near the "First launch" and "How to start without fear" blocks, because that is where a user is most likely to ask "what now?".

The section should use compact cards rather than a new full-page wizard:

- A short intro explaining that launch QA checks one real path, not every historical record.
- A card grid for launch QA groups, each with:
  - group title
  - what to open
  - what evidence to confirm
  - what counts as a blocker
- A blocker policy block:
  - launch blocker
  - manual workaround accepted
  - post-release backlog
- A final operator path with links to the key screens and readiness doc.

This keeps the page useful without making the navigation larger.

## Content Rules

The text should be explicit about current automation boundaries:

- Telegram and VK text publishing can be automated only when provider config exists.
- VK metrics can be collected automatically only for published VK posts with usable post identity and a configured source.
- Telegram post analytics are not collected automatically through the bot integration.
- Media publishing remains a manual fallback.
- Human retrospective decisions remain manual.

The guide should avoid developer phrasing such as "endpoint", "schema", "model", or raw enum names unless they are already part of operator-facing language.

## Technical Design

### Frontend

Modify `frontend/src/app/content-factory/help/page.tsx`:

- Add `LAUNCH_QA_GROUPS`.
- Add `LAUNCH_BLOCKER_POLICY`.
- Add `LAUNCH_QA_PATH`.
- Render a new section titled `Проверка перед запуском`.
- Reuse existing card styles, icons, and `Link`.
- Keep Russian text for UI.

### Tests

Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`:

- Add a source guard that asserts the help page contains the launch QA section.
- Guard key phrases:
  - `Проверка перед запуском`
  - `launch blocker`
  - `ручной обход`
  - `post-release backlog`
  - `VK-метрики`
  - `Telegram`
  - `docs/content-factory-production-readiness.md`
- Guard that no new `/content-factory/launch` route or navigation item is required.

### Documentation

Modify durable docs:

- `docs/PLAN.md`: Sprint 50 becomes the active top plan.
- `docs/STATUS.md`: Sprint 50 becomes the active status section.
- `docs/TEST_PLAN.md`: add Sprint 50 automated and manual QA plan.
- `docs/BACKLOG.md`: keep launch decision QA as the next operator action, but make the first implementation blocker-management step explicit.

## Validation

Automated validation should run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Focused backend verification is not required for this sprint because no backend files or contracts change.

## Acceptance Criteria

- `/content-factory/help` contains a detailed launch QA guide in Russian.
- The guide explains what to open, what evidence to confirm, and how to classify blockers.
- The guide links to `docs/content-factory-production-readiness.md`.
- The guide explicitly states the current Telegram, VK metrics, media publishing, and manual retrospective boundaries.
- Source guards fail before implementation and pass after implementation.
- Durable docs describe Sprint 50 and the remaining operator QA step.

## Risks

- The help page is already long. The new section must be scannable and structured, not a wall of text.
- The guide can overpromise if it sounds like automated launch approval. It must say that real authenticated QA is still operator-run.
- The guide must not hide known limitations. Clear limitation language is part of launch trust.
