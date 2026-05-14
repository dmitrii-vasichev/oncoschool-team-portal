# Content Factory Design

_Last recovered on 2026-05-14 after the original `docs/plans/2026-05-13-content-factory-design.md` file was lost with a removed worktree._

## Recovery Sources

This document is the tracked replacement for the lost design document. It is reconstructed from:

- Sprint 1 data-layer commit `2b7ecda feat: add Content Factory module foundation (Sprint 1 — data layer)`.
- Sprint 2 API commit `4c4a448 feat: Sprint 2 — Content Factory REST API (25 endpoints, permission gate)`.
- Follow-up commit `6ff0967 feat(cf): protect bundle DELETE with admin gate and FK pre-check`.
- Current backend models, schemas, Alembic revisions, services, tests, and seed data.
- Preserved deep research source: `docs/content-factory-market-context-report.md`.

The original detailed design and sprint plans were lost, but the deep research source survived and is now tracked in this repository. Sprint planning should use both sources of truth: the market/research recommendations in `docs/content-factory-market-context-report.md` and the data/API shape already merged in Sprint 1 and Sprint 2.

## Product Goal

Content Factory is an internal production workspace for planning, producing, scheduling, publishing, measuring, and reviewing Oncoschool content across multiple channels. It is separate from the legacy Telegram analysis content module and should use the `/api/content-factory/*` backend surface.

The module is centered on:

- Bundles: campaign-like production units such as lives, webinars, seasonal campaigns, and product launches.
- Publications: channel-specific content items inside a bundle.
- Reference tables: platforms, formats, rubrics, nosologies, and funnel templates.
- Segments: read-only audience segment mirrors, currently scoped to GetCourse.
- Metrics: manually or externally recorded snapshots for publication performance.
- Retrospectives: weekly, monthly, bundle, or ad-hoc learnings and decisions.

## Access Model

Content Factory access is gated by `team_members.has_content_factory_access`; admin users inherit access implicitly.

Current backend rules:

- Any active admin can access Content Factory.
- Any active non-admin with `has_content_factory_access=true` can access operational Content Factory endpoints.
- Reference-table writes are admin-only.
- Bundle hard delete is admin-only and blocked when publications exist.
- Granular editor/reviewer/publisher roles are deferred.

Sprint 3 frontend should not reuse the existing legacy `ContentAccess` grants for Telegram analysis or reports. It should add a dedicated Content Factory guard based on the current user role plus `has_content_factory_access`. The `/api/auth/me` response currently needs to expose this flag before the frontend can gate non-admin access correctly.

## Backend Shape

### Alembic Revisions

- `039_content_factory_reference.py`: creates `cf_platform`, `cf_format`, `cf_rubric`, `cf_nosology`, and `cf_funnel_template`.
- `040_content_factory_core.py`: creates external segments, segment snapshots, bundles, publications, publication versions, publication relations, publication segment targets, metric snapshots, and retro notes.
- `041_content_factory_access_flag.py`: adds `team_members.has_content_factory_access`.

### Reference Tables

- `cf_platform`: platform code/name, activity flag, capabilities JSON, display order.
- `cf_format`: content format metadata, default objective, medical review flag, display order.
- `cf_rubric`: rubric taxonomy with deprecation support.
- `cf_nosology`: nosology taxonomy with deprecation support.
- `cf_funnel_template`: reusable funnel templates with ordered publication recipes in JSON.

Reference seed data lives in `backend/app/services/content_factory/seed.py` and is idempotent.

### Core Tables

- `cf_external_segment`: GetCourse segment mirror with population count, owner, active flag, and source identity.
- `cf_segment_snapshot`: segment population history.
- `cf_bundle`: production bundle with product stream, lifecycle status, event date, owner, brief, funnel template, and source material references.
- `cf_publication`: channel-specific publication with platform, format, optional rubric/nosology, title/body/media, schedule, publishing metadata, responsible user, status, UTM data, and version number.
- `cf_publication_version`: body-text audit trail keyed by publication and version number.
- `cf_publication_relation`: directed relationship between publications, such as follow-up or crosspost links.
- `cf_publication_segment_target`: target/exclusion/control/retargeting segment links for a publication.
- `cf_metric_snapshot`: performance snapshots by window and metric name.
- `cf_retro_note`: retrospective notes, learnings, decisions, and actions.

## Backend API Surface

All routes are mounted under `/api/content-factory`.

Reference endpoints:

