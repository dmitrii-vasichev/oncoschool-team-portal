# Content Factory Sprint 40 Help For Campaigns, Review Queue, And Audiences Design

## Goal

Add detailed practical help for the Content Factory sections that connect individual publications into a managed content operation: campaigns, review queue, audiences, and audience analytics.

Sprint 39 explained one publication from calendar to readiness. Sprint 40 explains the surrounding operating layer: why campaign workspaces exist, how review queue triage should be used, and why audience targeting belongs in planning rather than only in reports.

## User Problem

Users can already create campaigns, link publications to campaigns, open the review queue, manage audience segments, and inspect audience analytics. Without detailed help, they may still see these sections as extra admin pages instead of the coordination layer that prevents scattered work.

The help should clarify:

- a campaign is a working context, not only a folder;
- the review queue is an operational triage view, not a blame list;
- audiences represent external segment mirrors, currently GetCourse-oriented;
- audience roles matter before publishing;
- audience analytics shows whether segments are actually used and whether evidence exists.

## Scope

This sprint expands `/content-factory/help` with guidance for:

- Campaign workspace and campaign thinking.
- Review queue triage and medical/content review.
- Audience registry and segment roles.
- Audience analytics and segment usage evidence.
- A practical flow for planning a campaign with audiences and review.
- Common confusion notes for campaigns, review, and audiences.

Out of scope:

- Backend/API changes.
- New routes.
- New inline contextual help components.
- Detailed help for metrics, effectiveness, retrospectives, and references. Those remain for Sprint 41.
- Publishing or metrics integrations.

## UX Direction

Keep the content inside the existing help page so users have one stable help entry point during the help-wave rollout.

Recommended section:

1. Heading: `Кампании, проверка и аудитории`.
2. Four practical cards:
   - Campaigns: campaign links meaning, deadlines, owner, materials, and publications.
   - Review queue: triage for text, design, factcheck, doctor review, approval, scheduling.
   - Audiences: GetCourse/external segment mirrors, population snapshots, owner, role assignment.
   - Audience analytics: usage, unused active audiences, linked publications, metric evidence.
3. A compact campaign planning flow:
   - create campaign;
   - add brief/materials/event date;
   - create linked publications;
   - assign responsible users and review status;
   - attach audience roles;
   - use review queue and audience analytics.
4. Common confusion notes:
   - campaign is not just a folder;
   - review queue is not a blame list;
   - audience roles differ;
   - analytics depends on publication and metric evidence.

## Testing

Use the existing Content Factory source guard suite. Add one new source-guard test for the Sprint 40 section and key phrases.

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
