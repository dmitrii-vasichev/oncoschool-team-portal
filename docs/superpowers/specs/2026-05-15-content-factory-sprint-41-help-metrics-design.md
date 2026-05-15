# Content Factory Sprint 41 Help For Metrics, Effectiveness, Retrospectives, And References Design

## Goal

Add detailed practical help for the final explanation wave before planning automation: metric capture, effectiveness analytics, retrospectives, and reference data.

Sprint 39 explained publication planning. Sprint 40 explained campaigns, review queue, and audiences. Sprint 41 explains how the team turns publication facts into evidence, evidence into decisions, and shared taxonomy into consistent planning.

## User Problem

Users can already add or import metric snapshots, inspect metric insights, open effectiveness analytics, create retrospectives, and manage reference data. Without detailed help, these screens can look like reporting bureaucracy instead of a learning loop.

The help should clarify:

- metrics are evidence with source, confidence, window, and provenance;
- metric windows exist so results are compared at similar moments after publication;
- effectiveness analytics is for decision quality, not only a scoreboard;
- retrospectives convert results, failures, learnings, and actions into future planning;
- reference data should be edited carefully because it shapes filters, labels, analytics, and imports.

## Scope

This sprint expands `/content-factory/help` with guidance for:

- Metric capture, paste import, source, confidence, and measurement windows.
- Effectiveness analytics and evidence health.
- Retrospectives as reusable campaign learning.
- Reference data ownership, editing, deactivation, and taxonomy consistency.
- A practical flow from publication evidence to next planning decisions.
- Common confusion notes for metrics, effectiveness, retrospectives, and references.

Out of scope:

- Backend/API changes.
- New routes.
- Automated metric collection.
- Publishing integrations.
- Reference admin permission changes.
- Visual redesign of the help route beyond adding one consistent section.

## UX Direction

Keep the content inside the existing `/content-factory/help` route. The help wave should remain one stable entry point until every section is covered.

Recommended section:

1. Heading: `Метрики, эффективность, ретроспективы и справочники`.
2. Four practical cards:
   - Metrics: source, confidence, windows, manual entry, paste import, evidence quality.
   - Effectiveness: objective, health, metric coverage, stale/missing evidence, channel/audience learning.
   - Retrospectives: what worked, what broke, learnings, decisions, next actions.
   - References: shared names, taxonomy ownership, careful edits, deactivation over destructive changes.
3. A compact evidence-to-learning flow:
   - record publish evidence;
   - add metrics by window;
   - preserve source and confidence;
   - inspect effectiveness;
   - write retrospective learning;
   - update reference data only when taxonomy really changes.
4. Common confusion notes:
   - a number without source/confidence is weak evidence;
   - a high metric is not automatically success if the objective was different;
   - retrospectives are planning memory, not an after-the-fact report;
   - references should not be changed for one-off convenience.

## Testing

Use the existing Content Factory source guard suite. Add one new source-guard test for the Sprint 41 section and key phrases.

Focused verification:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Full frontend verification:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```