- `GET /glossary`
- `GET /platforms`
- `GET /platforms/{platform_id}`
- `POST /platforms`
- `PATCH /platforms/{platform_id}`
- `DELETE /platforms/{platform_id}`
- `GET /formats`
- `GET /formats/{format_id}`
- `POST /formats`
- `PATCH /formats/{format_id}`
- `DELETE /formats/{format_id}`
- `GET /rubrics`
- `GET /rubrics/{rubric_id}`
- `POST /rubrics`
- `PATCH /rubrics/{rubric_id}`
- `DELETE /rubrics/{rubric_id}`
- `GET /nosologies`
- `GET /nosologies/{nosology_id}`
- `POST /nosologies`
- `PATCH /nosologies/{nosology_id}`
- `DELETE /nosologies/{nosology_id}`
- `GET /funnel-templates`
- `GET /funnel-templates/{funnel_template_id}`
- `POST /funnel-templates`
- `PATCH /funnel-templates/{funnel_template_id}`
- `DELETE /funnel-templates/{funnel_template_id}`

Operational endpoints:

- `GET /bundles`
- `POST /bundles`
- `GET /bundles/{bundle_id}`
- `PATCH /bundles/{bundle_id}`
- `DELETE /bundles/{bundle_id}`
- `GET /bundles/{bundle_id}/publications`
- `POST /bundles/{bundle_id}/publications`
- `GET /publications/{publication_id}`
- `PATCH /publications/{publication_id}`
- `GET /publications/{publication_id}/versions`
- `GET /publications/{publication_id}/segments`
- `POST /publications/{publication_id}/segments`
- `DELETE /publications/{publication_id}/segments/{external_segment_id}`
- `POST /publications/{publication_id}/metrics`
- `GET /publications/{publication_id}/metrics`
- `GET /segments`
- `POST /segments`
- `GET /segments/{segment_id}`
- `POST /segments/{segment_id}/refresh`
- `GET /segments/{segment_id}/snapshots`
- `GET /retros`
- `POST /retros`
- `GET /retros/{retro_id}`
- `PATCH /retros/{retro_id}`

## Domain Values

Product streams:

- `onco_school`
- `nko`
- `medtourism`
- `alternative`
- `patient_live`
- `expert_live`
- `seasonal`

Bundle statuses:

- `planning`
- `production`
- `live`
- `retrospective`
- `archived`

Publication statuses:

- `draft`
- `needs_copy`
- `needs_design`
- `factcheck`
- `doctor_review`
- `approved`
- `scheduled`
- `published`
- `failed`
- `cancelled`

Metric windows:

- `3h`
- `24h`
- `72h`
- `7d`
- `final`
- `custom`

Retro types:

- `weekly`
- `monthly`
- `bundle`
- `adhoc`

## Sprint 3 Frontend Direction

Sprint 3 should create the first usable web surface rather than a full admin console.

Recommended first slice:

1. Add frontend Content Factory types and API client methods for reference reads, bundles, publications, metrics, segments, and retros.
2. Expose `has_content_factory_access` in the current user contract and add a frontend guard for `/content-factory`.
3. Add sidebar/header navigation for users with Content Factory access.
4. Build `/content-factory/dashboard` as the operational overview:
   - bundle status counts,
   - upcoming scheduled publications,
   - overdue production items,
   - recently published items,
   - quick links into bundle detail or calendar.
5. Build `/content-factory/calendar` as the planning view:
   - publications grouped by date,
   - filters for status, platform, format, responsible user, and bundle,
   - clear status treatment for draft, review, scheduled, published, failed, and cancelled.

Deferred frontend slices:

- Reference-table admin CRUD.
- Bundle detail editing.
- Publication editor and version history UI.
- Segment management UI.
- Metrics capture UI.
- Retro workspace.
- Automation or API publishing integrations.

## Product Roadmap

The roadmap keeps the original research thread intact while preserving the incremental implementation style already used in Sprint 1 and Sprint 2.

### Sprint 3: Frontend Foundation, Dashboard, And Calendar

Goal: make Content Factory visible and useful in the portal without trying to build the full editorial workspace in one pass.

Scope:

- Dedicated frontend access guard based on admin role or `has_content_factory_access`.
- Content Factory navigation and page shell.
- Frontend types and API client methods for current backend resources.
- `Dashboard` view for bundle status, publication status, upcoming scheduled items, overdue production items, and recently published items.
- `Calendar` view for date-grouped publications with filters by status, platform, format, responsible user, and bundle.
- A backend bridge endpoint for listing publications across bundles, because dashboard/calendar need publication-level queries.

Research tie-in:

- Copies the SaaS pattern of calendar views and campaign visibility.
- Uses the research recommendation to start with manual/semi-auto operational visibility, not universal auto-publishing.
- Keeps bundle-first discipline while making independent publications visible as calendar items.

### Sprint 4: Bundle And Publication Workspace

