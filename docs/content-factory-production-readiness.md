# Content Factory Production Readiness

## Purpose

This document is the rollout checklist for Content Factory. It explains what is implemented, what must be manually verified before launch, which external accesses are required, and which limits should be communicated to operators.

## Rollout Status

- Product state: release candidate after Sprint 49.
- Engineering state: core workflow implemented through campaign planning, publication workflow, publishing queue, Telegram/VK publishing, manual metrics, VK metric collection, audiences, effectiveness, guest stories, retrospectives, references, and help.
- Launch decision: not approved until the manual QA sections below are completed against authenticated production-like data.

## Capability Map

### Campaign planning

- Create campaigns with owner, product stream, event date, brief, source materials, and funnel template.
- Use the campaign detail page to see linked publications and the planning matrix.
- Create missing channel/format publications from the matrix.

### Publication readiness

- Create and edit publication records with platform, format, status, responsible user, planned date, body, UTM, rubric, nosology, and source materials.
- Use readiness checks to find missing text, dates, workflow status, adaptations, publish evidence, and metrics.
- Use channel adaptations to keep Telegram, VK, email, push, Max, and Dzen copy separate from the source text.

### Review workflow

- Use the review queue to see items waiting for copy, design, factcheck, doctor review, approval, or scheduling.
- Treat the queue as triage: it shows the next action, not a replacement for team communication.

### Publishing queue

- Queue approved or scheduled publications.
- Send now through available provider integrations.
- Retry failed jobs or mark manual fallback with an auditable reason.
- Telegram and VK publishing are implemented for text posts only.

### Metrics and effectiveness

- Record manual metrics by publication.
- Import metric rows from pasted table data.
- Configure metric sources and inspect import runs.
- Run VK metric collection for published VK posts.
- Use effectiveness analytics to connect objectives, platforms, audiences, UTM evidence, and metric health.

### Audience and guest workflows

- Maintain GetCourse-style external segment mirrors and population snapshots.
- Link publication targets, exclusions, controls, and retargeting segments.
- Track guest stories from sourcing through consent, publication, gift, and follow-up.

### Learning loop

- Use retrospectives to record what worked, what broke, learnings, decisions, and next actions.
- Keep reference dictionaries clean so future filters, imports, and analytics remain comparable.

## First-User Path

1. Confirm the user has Content Factory access.
2. Open `/content-factory/help` and read the first-use path.
3. Create one campaign with a clear owner, goal, and event or launch context.
4. Create one publication for that campaign.
5. Add body text, platform, format, planned date, responsible user, UTM, and audience context where available.
6. Save one channel adaptation.
7. Move the publication through review or scheduling.
8. Publish manually or through the queue, depending on channel readiness.
9. Save the publish fact: URL, actual date, and external post id.
10. Record or import metrics.
11. Write one retrospective note that turns the evidence into a next decision.

## External Access Checklist

- Team access: active admins have access automatically; active non-admins need `has_content_factory_access=true`.
- Telegram publishing: requires a configured Content Factory Telegram target and bot access.
- VK publishing: requires `VK_API_ACCESS_TOKEN`, `VK_OWNER_ID`, API version, and group/user posting permissions.
- VK metric collection: requires `VK_API_ACCESS_TOKEN`, an active `vk_api` metric source config, and published VK posts with a wall post id or URL.
- Telegram analytics: Telegram post analytics are not collected automatically by the bot-based integration. Core stats require separate MTProto/admin access and are out of scope for the current release candidate.
- GetCourse-style audiences: segment records can be mirrored and refreshed manually; confirm source segment ids and owners before relying on them.

## Manual QA

### Access and navigation

- Confirm admins can open Content Factory.
- Confirm a non-admin with Content Factory access can open Content Factory.
- Confirm a non-admin without access is blocked.
- Confirm navigation reaches overview, calendar, publications, campaigns, review queue, audiences, audience analytics, effectiveness, guests, retrospectives, references, and help.

### Campaigns and planning matrix

- Create a campaign.
- Attach a funnel template where available.
- Confirm the matrix shows expected, created, missing, and outside-template publications.
- Create a missing publication from the matrix.

### Publications and review

- Create a publication from the publications page.
- Create a publication from a campaign.
- Import table rows into publications.
- Edit body, date, status, responsible user, UTM, rubric, and nosology.
- Save channel adaptations.
- Confirm readiness checks explain missing and after-publish steps.
- Confirm review queue groups items by workflow status and shows the next action.

### Publishing

- Queue an approved or scheduled Telegram publication.
- Send now with valid Telegram config.
- Repeat with missing or ambiguous Telegram config and confirm a readable failure.
- Queue an approved or scheduled VK publication.
- Send now with valid VK config.
- Repeat with missing VK config and confirm a readable failure.
- Confirm media posts fail safely with a text-only limitation.
- Confirm manual fallback requires a reason and appears in the queue history.

### Metrics

- Record a manual metric.
- Paste-import metric rows.
- Create an active `vk_api` metric source config.
- Run VK metric collection for a real published VK post.
- Run the same source again and confirm dedupe behavior.
- Confirm metric history shows source/import provenance.

### Effectiveness and learning

- Open effectiveness analytics with publications, audiences, and metrics loaded.
- Confirm rows explain missing, stale, and weak evidence.
- Create or edit a retrospective with best links, broken items, learnings, decisions, and next actions.

### Audiences and guests

- Create or refresh an external segment.
- Link a segment to a publication.
- Confirm audience analytics reflects usage and metric evidence.
- Create a guest story.
- Update consent, stage, publication link, gift, and follow-up fields.
- Confirm guest attention indicators explain the next action.

### References and help

- Confirm reference writes are admin-only.
- Edit a non-critical reference in a safe test environment and confirm lists update.
- Open help and confirm first-use path, automation boundaries, metric limits, and evidence flow are understandable.

## Known Limits

- Telegram post analytics are not collected automatically.
- Telegram and VK publishing are text-only in the current automation.
- VK publishing and VK metric collection depend on environment-level tokens and permissions.
- Real launch readiness depends on authenticated manual QA with production-like data.
- Historical manual QA items remain in the backlog and should be retired only after real-user validation.

## Launch Decision

Launch can proceed when:

- Access and navigation checks pass.
- One complete campaign-to-retrospective workflow is manually verified.
- Telegram and VK configured and missing-config paths are verified or explicitly disabled.
- VK metric collection is verified with a real post or marked unavailable because credentials are not ready.
- Known limits are communicated to operators.
- Release blockers are either fixed or documented with an owner.