Goal: allow the team to work inside a campaign bundle rather than only viewing summary lists.

Scope:

- Bundle detail page with brief, owner, product stream, event date, funnel template, source materials, and publication list.
- Publication detail/editing surface for title, body, media refs, schedule, status, UTM, post URL, post ID, responsible user, rubric, format, platform, and nosology.
- Status transitions for copy, design, factcheck, doctor review, approval, scheduling, publication, failure, and cancellation.
- Version-history display for publication body changes.

Research tie-in:

- Implements the CoSchedule-like campaign workspace.
- Preserves independent sibling publications instead of a single-post monolith.
- Starts the Planable-like approval/version pattern without overbuilding a multi-level enterprise workflow.

### Sprint 5: Segments, UTM, Manual Metrics, And Review Discipline

Goal: connect content operations to funnel outcomes and evidence, while keeping API integrations optional.

Scope:

- Segment targeting UI for target, exclusion, control, and retargeting roles.
- UTM/click-id helper using bundle, publication, segment, channel, format, and CTA context.
- Manual metric capture for key windows such as 3h, 24h, 72h, 7d, final, and custom.
- Metric snapshot history with source, method, confidence, and notes.
- Basic review queues for items waiting on factcheck, doctor review, approval, scheduling, or publishing.

Research tie-in:

- Implements the Segment x Channel x Format matrix.
- Uses metric snapshots instead of one mutable performance number.
- Avoids the API illusion by supporting manual and confidence-aware metric sources first.

### Sprint 6: Retrospective Workflow

Goal: make weekly/monthly learning durable instead of scattered across meetings and chats.

Scope:

- Retro list and detail views.
- Weekly, monthly, bundle, and ad-hoc retro creation.
- Best-by-objective summaries, broken items, learnings, decisions, actions, and notes.
- Links from retro entries back to bundles, publications, and metrics.

Research tie-in:

- Implements the weekly/monthly retrospective object recommended by the research.
- Keeps KPI discussion objective-aware rather than reaction-first.

### Later: Patient/Guest CRM, AI Drafting, And Integrations

Goal: add specialized workflows only after the operational layer is used by the team.

Deferred scope:

- Patient/guest sourcing CRM with screening, consent, preparation, publication, gift delivery, and follow-up.
- Consent model for allowed channels, anonymity, legal notes, and sensitive boundaries.
- AI draft/variant engine for summaries, adaptations, CTA, push text, claims list, and channel variants.
- API publishing/metrics integrations where stable and worth the maintenance cost, likely email/GetCourse/VK/Telegram before Max/Dzen.

Research tie-in:

- Keeps AI as draft/variant support, not medical factcheck authority.
- Avoids universal auto-publishing in the MVP.
- Defers specialized patient/guest workflow until the base content operations layer is stable.

## Known Gaps And Follow-Ups

- The original detailed design, current-state analysis, research results, and sprint plans were lost from ignored worktrees.
- `docs/plans/` is gitignored; do not place critical project documents there again unless the ignore rule changes.
- `memory/MEMORY.md` and `memory/project_content_factory_sprint_2.md` are not present in the current checkout.
- `frontend/src/lib/types.ts` does not yet include `TeamMember.has_content_factory_access`.
- `backend/app/api/auth.py` `/api/auth/me` does not yet return `has_content_factory_access`.
- Sprint 3 should decide whether `/content-factory` lives beside the existing content section or under a new sidebar item.
- The first frontend release should avoid hard delete affordances except for admin-only empty-bundle correction.

## Validation Commands

Backend focused verification:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_bundle_service.py tests/test_cf_publication_service.py tests/test_cf_seed.py tests/test_cf_segment_metric_retro_services.py tests/test_content_factory_models.py tests/test_content_factory_permissions.py tests/test_content_factory_schemas.py tests/test_content_factory_bundles_api.py tests/test_content_factory_formats_api.py tests/test_content_factory_funnel_templates_api.py tests/test_content_factory_glossary_api.py tests/test_content_factory_glossary_service.py tests/test_content_factory_metrics_api.py tests/test_content_factory_nosologies_api.py tests/test_content_factory_platforms_api.py tests/test_content_factory_publication_service_extras.py tests/test_content_factory_publications_api.py tests/test_content_factory_retro_update.py tests/test_content_factory_retros_api.py tests/test_content_factory_rubrics_api.py tests/test_content_factory_segments_api.py tests/test_team_cf_access_api.py -q
```

Full backend verification, when a clean `test:test@localhost:5432/test` database is provisioned:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q
```

Frontend baseline verification for Sprint 3:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
```

Repository hygiene:

```bash
git diff --check
```
