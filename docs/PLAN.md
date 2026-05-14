# Active Plan: Content Factory Sprint 8 Segment Workspace

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-14-content-factory-sprint-8-segments.md`. Keep `docs/STATUS.md` current after meaningful implementation or validation steps.

**Goal:** Add a Content Factory segment registry and detail workspace for segment mirrors, population refreshes, and snapshot comparisons.

**Recovered design:** `docs/content-factory-design.md`

**Preserved market research:** `docs/content-factory-market-context-report.md`

**Detailed design:** `docs/superpowers/specs/2026-05-14-content-factory-sprint-8-segments-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-14-content-factory-sprint-8-segments.md`

**Backlog:** `docs/BACKLOG.md`

**Milestones:**

1. Add frontend API detail method and pure helpers for segment filtering, summaries, and snapshot comparison.
2. Add a segment create dialog for manual external segment mirrors.
3. Add a segment refresh dialog for population-count snapshots.
4. Add a snapshot list/comparison component.
5. Add `/content-factory/segments` registry with search, active/source filters, create, refresh, and detail links.
6. Add `/content-factory/segments/[id]` detail with metadata and snapshot history.
7. Add sidebar/header navigation, run verification, and update durable repo docs.

**Implementation status:**

- Implemented; automated verification passed; preparing PR from branch `codex/content-factory-sprint-8-segments`.
- Sprint 1 and Sprint 2 backend work are merged to `main`.
- Sprint 2.5 recovery and Sprint 3 frontend foundation are merged to `main`.
- Sprint 4 bundle/publication workspace is merged to `main`.
- Sprint 5 segments, UTM, manual metrics, and review queues are merged to `main`.
- Sprint 6 retrospective workspace is merged to `main`.
- Sprint 7 reference admin workspace is merged to `main`.

**Definition of done:**

- `/content-factory/segments` lists active and inactive segment mirrors.
- Users with Content Factory access can create manual segment mirrors.
- Users with Content Factory access can refresh segment population counts and create snapshots.
- `/content-factory/segments/[id]` shows segment metadata, latest/previous snapshot comparison, and snapshot history.
- Search, source, and active filters work without a page reload.
- Snapshot comparison handles zero, one, and many snapshots safely.
- Verification commands pass and docs are updated.

**Validation commands:**

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

**Latest verification result:**

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts` passed: 50 tests, with existing Node module-type warnings.
- `cd frontend && npm test` passed: 134 tests, with existing Node module-type warnings.
- `cd frontend && npx tsc --noEmit` passed.
- `cd frontend && npm run lint` passed with no ESLint warnings or errors.
- `cd frontend && npm run build` passed, including `/content-factory/segments` and `/content-factory/segments/[id]`.
- Local dev server smoke on `http://127.0.0.1:3007/content-factory/segments` returned HTTP 200 and compiled the route.
- `git diff --check` passed.

---

# Previous Plan: Content Factory Sprint 7 Reference Admin

> **For agentic workers:** Sprint 7 is complete and merged. The implementation plan is `docs/superpowers/plans/2026-05-14-content-factory-sprint-7-reference-admin.md`.

**Goal:** Add a Content Factory reference-table admin workspace for platforms, formats, rubrics, nosologies, and funnel templates.

**Implementation status:**

- Implemented; automated verification passed; merged to `main` through PR #185.

**Latest verification result:**

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts` passed: 43 tests, with existing Node module-type warnings.
- `cd frontend && npm test` passed: 127 tests, with existing Node module-type warnings.
- `cd frontend && npx tsc --noEmit` passed.
- `cd frontend && npm run lint` passed with no ESLint warnings or errors.
- `cd frontend && npm run build` passed, including `/content-factory/references`.
- Local dev server smoke on `http://127.0.0.1:3006/content-factory/references` returned HTTP 200 and compiled the route.
- `git diff --check` passed.

---

# Previous Plan: Content Factory Sprint 6 Retrospective Workspace

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-14-content-factory-sprint-6-retros.md`. Keep `docs/STATUS.md` current after meaningful implementation or validation steps.

**Goal:** Build the Content Factory retrospective workspace so weekly, monthly, bundle, and ad-hoc learning is captured in the portal instead of scattered across chats and meetings.

**Recovered design:** `docs/content-factory-design.md`

**Preserved market research:** `docs/content-factory-market-context-report.md`

**Detailed design:** `docs/superpowers/specs/2026-05-14-content-factory-sprint-6-retros-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-14-content-factory-sprint-6-retros.md`

**Backlog:** `docs/BACKLOG.md`

**Milestones:**

1. Add frontend API methods and pure helpers for retrospectives.
2. Add a JSON-backed create/edit retro dialog.
3. Add `/content-factory/retros` list route with type filtering and detail links.
4. Add `/content-factory/retros/[id]` detail route with structured evidence sections.
5. Add sidebar/header navigation, run verification, and update durable repo docs.

**Implementation status:**

- Implemented; automated verification passed; merged to `main` through PR #184.
- Sprint 1 and Sprint 2 backend work are merged to `main`.
- Sprint 2.5 recovery and Sprint 3 frontend foundation are merged to `main`.
- Sprint 4 bundle/publication workspace is merged to `main`.
- Sprint 5 segments, UTM, manual metrics, and review queues are merged to `main`.

**Definition of done:**

- `/content-factory/retros` lists weekly, monthly, bundle, and ad-hoc retrospectives.
- Users with Content Factory access can create retrospectives with period, type, facilitator, optional bundle, structured JSON sections, and notes.
- `/content-factory/retros/[id]` shows period, type, facilitator, linked bundle, structured evidence sections, and notes.
- Existing supported retro fields can be edited from the detail page.
- Verification commands pass and docs are updated.

**Validation commands:**

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

**Latest verification result:**

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts` passed: 37 tests, with existing Node module-type warnings.
- `cd frontend && npm test` passed: 121 tests, with existing Node module-type warnings.
- `cd frontend && npx tsc --noEmit` passed.
- `cd frontend && npm run lint` passed with no ESLint warnings or errors.
- `cd frontend && npm run build` passed, including `/content-factory/retros` and `/content-factory/retros/[id]`.
- Browser smoke passed on `http://localhost:3003` with a temporary local mock API: authenticated login, `/content-factory/retros` list, `/content-factory/retros/retro-1` detail, and edit dialog rendered.
- `git diff --check` passed.

---

# Previous Plan: Content Factory Sprint 5 Outcomes

> **For agentic workers:** Sprint 5 is complete and merged. The implementation plan is `docs/superpowers/plans/2026-05-14-content-factory-sprint-5-outcomes.md`.

**Goal:** Connect Content Factory publications to segment targeting, UTM discipline, manual metric evidence, and review queues without introducing brittle publishing integrations.

**Implementation status:**

- Implemented; automated verification passed; merged to `main` through PR #183.

**Latest verification result:**

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts` passed: 29 tests, with existing Node module-type warnings.
- `cd frontend && npm test` passed: 113 tests, with existing Node module-type warnings.
- `cd frontend && npx tsc --noEmit` passed.
- `cd frontend && npm run lint` passed with no ESLint warnings or errors.
- `cd frontend && npm run build` passed, including `/content-factory/review` and updated `/content-factory/publications/[id]`.
- `git diff --check` passed.

---

# Previous Plan: Content Factory Sprint 4 Workspace

> **For agentic workers:** Sprint 4 is complete and merged. The implementation plan is `docs/superpowers/plans/2026-05-14-content-factory-sprint-4-workspace.md`.

**Goal:** Build the Content Factory bundle and publication workspace so users can create bundles, work inside a campaign bundle, edit publication production fields, and inspect publication body version history.

**Implementation status:**

- Implemented; automated verification passed; merged to `main` through PR #182.

---

# Previous Plan: Content Factory Sprint 3 Frontend

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-14-content-factory-sprint-3-frontend.md`. Keep `docs/STATUS.md` current after meaningful implementation or validation steps.

**Goal:** Build the first usable Content Factory frontend slice: access guard, navigation, dashboard, and calendar backed by the existing Sprint 1/2 API plus one publication-list bridge endpoint.

**Recovered design:** `docs/content-factory-design.md`

**Preserved market research:** `docs/content-factory-market-context-report.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-14-content-factory-sprint-3-frontend.md`

**Backlog:** `docs/BACKLOG.md`

**Milestones:**

1. Add the backend bridge endpoint and `/api/auth/me` Content Factory access flag.
2. Add frontend Content Factory types, API methods, permissions, and pure dashboard/calendar helpers.
3. Add `/content-factory` route protection, sidebar/header navigation, and source guards.
4. Build the Content Factory dashboard page.
5. Build the Content Factory calendar page.
6. Run backend/frontend verification and update durable repo docs.

**Implementation status:**

- Implemented; automated verification passed.
- Sprint 1 and Sprint 2 backend work are already merged to `main`.
- Sprint 2.5 recovery restored the durable docs and local environment needed before frontend work.

**Definition of done:**

- `/api/auth/me` returns `has_content_factory_access`.
- `GET /api/content-factory/publications` supports dashboard/calendar filters across bundles.
- Frontend has typed Content Factory API client methods and pure helper coverage.
- Admin users and members with `has_content_factory_access` can access `/content-factory`.
- Sidebar/header expose Content Factory dashboard and calendar navigation.
- Dashboard shows bundle status, publication status, upcoming scheduled work, overdue production work, and recent published work.
- Calendar groups publications by date, supports core filters, and keeps unscheduled work visible.
- Verification commands pass and docs are updated.

**Validation commands:**

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_auth_me_content_factory.py tests/test_content_factory_publications_api.py -q
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

**Latest verification result:**

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_auth_me_content_factory.py tests/test_content_factory_publications_api.py -q` passed: 10 tests, with existing pytest-asyncio warning.
- Full focused Content Factory backend suite passed: 133 tests, with existing AsyncMock/runtime warnings.
- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts` passed: 16 tests, with existing Node module-type warnings.
- `cd frontend && npm test` passed: 100 tests, with existing Node module-type warnings.
- `cd frontend && npx tsc --noEmit` passed.
- `cd frontend && npm run lint` passed with no ESLint warnings or errors.
- `cd frontend && npm run build` passed, including `/content-factory/dashboard` and `/content-factory/calendar`.
- `git diff --check` passed.
- Browser smoke on `http://127.0.0.1:3005/content-factory/dashboard` and `/content-factory/calendar` returned HTTP 200 and rendered the existing unauthenticated login flow through system Chrome screenshots.

---

# Previous Plan: Content Factory Recovery Sprint 2.5

> **For agentic workers:** This recovery sprint is complete. The original Content Factory docs under `docs/plans/` were lost with removed worktrees, and `docs/plans/` is gitignored. Use tracked docs for all durable Content Factory decisions.

**Goal:** Restore the durable Content Factory execution pack before Sprint 3 frontend work begins.

**Recovered design:** `docs/content-factory-design.md`

**Backlog:** `docs/BACKLOG.md`

**Milestones:**

1. Recreate local backend development environment variables.
2. Clean up new Content Factory tests to use timezone-aware UTC helpers.
3. Restore a tracked Content Factory design document from Sprint 1/2 code artifacts.
4. Update repo-owned plan, status, test plan, and backlog for Content Factory.
5. Run focused backend verification and repository hygiene checks.

**Implementation status:**

- Implemented; focused verification passed.
- Sprint 1 and Sprint 2 backend work are already merged to `main`.
- Sprint 3 frontend work should start only after the recovery documents and focused checks are in place.

**Definition of done:**

- `backend/.env` exists locally with the Docker development Content Factory database URL.
- Critical Content Factory design context is available in a tracked path.
- `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md` identify Content Factory as the active workstream.
- New Content Factory tests no longer use `datetime.utcnow()`.
- Focused Content Factory backend tests pass.
- `git diff --check` passes.

**Validation commands:**

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_bundle_service.py tests/test_cf_publication_service.py tests/test_cf_seed.py tests/test_cf_segment_metric_retro_services.py tests/test_content_factory_models.py tests/test_content_factory_permissions.py tests/test_content_factory_schemas.py tests/test_content_factory_bundles_api.py tests/test_content_factory_formats_api.py tests/test_content_factory_funnel_templates_api.py tests/test_content_factory_glossary_api.py tests/test_content_factory_glossary_service.py tests/test_content_factory_metrics_api.py tests/test_content_factory_nosologies_api.py tests/test_content_factory_platforms_api.py tests/test_content_factory_publication_service_extras.py tests/test_content_factory_publications_api.py tests/test_content_factory_retro_update.py tests/test_content_factory_retros_api.py tests/test_content_factory_rubrics_api.py tests/test_content_factory_segments_api.py tests/test_team_cf_access_api.py -q
git diff --check
```

**Next plan after recovery:**

- Sprint 3: Content Factory frontend foundation, dashboard, and calendar.

**Latest verification result:**

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_bundle_service.py tests/test_cf_publication_service.py tests/test_cf_seed.py tests/test_cf_segment_metric_retro_services.py tests/test_content_factory_models.py tests/test_content_factory_permissions.py tests/test_content_factory_schemas.py tests/test_content_factory_bundles_api.py tests/test_content_factory_formats_api.py tests/test_content_factory_funnel_templates_api.py tests/test_content_factory_glossary_api.py tests/test_content_factory_glossary_service.py tests/test_content_factory_metrics_api.py tests/test_content_factory_nosologies_api.py tests/test_content_factory_platforms_api.py tests/test_content_factory_publication_service_extras.py tests/test_content_factory_publications_api.py tests/test_content_factory_retro_update.py tests/test_content_factory_retros_api.py tests/test_content_factory_rubrics_api.py tests/test_content_factory_segments_api.py tests/test_team_cf_access_api.py -q` passed: 131 tests, with existing AsyncMock/pytest-asyncio warnings.
- `git diff --check` passed.

---

# Previous Plan: Projects Phase 2

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-13-projects-phase-2.md`. Keep this section as the current source-of-truth index for milestone order, definition of done, and validation commands.

**Goal:** Add a Phase 2 Projects layer that connects larger accepted ideas to organized project execution while preserving direct Idea -> Tasks support for small ideas.

**Approved base spec:** `docs/superpowers/specs/2026-05-12-ideas-projects-tasks-design.md`

**Approved Phase 2 spec:** `docs/superpowers/specs/2026-05-13-projects-phase-2-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-13-projects-phase-2.md`

**Milestones:**

1. Review and approve the Phase 2 Projects MVP design.
2. Write a detailed Projects Phase 2 implementation plan.
3. Implement backend project persistence, services, permissions, and API routes.
4. Implement frontend project register/detail flows and idea integration.
5. Run backend/frontend verification and update status.

**Implementation status:**

- Implemented; automated verification passed.
- Phase 2 includes backend project persistence, schemas, repository, service rules, API routes, frontend API/types, the Projects register, project detail, idea-to-project conversion, linked task creation, comments, milestones, departments, and history.
- Accepted ideas can be converted into linked projects, and direct `Idea -> Tasks` support remains available for small ideas.

**Definition of done:**

- A new `Проекты` section exists in the web portal.
- Admin/moderator users can create direct projects.
- Accepted ideas can be converted into linked projects.
- Idea detail pages show linked projects.
- Project register supports status, owner, department, source idea, and created date filtering.
- Project detail pages show departments, milestones, linked tasks, comments, and history.
- Project tasks are created through the existing task service.
- Linked task details follow existing task visibility rules.
- Project completion is blocked until linked tasks are closed.
- Project deletion is soft deletion and is blocked once linked tasks exist.
- Direct `Idea -> Tasks` remains available for small ideas.

**Validation commands:**

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_project_service.py tests/test_projects_api.py -q
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

**Latest verification result:**

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_project_service.py tests/test_projects_api.py -q` passed: 24 tests.
- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q` passed: 442 tests, with existing warnings.
- `cd frontend && npm test` passed: 82 tests, with existing `MODULE_TYPELESS_PACKAGE_JSON` warnings.
- `cd frontend && npx tsc --noEmit` passed.
- `cd frontend && npm run lint` passed with no ESLint warnings or errors.
- `cd frontend && npm run build` passed, including `/projects`, `/projects/[id]`, `/ideas`, and `/ideas/[id]`.
- `git diff --check` passed.

---

# Previous Plan: Ideas Phase 1

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-12-ideas-phase-1.md`. Keep this section as the current source-of-truth index for milestone order, definition of done, and validation commands.

**Goal:** Add the Phase 1 web portal Ideas section with review decisions, department implementation, linked task creation, comments, and event history.

**Approved spec:** `docs/superpowers/specs/2026-05-12-ideas-projects-tasks-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-12-ideas-phase-1.md`

**Milestones:**

1. Add the backend Ideas data model and migration.
2. Add Ideas schemas, repository, service rules, and API routes.
3. Add frontend Ideas types, API client methods, register page, and detail page.
4. Add department contribution actions and linked task creation.
5. Run backend/frontend verification and update status.

**Implementation status:**

- Implemented; automated verification passed.
- Phase 1 includes backend persistence, schemas, repository, service rules, API routes, frontend API/types, the Ideas register, idea detail, department status actions, linked task creation, comments, and event history.
- Accepted ideas can add departments after review, assign department owners, and create tasks scoped to a specific department contribution.
- Follow-up implemented: idea history now renders user-facing Russian event labels instead of raw event keys.
- Follow-up implemented: ideas support soft deletion. Authors can delete only their own new ideas without linked tasks; admin/moderator users can delete ideas without linked tasks. Deleted ideas are hidden from list/detail responses.

**Definition of done:**

- Every active user can create ideas and see the shared ideas register.
- The Ideas register supports status, author, review owner, involved department, and created date filters.
- The idea detail page shows description, decision, departments, linked tasks, comments, and history.
- Rejected and deferred ideas require a reason.
- Accepted ideas can involve multiple departments with department owners and contribution statuses.
- Linked task creation uses the existing task service.
- Idea completion is gated by completed department contributions or by closed direct linked tasks when no departments are involved.
- Linked task details respect existing task visibility.
- Idea history shows readable Russian event names and status transitions, not technical event keys.
- Deleting an idea never removes linked tasks; deletion is blocked once tasks have been created.
- Deleted ideas are soft-deleted and excluded from normal Ideas register/detail views.
- Projects remain documented as Phase 2 and are not implemented in Phase 1.

**Validation commands:**

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_idea_service.py tests/test_ideas_api.py -q
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

**Latest verification result:**

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_idea_service.py tests/test_ideas_api.py -q` passed: 39 tests.
- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q` passed: 417 tests.
- `cd frontend && npm test` passed: 70 tests.
- `cd frontend && npx tsc --noEmit` passed.
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed, including `/ideas` and `/ideas/[id]`.
- `git diff --check` passed.

---

# Previous Plan: Dashboard Task Card Height Sync

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-08-dashboard-task-card-height-sync.md`. Keep this section as the current source-of-truth index for milestone order, definition of done, and validation commands.

**Goal:** Synchronize paired dashboard task card heights across the `Просрочено` and `Активные` desktop columns while preserving natural stacked cards on mobile.

**Approved spec:** `docs/superpowers/specs/2026-05-08-dashboard-task-card-height-sync-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-08-dashboard-task-card-height-sync.md`

**Milestones:**

1. Add frontend source guards for desktop row synchronization, responsive stacked fallback, and no fixed card heights.
2. Update the dashboard task block presenter so paired overdue and active desktop cards stretch to the same row height.
3. Run frontend verification and update status.

**Implementation status:**

- Implemented; automated verification passed.

**Definition of done:**

- With overdue and active tasks on desktop, paired task cards in the same visual row have matching heights.
- Task cards are not assigned one fixed global height.
- Extra tasks in the longer group continue in the correct column without visible empty alignment cells.
- With zero overdue tasks, the overdue group remains hidden and no empty synchronization cells are visible.
- On mobile, groups remain stacked with natural card heights.
- The `Активность за 7 дней` card is not height-synchronized with the task block.
- Existing independent expansion behavior for `Просрочено` and `Активные` still works.

**Validation commands:**

```bash
cd frontend && node --test --experimental-strip-types src/app/dashboardCompletedWeekCard.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

---

# Previous Plan: Dashboard Task Columns

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-08-dashboard-task-columns.md`. Keep this section as the current source-of-truth index for milestone order, definition of done, and validation commands.

**Goal:** Render overdue and active dashboard tasks as readable internal columns on desktop while keeping a stacked, no-scroll mobile layout.

**Approved spec:** `docs/superpowers/specs/2026-05-08-dashboard-task-columns-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-08-dashboard-task-columns.md`

**Milestones:**

1. Add frontend source guards for the grouped-column task block, updated explanatory copy, and no-overdue badge behavior.
2. Update the dashboard task block presenter so `Просрочено` and `Активные` render as internal responsive groups with independent expansion.
3. Run frontend verification and update status.

**Implementation status:**

- Implemented; automated verification passed.

**Definition of done:**

- With overdue and active tasks, the dashboard task block shows two internal groups on desktop: `Просрочено` and `Активные`.
- Overdue tasks appear only in `Просрочено`.
- Active non-overdue tasks appear only in `Активные`.
- The explanatory line reads `Задачи сгруппированы по состоянию и отсортированы по срочности.`
- With zero overdue tasks, the dashboard shows no empty overdue group, no red zero badge, and active tasks use the available width.
- With zero open tasks, the existing empty task state appears without group headings.
- On mobile, groups stack vertically with `Просрочено` before `Активные`.
- The `Активность за 7 дней` card remains unchanged.

**Validation commands:**

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

---

# Previous Plan: Dashboard Task Activity Redesign

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-08-dashboard-task-activity-redesign.md`. Keep this section as the current source-of-truth index for milestone order, definition of done, and validation commands.

**Goal:** Redesign the dashboard task row so overdue tasks are grouped inside the main task block and the former completed-week card becomes a scoped activity card with drill-down task lists.

**Approved spec:** `docs/superpowers/specs/2026-05-08-dashboard-task-activity-redesign-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-08-dashboard-task-activity-redesign.md`

**Milestones:**

1. Add backend dashboard activity analytics with role-aware `my`, `department`, and `team` scopes.
2. Add frontend task grouping helpers so overdue tasks appear once inside the main task block.
3. Add frontend activity API/types.
4. Replace the separate overdue and completed-week dashboard cards with a two-column task block plus an activity card.
5. Run backend/frontend verification and update status.

**Implementation status:**

- Planned; implementation not started.

**Definition of done:**

- Dashboard task area shows no duplicate task cards.
- Overdue tasks appear as a `Просрочено` group inside the main task block.
- Non-overdue open tasks appear as an `Активные` group inside the same block.
- The old separate overdue dashboard card is removed.
- The old completed-week card is replaced by `Активность за 7 дней`.
- Activity metrics include completed, created, `В работе > 7 дней`, and completed-task delta versus the previous week.
- Activity drill-down opens inline inside the activity card.
- `Команда` scope is visible only to admin/moderator users.
- Backend activity calculations enforce the same visibility rules as the task block.
- `В работе > 7 дней` is calculated from `task_updates.new_status = in_progress`, not from `updated_at`.

**Validation commands:**

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_dashboard_activity_api.py -q
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

---

# Previous Plan: Dashboard Task Block Expansion

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-08-dashboard-task-block-expansion.md`. Keep this section as the current source-of-truth index for milestone order, definition of done, and validation commands.

**Goal:** Keep dashboard task blocks compact by default while letting users expand each block inline to see every loaded task represented by that block.

**Approved spec:** `docs/superpowers/specs/2026-05-08-dashboard-task-block-expansion-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-08-dashboard-task-block-expansion.md`

**Milestones:**

1. Add dashboard task ordering and preview helpers.
2. Render active, overdue, and completed-week task blocks through a shared expandable dashboard block.
3. Keep completed-week tasks on the dashboard instead of sending users to an unrelated Kanban view.
4. Update dashboard source guards and repo execution docs.
5. Run frontend verification and browser QA.

**Implementation status:**

- Implemented; automated verification passed.
- Frontend task ordering helpers, expandable dashboard task blocks, and dashboard source guards are implemented.

**Definition of done:**

- Each dashboard task block shows at most five tasks on first load.
- Blocks with more than five tasks show `Показать ещё N` and expand inline.
- Expanded blocks show every loaded task for the current block and scope.
- Expanded blocks can collapse back to the compact preview.
- Active tasks are ordered by urgency, overdue state, nearest deadline, then newest creation.
- Overdue tasks are ordered by urgency, oldest missed deadline, then newest creation.
- Completed-week tasks remain ordered by most recent completion.
- The completed-week block no longer depends on a generic `Все задачи` Kanban link to reveal its list.
- If a loaded API page is truncated, the UI does not imply the list is complete.

**Validation commands:**

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

---

# Previous Plan: Meeting Board Focus

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-08-meeting-board-focus.md`. Keep this section as the current source-of-truth index for milestone order, definition of done, and validation commands.

**Goal:** Add topical focus labels and improved task sections to the meeting board while preserving current behavior when no focus is selected.

**Approved spec:** `docs/superpowers/specs/2026-05-08-meeting-board-focus-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-08-meeting-board-focus.md`

**Milestones:**

1. Extend meeting board settings with `focus_label_ids`.
2. Filter participant, added-member, and added-department tasks by focus labels when configured.
3. Keep pinned tasks as focus-filter exceptions without bypassing task visibility.
4. Add a `New` board section and exclude cancelled tasks.
5. Rename the board review section to `На согласовании` and clarify completed wording as `Выполнено за 7 дней`.
6. Replace the persistent scope column with a compact scope summary and moderator settings sheet.
7. Update docs and run backend/frontend verification.

**Implementation status:**

- Implemented in branch `codex/meeting-board-focus`; automated verification passed.
- Backend data contract, focus filtering, pinned exceptions, new section grouping, and cancelled exclusion are implemented.
- Frontend board sections, type contract, restricted focus-label picker, compact scope summary, and settings sheet are implemented.

**Definition of done:**

- Boards without focus labels behave like the previous board, except for the added `New` section and wording cleanup.
- Boards with focus labels show participant, added-member, and added-department tasks only when tasks have at least one selected focus label.
- Pinned tasks remain visible despite focus labels when the viewer can already access them.
- Focus labels never reveal tasks outside existing visibility rules.
- New tasks appear on the meeting board.
- Cancelled tasks do not appear on the meeting board.
- The review section displays as `На согласовании`.
- Completed tasks are shown by `completed_at` within the last 7 days.
- The scope UI is compact by default and editable through a moderator-only sheet.

**Validation commands:**

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_board_service.py tests/test_meeting_board_api.py -q
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

---

# Previous Plan: Long Meeting Audio Transcription

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-07-long-meeting-audio-transcription.md`. Keep this section as the current source-of-truth index for milestone order, definition of done, and validation commands.

**Goal:** Make meeting audio transcription reliable for one- to two-hour Zoom recordings by queueing work, preparing OpenAI-safe chunks, and notifying the requester when processing finishes.

**Approved spec:** `docs/superpowers/specs/2026-05-07-long-meeting-audio-transcription-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-07-long-meeting-audio-transcription.md`

**Milestones:**

1. Extend meeting AI processing state with durable queue/progress fields.
2. Add `ffmpeg` audio preparation into safe chunks below OpenAI's 25 MB upload limit.
3. Process queued transcription jobs from the existing backend scheduler.
4. Return immediately from the transcription button and expose a polling endpoint.
5. Notify the initiating moderator in the portal and Telegram on completion or failure.
6. Show frontend progress and let the user leave the page while work continues.
7. Update Railway Docker images, docs, and verification.

**Implementation status:**

- Implemented in this branch; automated verification passed.

**Definition of done:**

- `Transcribe audio` does not block the browser on a long HTTP request.
- Recordings larger than 25 MB are downloaded temporarily and prepared into OpenAI-safe chunks.
- The backend stores progress in PostgreSQL and can recover queued/stale work after restart.
- The meeting AI panel shows queued/transcribing progress and polls until completion/failure.
- The initiating moderator receives in-app and Telegram notifications.
- No Zoom audio file is persisted in portal storage.
- Railway backend images install `ffmpeg`.

**Validation commands:**

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_ai_outcomes_service.py tests/test_meeting_ai_outcomes_api.py -q
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

---

# Previous Plan: Meeting Board and AI Outcomes

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-07-meeting-board-and-ai-outcomes.md`. Keep this section as the current source-of-truth index for milestone order, definition of done, and validation commands.

**Goal:** Build a shareable meeting board for live task-based calls and a manual post-meeting AI outcome review flow from Zoom audio.

**Approved spec:** `docs/superpowers/specs/2026-05-07-meeting-board-and-ai-outcomes-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-07-meeting-board-and-ai-outcomes.md`

**Milestones:**

1. Backend board and AI processing data model.
2. Meeting board repository, service, and API.
3. Manual Zoom audio transcription with temporary-file cleanup.
4. AI outcome draft generation and moderator-only publish flow.
5. Frontend types, API client, and board route.
6. Frontend AI outcomes panel.
7. Documentation, full verification, and browser QA.

**Implementation status:**

- Backend board settings, scope computation, visible task sections, and settings API are implemented.
- The first frontend board route displays board scope counts, task sections, materials, and notes. Inline editing for board composition is intentionally left as a follow-up UI; the settings API is ready for that editor.
- Manual Zoom audio transcription downloads audio only to temporary storage and deletes it on success or failure.
- AI outcome publishing requires a moderator-reviewed draft in `draft_ready` state at both the frontend and backend API layers.

**Definition of done:**

- Meeting detail page opens a separate screen-share-friendly meeting board.
- Board is seeded from meeting participants and the backend settings API supports moderator-added people, departments, pinned tasks, links, and notes.
- Board shows urgent, in-progress, review, and done-this-week sections without copying tasks.
- Board and pinned task visibility do not bypass existing task permissions.
- Audio transcription is manual-only.
- Zoom audio is downloaded only to temporary storage and deleted on success or failure.
- Transcript source `openai_audio` and processing metadata are saved.
- AI produces only summary, decisions, and new task candidates.
- Moderator confirmation is required before decisions are saved or tasks are created.
- Rejected task candidates are not created.

**Validation commands:**

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_board_service.py tests/test_meeting_board_api.py tests/test_meeting_ai_outcomes_service.py tests/test_meeting_ai_outcomes_api.py -q
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

---

# Previous Plan: Task Board Visual Polish

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-06-task-board-visual-polish.md`. Keep this section as the current source-of-truth index for milestone order, definition of done, and validation commands.

**Goal:** Tighten the task creation dialog, task board cards, and empty Kanban columns according to the approved visual polish design.

**Approved spec:** `docs/superpowers/specs/2026-05-06-task-board-visual-polish-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-06-task-board-visual-polish.md`

**Milestones:**

1. Compact the new task dialog: collapsed description, one-row labels/urgency, off-by-default urgent switch, compact checklist add control.
2. Tighten task cards: remove the footer `Срочно` badge, expose urgency accessibly, reduce reserved title/source space before checklist previews.
3. Replace empty Kanban column illustration/copy with a quiet dashed drop-zone.
4. Update status/test docs, run frontend verification, and complete browser QA.

**Definition of done:**

- New task dialog does not show internal scroll in normal desktop viewport.
- Description is collapsed by default and expands on demand.
- Labels and urgency share one row on desktop dialog widths and stack cleanly on narrow widths.
- Urgency remains off by default and still writes `normal`; enabling it writes `urgent`.
- Urgent board cards keep the red left edge and no longer show the footer `Срочно` badge.
- Urgency remains available to assistive technology on task card links.
- Task cards with checklist previews do not show a large empty gap between title and checklist.
- Empty columns show a quiet dashed drop-zone instead of `Нет задач` copy and illustration.
- Drag-over styling remains visible for empty columns.

**Validation commands:**

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

---

# Previous Plan: Task Urgency and Create Checklist

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-06-task-urgency-and-create-checklist.md`. Keep this section as the current source-of-truth index for milestone order, definition of done, and validation commands.

**Goal:** Replace four-level task priority with binary task urgency across the system, remove status/priority icons from task cards, and allow checklist items during task creation.

**Approved spec:** `docs/superpowers/specs/2026-05-06-task-urgency-and-create-checklist-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-06-task-urgency-and-create-checklist.md`

**Milestones:**

1. Backend urgency domain, schemas, service normalization, API filters, and migration.
2. Backend AI, bot, notifications, reminders, and analytics integrations.
3. Frontend urgency helpers, types, filters, and filter tests.
4. Task cards, create dialog checklist, and task detail urgency editing.
5. Meeting preview, analytics, reminder settings copy, and documentation.
6. Final backend/frontend verification and browser QA.

**Definition of done:**

- Existing `urgent` and `high` tasks are urgent after migration.
- Existing `medium` and `low` tasks are normal after migration.
- New task writes produce only `normal` or `urgent`.
- Task cards do not show status or priority icons.
- Urgent cards show the approved red left edge and visible `Срочно` text.
- Overdue cards remain visually distinct and can coexist with urgency.
- New task dialog submits draft checklist items.
- Web, backend, bot, AI, notifications, reminders, analytics, docs, and tests use urgency language.

**Validation commands:**

```bash
cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_task_urgency.py tests/test_task_update_permissions.py tests/test_reminder_digest_section_order.py tests/test_task_label_task_api.py tests/test_task_permission_service.py -q
cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

---

# Task Label Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add task label color selection, member-owned label editing/archiving, and moderator label cleanup in Settings.

**Architecture:** Extend the existing `TaskLabel` catalog instead of adding a new entity. Backend endpoints compute per-user label capabilities and enforce the shared-label ownership rule; frontend uses those capability flags in the picker and a moderator Settings section. Archived labels remain attached to old tasks but are excluded from normal picker/search and cannot be newly attached.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, Pydantic, Alembic-managed PostgreSQL schema already present, Next.js 14, React 18, TypeScript, Tailwind CSS, Radix/shadcn UI primitives, lucide-react, Python `pytest`, frontend Node test runner.

---

## Source Documents

- Approved design spec: `docs/superpowers/specs/2026-05-06-task-label-management-design.md`
- Existing task label design: `docs/superpowers/specs/2026-05-05-task-labels-design.md`
- Current backend label API: `backend/app/api/task_labels.py`
- Current backend label repository: `backend/app/db/repositories.py`
- Current backend schemas: `backend/app/db/schemas.py`
- Current task attach endpoint: `backend/app/api/tasks.py`
- Current frontend picker: `frontend/src/components/tasks/TaskLabelPicker.tsx`
- Current frontend chips: `frontend/src/components/tasks/TaskLabelChips.tsx`
- Current settings tabs: `frontend/src/app/settings/page.tsx`

## Scope Check

This plan covers one cohesive feature: task label catalog management for the web portal. It includes backend permissions/API, frontend picker color/action UI, moderator Settings UI, tests, and documentation. It does not include label merge, analytics, Telegram bot label management, or separate personal label pages.

## File Structure

- Modify `backend/app/db/repositories.py`: label palette validation, active-only create behavior, update/archive/restore helpers, shared-label query, archived attach guard.
- Modify `backend/app/db/schemas.py`: label create/update/response schemas and capability fields.
- Modify `backend/app/api/task_labels.py`: list/create/update/archive/restore endpoints and per-user capability responses.
- Modify `backend/tests/test_task_label_repository.py`: repository behavior tests.
- Modify `backend/tests/test_task_label_api.py`: API permission, conflict, and response capability tests.
- Modify `backend/tests/test_task_label_task_api.py`: archived attach preservation/rejection tests.
- Modify `frontend/src/lib/types.ts`: label capability fields, palette type, create/update request types.
- Modify `frontend/src/lib/api.ts`: include archived list params and label update/archive/restore methods.
- Create `frontend/src/components/tasks/taskLabelUtils.ts`: shared palette metadata and pure helper functions for label classes and capability display.
- Create `frontend/src/components/tasks/taskLabelUtils.test.ts`: Node tests for palette keys, classes, and action capability helpers.
- Modify `frontend/src/components/tasks/TaskLabelChips.tsx`: use shared label color helpers and add `rose`.
- Modify `frontend/src/components/tasks/TaskLabelPicker.tsx`: creation color swatches, row swatches, edit/archive actions, moderator manage link.
- Create `frontend/src/components/tasks/TaskLabelEditDialog.tsx`: reusable name/color editor for picker and Settings.
- Create `frontend/src/components/settings/TaskLabelsSection.tsx`: moderator label catalog management.
- Modify `frontend/src/app/settings/page.tsx`: add `task-labels` moderator tab.
- Modify `frontend/package.json`: include `taskLabelUtils.test.ts` in `npm test`.
- Modify `docs/STATUS.md`: record the new feature phase and latest planning state.
- Modify `docs/TEST_PLAN.md`: add automated and manual checks for label management.

## Task 1: Backend Schemas and Label Palette

**Files:**

- Modify: `backend/app/db/schemas.py`
- Modify: `backend/app/db/repositories.py`
- Modify: `backend/tests/test_task_label_repository.py`
- Modify: `backend/tests/test_task_label_api.py`

- [ ] **Step 1: Write failing repository palette tests**

Append these tests to `backend/tests/test_task_label_repository.py`:

```python
    def test_palette_contains_management_colors(self) -> None:
        self.assertEqual(
            LABEL_COLOR_PALETTE,
            ("teal", "blue", "purple", "gold", "green", "coral", "rose", "slate"),
        )

    def test_validate_label_color_accepts_palette_value(self) -> None:
        from app.db.repositories import validate_task_label_color

        self.assertEqual(validate_task_label_color("rose"), "rose")

    def test_validate_label_color_rejects_unknown_value(self) -> None:
        from app.db.repositories import validate_task_label_color

        with self.assertRaises(ValueError) as ctx:
            validate_task_label_color("neon")

        self.assertEqual(str(ctx.exception), "Unknown task label color")
```

- [ ] **Step 2: Write failing API schema response tests**

Add this test to `TaskLabelApiTests` in `backend/tests/test_task_label_api.py`:

```python
    async def test_label_response_includes_capabilities(self) -> None:
        label = make_label()
        member = SimpleNamespace(id=label.created_by_id, role="member", is_active=True)
        session = SimpleNamespace()

        with patch.object(
            labels_api.label_repo,
            "is_shared_for_member",
            AsyncMock(return_value=False),
        ):
            response = await labels_api._label_response(
                session,
                label,
                usage_count=2,
                member=member,
            )

        self.assertTrue(response.can_edit)
        self.assertTrue(response.can_archive)
        self.assertFalse(response.can_restore)
        self.assertFalse(response.is_shared_for_current_user)
```

- [ ] **Step 3: Run failing tests**

Run:

```bash
cd backend && pytest tests/test_task_label_repository.py::TaskLabelNormalizationTests::test_palette_contains_management_colors tests/test_task_label_repository.py::TaskLabelNormalizationTests::test_validate_label_color_accepts_palette_value tests/test_task_label_repository.py::TaskLabelNormalizationTests::test_validate_label_color_rejects_unknown_value tests/test_task_label_api.py::TaskLabelApiTests::test_label_response_includes_capabilities -q
```

Expected: failures because the palette order, `validate_task_label_color`, async `_label_response`, and capability schema fields are not implemented yet.

- [ ] **Step 4: Implement palette validation**

In `backend/app/db/repositories.py`, replace the current `LABEL_COLOR_PALETTE` tuple and add validation:

```python
LABEL_COLOR_PALETTE = (
    "teal",
    "blue",
    "purple",
    "gold",
    "green",
    "coral",
    "rose",
    "slate",
)


def validate_task_label_color(color: str | None) -> str:
    normalized = (color or "").strip().lower()
    if normalized not in LABEL_COLOR_PALETTE:
        raise ValueError("Unknown task label color")
    return normalized
```

Keep `pick_task_label_color(slug)` unchanged except that it now uses the new tuple.

- [ ] **Step 5: Implement schema fields**

In `backend/app/db/schemas.py`, update the label schemas:

```python
class TaskLabelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str | None = None


class TaskLabelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = None


class TaskLabelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    color: str
    created_by_id: uuid.UUID | None
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    usage_count: int = 0
    can_edit: bool = False
    can_archive: bool = False
    can_restore: bool = False
    is_shared_for_current_user: bool = False
```

- [ ] **Step 6: Implement async response capability helper**

In `backend/app/api/task_labels.py`, import `PermissionService` and change `_label_response` to this async helper:

```python
from app.services.permission_service import PermissionService


async def _label_response(
    session: AsyncSession,
    label,
    usage_count: int = 0,
    member: TeamMember | None = None,
) -> TaskLabelResponse:
    is_moderator = bool(member and PermissionService.is_moderator(member))
    is_owner = bool(member and label.created_by_id == member.id)
    is_shared = False
    if member and not is_moderator and is_owner:
        is_shared = await label_repo.is_shared_for_member(session, label.id, member.id)

    is_active = not label.is_archived
    can_member_manage = is_active and is_owner and not is_shared

    return TaskLabelResponse.model_validate(label).model_copy(
        update={
            "usage_count": usage_count,
            "can_edit": is_moderator or can_member_manage,
            "can_archive": is_moderator or can_member_manage,
            "can_restore": is_moderator and label.is_archived,
            "is_shared_for_current_user": is_shared,
        }
    )
```

Task 3 updates every API call site to `await _label_response(...)`.

- [ ] **Step 7: Add temporary repository helper stub for test shape**

In `TaskLabelRepository`, add this method so Task 1 tests can pass before the real SQL behavior is added in Task 2:

```python
    async def is_shared_for_member(
        self,
        session: AsyncSession,
        label_id: uuid.UUID,
        member_id: uuid.UUID,
    ) -> bool:
        return False
```

Task 2 replaces this stub with the real query.

- [ ] **Step 8: Run tests for Task 1**

Run:

```bash
cd backend && pytest tests/test_task_label_repository.py tests/test_task_label_api.py -q
```

Expected: existing API tests may fail because `_label_response` call sites are still synchronous. Fix only direct call-site errors by awaiting `_label_response(session, label, usage_count, member)` where needed, then rerun until these two files pass.

- [ ] **Step 9: Commit Task 1**

Run:

```bash
git add backend/app/db/repositories.py backend/app/db/schemas.py backend/app/api/task_labels.py backend/tests/test_task_label_repository.py backend/tests/test_task_label_api.py
git commit -m "feat: add task label palette capabilities"
```

## Task 2: Backend Repository Management Behavior

**Files:**

- Modify: `backend/app/db/repositories.py`
- Modify: `backend/tests/test_task_label_repository.py`
- Modify: `backend/tests/test_task_label_task_api.py`

- [ ] **Step 1: Replace old reactivation test with archived conflict test**

In `backend/tests/test_task_label_repository.py`, replace `test_create_or_reactivate_unarchives_existing_label` with:

```python
    async def test_create_or_reactivate_rejects_archived_existing_label(self) -> None:
        archived = SimpleNamespace(
            id=uuid.uuid4(),
            name="Conference",
            slug="conference",
            color="teal",
            is_archived=True,
        )
        session = MagicMock()
        session.flush = AsyncMock()
        repo = TaskLabelRepository()
        repo.get_by_slug = AsyncMock(return_value=archived)

        with self.assertRaises(ValueError) as ctx:
            await repo.create_or_reactivate(
                session,
                name="Conference",
                created_by_id=uuid.uuid4(),
                color="teal",
            )

        self.assertEqual(str(ctx.exception), "Archived task label already exists")
        session.flush.assert_not_called()
```

- [ ] **Step 2: Update active creation tests for color argument**

In the remaining `create_or_reactivate` tests, add `color="teal"` to calls where a color should be explicit. Keep one test without color to verify fallback:

```python
        result = await repo.create_or_reactivate(
            session,
            name=" conference ",
            created_by_id=uuid.uuid4(),
            color="teal",
        )
```

- [ ] **Step 3: Add update/archive/restore tests**

Append these tests to `TaskLabelRepositoryTests`:

```python
    async def test_update_label_changes_name_slug_and_color(self) -> None:
        label_id = uuid.uuid4()
        label = SimpleNamespace(
            id=label_id,
            name="Conference",
            slug="conference",
            color="teal",
            is_archived=False,
        )
        session = MagicMock()
        session.flush = AsyncMock()
        repo = TaskLabelRepository()
        repo.get_by_id = AsyncMock(return_value=label)
        repo.get_by_slug = AsyncMock(return_value=None)

        result = await repo.update(session, label_id, name=" Partner  Event ", color="rose")

        self.assertIs(result, label)
        self.assertEqual(label.name, "Partner Event")
        self.assertEqual(label.slug, "partner event")
        self.assertEqual(label.color, "rose")
        session.flush.assert_awaited_once()

    async def test_update_label_rejects_duplicate_slug(self) -> None:
        label_id = uuid.uuid4()
        other_id = uuid.uuid4()
        label = SimpleNamespace(
            id=label_id,
            name="Conference",
            slug="conference",
            color="teal",
            is_archived=False,
        )
        duplicate = SimpleNamespace(id=other_id, slug="partners", is_archived=False)
        session = MagicMock()
        session.flush = AsyncMock()
        repo = TaskLabelRepository()
        repo.get_by_id = AsyncMock(return_value=label)
        repo.get_by_slug = AsyncMock(return_value=duplicate)

        with self.assertRaises(ValueError) as ctx:
            await repo.update(session, label_id, name="Partners")

        self.assertEqual(str(ctx.exception), "Task label name already exists")

    async def test_archive_sets_is_archived(self) -> None:
        label = SimpleNamespace(id=uuid.uuid4(), is_archived=False)
        session = MagicMock()
        session.flush = AsyncMock()
        repo = TaskLabelRepository()
        repo.get_by_id = AsyncMock(return_value=label)

        result = await repo.archive(session, label.id)

        self.assertIs(result, label)
        self.assertTrue(label.is_archived)
        session.flush.assert_awaited_once()

    async def test_restore_clears_is_archived(self) -> None:
        label = SimpleNamespace(id=uuid.uuid4(), is_archived=True)
        session = MagicMock()
        session.flush = AsyncMock()
        repo = TaskLabelRepository()
        repo.get_by_id = AsyncMock(return_value=label)

        result = await repo.restore(session, label.id)

        self.assertIs(result, label)
        self.assertFalse(label.is_archived)
        session.flush.assert_awaited_once()
```

- [ ] **Step 4: Add shared-label SQL tests**

Append these tests to `TaskLabelRepositoryTests`:

```python
    async def test_is_shared_for_member_checks_author_and_assignee(self) -> None:
        session = MagicMock()
        session.execute = AsyncMock(return_value=SimpleNamespace(scalar_one=lambda: 1))
        repo = TaskLabelRepository()

        result = await repo.is_shared_for_member(
            session,
            label_id=uuid.uuid4(),
            member_id=uuid.uuid4(),
        )

        self.assertTrue(result)
        stmt = session.execute.await_args.args[0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": False}))
        self.assertIn("created_by_id", compiled)
        self.assertIn("assignee_id", compiled)
        self.assertIn("IS NULL", compiled)
```

- [ ] **Step 5: Add archived attach guard tests**

Append these tests to `backend/tests/test_task_label_task_api.py`:

```python
    async def test_replace_task_labels_rejects_new_archived_label(self) -> None:
        active = SimpleNamespace(id=uuid.uuid4(), is_archived=False)
        archived = SimpleNamespace(id=uuid.uuid4(), is_archived=True)
        task = SimpleNamespace(labels=[active])
        session = SimpleNamespace()
        repo = tasks_api.TaskLabelRepository()
        repo.get_by_ids = AsyncMock(return_value=[archived])

        with self.assertRaises(ValueError) as ctx:
            await repo.replace_task_labels(session, task, [archived.id])

        self.assertEqual(str(ctx.exception), "Архивные метки нельзя добавить к задаче")

    async def test_replace_task_labels_preserves_existing_archived_label(self) -> None:
        archived = SimpleNamespace(id=uuid.uuid4(), is_archived=True)
        task = SimpleNamespace(labels=[archived])
        session = SimpleNamespace()
        repo = tasks_api.TaskLabelRepository()
        repo.get_by_ids = AsyncMock(return_value=[archived])

        result = await repo.replace_task_labels(session, task, [archived.id])

        self.assertIs(result, task)
        self.assertEqual(task.labels, [archived])
```

- [ ] **Step 6: Run failing tests**

Run:

```bash
cd backend && pytest tests/test_task_label_repository.py tests/test_task_label_task_api.py -q
```

Expected: failures for missing repository methods, old `create_or_reactivate` signature, and archived attach behavior.

- [ ] **Step 7: Implement repository methods**

In `TaskLabelRepository`, implement these methods and update `create_or_reactivate`:

```python
    async def get_by_id(self, session: AsyncSession, label_id: uuid.UUID) -> TaskLabel | None:
        return await session.get(TaskLabel, label_id)

    async def create_or_reactivate(
        self,
        session: AsyncSession,
        *,
        name: str,
        created_by_id: uuid.UUID | None,
        color: str | None = None,
    ) -> TaskLabel:
        normalized = normalize_task_label_name(name)
        slug = slugify_task_label(normalized)
        existing = await self.get_by_slug(session, slug)
        if existing:
            if existing.is_archived:
                raise ValueError("Archived task label already exists")
            return existing
        label = TaskLabel(
            name=normalized,
            slug=slug,
            color=validate_task_label_color(color) if color else pick_task_label_color(slug),
            created_by_id=created_by_id,
        )
        session.add(label)
        try:
            await session.flush()
        except IntegrityError:
            await session.rollback()
            existing = await self.get_by_slug(session, slug)
            if existing:
                if existing.is_archived:
                    raise ValueError("Archived task label already exists")
                return existing
            raise
        return label

    async def update(
        self,
        session: AsyncSession,
        label_id: uuid.UUID,
        *,
        name: str | None = None,
        color: str | None = None,
    ) -> TaskLabel | None:
        label = await self.get_by_id(session, label_id)
        if not label:
            return None
        if name is not None:
            normalized = normalize_task_label_name(name)
            slug = slugify_task_label(normalized)
            existing = await self.get_by_slug(session, slug)
            if existing and existing.id != label.id:
                raise ValueError("Task label name already exists")
            label.name = normalized
            label.slug = slug
        if color is not None:
            label.color = validate_task_label_color(color)
        await session.flush()
        return label

    async def archive(self, session: AsyncSession, label_id: uuid.UUID) -> TaskLabel | None:
        label = await self.get_by_id(session, label_id)
        if not label:
            return None
        label.is_archived = True
        await session.flush()
        return label

    async def restore(self, session: AsyncSession, label_id: uuid.UUID) -> TaskLabel | None:
        label = await self.get_by_id(session, label_id)
        if not label:
            return None
        label.is_archived = False
        await session.flush()
        return label

    async def is_shared_for_member(
        self,
        session: AsyncSession,
        label_id: uuid.UUID,
        member_id: uuid.UUID,
    ) -> bool:
        stmt = (
            select(func.count(Task.id))
            .join(TaskLabelLink, TaskLabelLink.task_id == Task.id)
            .where(
                TaskLabelLink.label_id == label_id,
                or_(
                    Task.created_by_id.is_(None),
                    Task.created_by_id != member_id,
                    Task.assignee_id.is_(None),
                    Task.assignee_id != member_id,
                ),
            )
        )
        result = await session.execute(stmt)
        return int(result.scalar_one() or 0) > 0
```

- [ ] **Step 8: Implement archived attach guard**

In `replace_task_labels`, after missing-id validation and before assigning `task.labels`, add:

```python
        existing_label_ids = {label.id for label in getattr(task, "labels", [])}
        newly_added_archived = [
            label for label in labels
            if label.is_archived and label.id not in existing_label_ids
        ]
        if newly_added_archived:
            raise ValueError("Архивные метки нельзя добавить к задаче")
```

- [ ] **Step 9: Run Task 2 tests**

Run:

```bash
cd backend && pytest tests/test_task_label_repository.py tests/test_task_label_task_api.py -q
```

Expected: pass.

- [ ] **Step 10: Commit Task 2**

Run:

```bash
git add backend/app/db/repositories.py backend/tests/test_task_label_repository.py backend/tests/test_task_label_task_api.py
git commit -m "feat: add task label management repository"
```

## Task 3: Backend Label API Permissions and Endpoints

**Files:**

- Modify: `backend/app/api/task_labels.py`
- Modify: `backend/tests/test_task_label_api.py`

- [ ] **Step 1: Add API tests for archived listing permission**

Append to `TaskLabelApiTests`:

```python
    async def test_member_cannot_include_archived_labels(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="member", is_active=True)
        session = SimpleNamespace()

        with self.assertRaises(labels_api.HTTPException) as ctx:
            await labels_api.list_task_labels(
                search=None,
                limit=20,
                include_archived=True,
                member=member,
                session=session,
            )

        self.assertEqual(ctx.exception.status_code, 403)
```

- [ ] **Step 2: Add create color and archived conflict tests**

Append:

```python
    async def test_create_task_label_passes_color(self) -> None:
        label = make_label("Partners", usage_count=0)
        member = SimpleNamespace(id=uuid.uuid4(), role="member", is_active=True)
        session = SimpleNamespace(commit=AsyncMock())

        with patch.object(
            labels_api.label_repo,
            "create_or_reactivate",
            AsyncMock(return_value=label),
        ) as create_mock, patch.object(
            labels_api.label_repo,
            "is_shared_for_member",
            AsyncMock(return_value=False),
        ):
            response = await labels_api.create_task_label(
                data=labels_api.TaskLabelCreate(name=" Partners ", color="rose"),
                member=member,
                session=session,
            )

        self.assertEqual(response.name, "Partners")
        create_mock.assert_awaited_once_with(
            session,
            name=" Partners ",
            created_by_id=member.id,
            color="rose",
        )
        session.commit.assert_awaited_once()

    async def test_create_task_label_archived_conflict_returns_409(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="member", is_active=True)
        session = SimpleNamespace(commit=AsyncMock())

        with patch.object(
            labels_api.label_repo,
            "create_or_reactivate",
            AsyncMock(side_effect=ValueError("Archived task label already exists")),
        ):
            with self.assertRaises(labels_api.HTTPException) as ctx:
                await labels_api.create_task_label(
                    data=labels_api.TaskLabelCreate(name="Conference", color="teal"),
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 409)
        session.commit.assert_not_awaited()
```

- [ ] **Step 3: Add update/archive/restore permission tests**

Append:

```python
    async def test_member_updates_owned_non_shared_label(self) -> None:
        member_id = uuid.uuid4()
        label = make_label("Conference")
        label.created_by_id = member_id
        member = SimpleNamespace(id=member_id, role="member", is_active=True)
        session = SimpleNamespace(commit=AsyncMock())

        with patch.object(labels_api.label_repo, "get_by_id", AsyncMock(return_value=label)), \
            patch.object(labels_api.label_repo, "is_shared_for_member", AsyncMock(return_value=False)), \
            patch.object(labels_api.label_repo, "update", AsyncMock(return_value=label)) as update_mock:
            response = await labels_api.update_task_label(
                label_id=label.id,
                data=labels_api.TaskLabelUpdate(name="Conference 2026", color="purple"),
                member=member,
                session=session,
            )

        self.assertTrue(response.can_edit)
        update_mock.assert_awaited_once_with(
            session,
            label.id,
            name="Conference 2026",
            color="purple",
        )
        session.commit.assert_awaited_once()

    async def test_member_cannot_update_shared_label(self) -> None:
        member_id = uuid.uuid4()
        label = make_label("Conference")
        label.created_by_id = member_id
        member = SimpleNamespace(id=member_id, role="member", is_active=True)
        session = SimpleNamespace()

        with patch.object(labels_api.label_repo, "get_by_id", AsyncMock(return_value=label)), \
            patch.object(labels_api.label_repo, "is_shared_for_member", AsyncMock(return_value=True)):
            with self.assertRaises(labels_api.HTTPException) as ctx:
                await labels_api.update_task_label(
                    label_id=label.id,
                    data=labels_api.TaskLabelUpdate(name="Conference 2026"),
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 403)

    async def test_moderator_restores_archived_label(self) -> None:
        label = make_label("Conference")
        label.is_archived = True
        member = SimpleNamespace(id=uuid.uuid4(), role="moderator", is_active=True)
        session = SimpleNamespace(commit=AsyncMock())

        with patch.object(labels_api.label_repo, "restore", AsyncMock(return_value=label)) as restore_mock:
            response = await labels_api.restore_task_label(
                label_id=label.id,
                member=member,
                session=session,
            )

        self.assertTrue(response.can_edit)
        restore_mock.assert_awaited_once_with(session, label.id)
        session.commit.assert_awaited_once()
```

- [ ] **Step 4: Run failing API tests**

Run:

```bash
cd backend && pytest tests/test_task_label_api.py -q
```

Expected: failures for missing endpoint functions and old create behavior.

- [ ] **Step 5: Implement permission helper**

In `backend/app/api/task_labels.py`, add:

```python
async def _ensure_can_manage_label(
    session: AsyncSession,
    label,
    member: TeamMember,
    *,
    restore: bool = False,
) -> None:
    if PermissionService.is_moderator(member):
        return
    if restore:
        raise HTTPException(status_code=403, detail="Доступ только для модераторов")
    if label.is_archived:
        raise HTTPException(status_code=403, detail="Архивную метку может восстановить модератор")
    if label.created_by_id != member.id:
        raise HTTPException(status_code=403, detail="Можно менять только свои метки")
    if await label_repo.is_shared_for_member(session, label.id, member.id):
        raise HTTPException(
            status_code=403,
            detail="Эта метка уже используется в чужих задачах. Изменить её может только модератор",
        )
```

- [ ] **Step 6: Update list/create and add endpoints**

In `backend/app/api/task_labels.py`, update imports to include `uuid` and `TaskLabelUpdate`. Then implement these endpoint bodies:

```python
@router.get("", response_model=list[TaskLabelResponse])
async def list_task_labels(
    search: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    include_archived: bool = Query(False),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    normalized_search = search.strip() if search is not None else None
    if normalized_search == "":
        normalized_search = None
    if include_archived and not PermissionService.is_moderator(member):
        raise HTTPException(status_code=403, detail="Архивные метки доступны только модераторам")
    visible_department_ids = await resolve_visible_department_ids(session, member)
    labels = await label_repo.search(
        session,
        search=normalized_search,
        include_archived=include_archived,
        limit=limit,
        visible_department_ids=visible_department_ids,
        fallback_member_id=member.id,
    )
    return [
        await _label_response(session, label, usage_count, member)
        for label, usage_count in labels
    ]
```

```python
@router.post("", response_model=TaskLabelResponse, status_code=201)
async def create_task_label(
    data: TaskLabelCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    try:
        label = await label_repo.create_or_reactivate(
            session,
            name=data.name,
            created_by_id=member.id,
            color=data.color,
        )
        await session.commit()
        return await _label_response(session, label, 0, member)
    except ValueError as exc:
        message = str(exc)
        if message == "Archived task label already exists":
            raise HTTPException(
                status_code=409,
                detail="Метка с таким названием находится в архиве. Модератор может восстановить её.",
            )
        if message == "Unknown task label color":
            raise HTTPException(status_code=400, detail="Выберите один из доступных цветов метки")
        raise HTTPException(status_code=400, detail=message)
```

```python
@router.patch("/{label_id}", response_model=TaskLabelResponse)
async def update_task_label(
    label_id: uuid.UUID,
    data: TaskLabelUpdate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    label = await label_repo.get_by_id(session, label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Метка не найдена")
    await _ensure_can_manage_label(session, label, member)
    try:
        updated = await label_repo.update(
            session,
            label_id,
            name=data.name,
            color=data.color,
        )
    except ValueError as exc:
        message = str(exc)
        if message == "Task label name already exists":
            raise HTTPException(status_code=409, detail="Метка с таким названием уже существует")
        if message == "Unknown task label color":
            raise HTTPException(status_code=400, detail="Выберите один из доступных цветов метки")
        raise HTTPException(status_code=400, detail=message)
    await session.commit()
    return await _label_response(session, updated, member=member)
```

```python
@router.delete("/{label_id}", response_model=TaskLabelResponse)
async def archive_task_label(
    label_id: uuid.UUID,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    label = await label_repo.get_by_id(session, label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Метка не найдена")
    await _ensure_can_manage_label(session, label, member)
    archived = await label_repo.archive(session, label_id)
    await session.commit()
    return await _label_response(session, archived, member=member)
```

```python
@router.post("/{label_id}/restore", response_model=TaskLabelResponse)
async def restore_task_label(
    label_id: uuid.UUID,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not PermissionService.is_moderator(member):
        raise HTTPException(status_code=403, detail="Доступ только для модераторов")
    restored = await label_repo.restore(session, label_id)
    if not restored:
        raise HTTPException(status_code=404, detail="Метка не найдена")
    await session.commit()
    return await _label_response(session, restored, member=member)
```

- [ ] **Step 7: Run backend label API tests**

Run:

```bash
cd backend && pytest tests/test_task_label_api.py tests/test_task_label_repository.py tests/test_task_label_task_api.py -q
```

Expected: pass.

- [ ] **Step 8: Run broader backend permission tests**

Run:

```bash
cd backend && pytest tests/test_task_permission_service.py tests/test_task_update_permissions.py -q
```

Expected: pass, confirming task edit permissions were not widened.

- [ ] **Step 9: Commit Task 3**

Run:

```bash
git add backend/app/api/task_labels.py backend/tests/test_task_label_api.py
git commit -m "feat: expose task label management api"
```

## Task 4: Frontend Types, API Client, and Shared Label Utilities

**Files:**

- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/components/tasks/taskLabelUtils.ts`
- Create: `frontend/src/components/tasks/taskLabelUtils.test.ts`
- Modify: `frontend/src/components/tasks/TaskLabelChips.tsx`
- Modify: `frontend/package.json`

- [ ] **Step 1: Write frontend utility tests**

Create `frontend/src/components/tasks/taskLabelUtils.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  TASK_LABEL_COLOR_OPTIONS,
  canArchiveTaskLabel,
  canEditTaskLabel,
  labelClass,
  labelSwatchClass,
} from "./taskLabelUtils.ts";
import type { TaskLabel } from "../../lib/types.ts";

function label(overrides: Partial<TaskLabel> = {}): TaskLabel {
  const base: TaskLabel = {
    id: "label-1",
    name: "Conference",
    slug: "conference",
    color: "teal",
    created_by_id: "member-1",
    is_archived: false,
    created_at: "2026-05-06T00:00:00Z",
    updated_at: "2026-05-06T00:00:00Z",
    usage_count: 0,
    can_edit: false,
    can_archive: false,
    can_restore: false,
    is_shared_for_current_user: false,
  };
  return Object.assign(base, overrides);
}

test("TASK_LABEL_COLOR_OPTIONS exposes the fixed backend palette", () => {
  assert.deepEqual(
    TASK_LABEL_COLOR_OPTIONS.map((option) => option.value),
    ["teal", "blue", "purple", "gold", "green", "coral", "rose", "slate"]
  );
});

test("labelClass falls back to slate for unknown legacy colors", () => {
  assert.equal(labelClass("unknown"), labelClass("slate"));
});

test("labelSwatchClass supports rose", () => {
  assert.match(labelSwatchClass("rose"), /rose/);
});

test("capability helpers read backend capability flags", () => {
  assert.equal(canEditTaskLabel(label({ can_edit: true })), true);
  assert.equal(canArchiveTaskLabel(label({ can_archive: true })), true);
  assert.equal(canEditTaskLabel(label({ can_edit: false })), false);
  assert.equal(canArchiveTaskLabel(label({ can_archive: false })), false);
});
```

- [ ] **Step 2: Add the utility test to npm test**

In `frontend/package.json`, update the `test` script:

```json
"test": "node --test --experimental-strip-types src/lib/dateUtils.test.ts src/lib/compactHeaderControls.test.ts src/components/tasks/taskFilterUtils.test.ts src/components/tasks/taskLabelUtils.test.ts"
```

- [ ] **Step 3: Run failing frontend test**

Run:

```bash
cd frontend && npm test
```

Expected: failure because `taskLabelUtils.ts` does not exist yet.

- [ ] **Step 4: Extend frontend types**

In `frontend/src/lib/types.ts`, add the palette type near task types:

```ts
export type TaskLabelColor =
  | "teal"
  | "blue"
  | "purple"
  | "gold"
  | "green"
  | "coral"
  | "rose"
  | "slate";
```

Update `TaskLabel`:

```ts
  color: TaskLabelColor | string;
  can_edit: boolean;
  can_archive: boolean;
  can_restore: boolean;
  is_shared_for_current_user: boolean;
```

Update request types:

```ts
export interface TaskLabelCreateRequest {
  name: string;
  color?: TaskLabelColor;
}

export interface TaskLabelUpdateRequest {
  name?: string;
  color?: TaskLabelColor;
}
```

- [ ] **Step 5: Extend frontend API client**

In `frontend/src/lib/api.ts`, update and add methods:

```ts
  async getTaskLabels(params?: {
    search?: string;
    limit?: number;
    include_archived?: boolean;
  }): Promise<TaskLabel[]> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.include_archived) searchParams.set("include_archived", "true");
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return this.request<TaskLabel[]>(`/api/task-labels${query}`);
  }

  async updateTaskLabel(
    labelId: string,
    data: TaskLabelUpdateRequest
  ): Promise<TaskLabel> {
    return this.request<TaskLabel>(`/api/task-labels/${labelId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async archiveTaskLabel(labelId: string): Promise<TaskLabel> {
    return this.request<TaskLabel>(`/api/task-labels/${labelId}`, {
      method: "DELETE",
    });
  }

  async restoreTaskLabel(labelId: string): Promise<TaskLabel> {
    return this.request<TaskLabel>(`/api/task-labels/${labelId}/restore`, {
      method: "POST",
    });
  }
```

Ensure `TaskLabelUpdateRequest` is imported from `types.ts`.

- [ ] **Step 6: Implement shared task label utilities**

Create `frontend/src/components/tasks/taskLabelUtils.ts`:

```ts
import type { TaskLabel, TaskLabelColor } from "@/lib/types";

export const TASK_LABEL_COLOR_OPTIONS: Array<{
  value: TaskLabelColor;
  label: string;
}> = [
  { value: "teal", label: "Teal" },
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "gold", label: "Gold" },
  { value: "green", label: "Green" },
  { value: "coral", label: "Coral" },
  { value: "rose", label: "Rose" },
  { value: "slate", label: "Slate" },
];

const LABEL_CLASSES: Record<string, string> = {
  teal: "bg-primary/10 text-primary border-primary/20",
  blue: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300",
  purple: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-300",
  gold: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
  green: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  coral: "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-300",
  rose: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300",
  slate: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300",
};

const SWATCH_CLASSES: Record<string, string> = {
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  gold: "bg-amber-500",
  green: "bg-emerald-500",
  coral: "bg-orange-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

export function labelClass(color: string) {
  return LABEL_CLASSES[color] || LABEL_CLASSES.slate;
}

export function labelSwatchClass(color: string) {
  return SWATCH_CLASSES[color] || SWATCH_CLASSES.slate;
}

export function canEditTaskLabel(label: TaskLabel) {
  return label.can_edit;
}

export function canArchiveTaskLabel(label: TaskLabel) {
  return label.can_archive;
}
```

- [ ] **Step 7: Update TaskLabelChips**

In `frontend/src/components/tasks/TaskLabelChips.tsx`, remove the local `LABEL_CLASSES` and `labelClass` definitions and import:

```ts
import { labelClass } from "./taskLabelUtils";
```

Keep the component markup unchanged except for using the imported helper.

- [ ] **Step 8: Run Task 4 tests**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
```

Expected: both pass.

- [ ] **Step 9: Commit Task 4**

Run:

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/components/tasks/taskLabelUtils.ts frontend/src/components/tasks/taskLabelUtils.test.ts frontend/src/components/tasks/TaskLabelChips.tsx frontend/package.json
git commit -m "feat: add task label frontend helpers"
```

## Task 5: Label Picker Color Creation and Member Actions

**Files:**

- Create: `frontend/src/components/tasks/TaskLabelEditDialog.tsx`
- Modify: `frontend/src/components/tasks/TaskLabelPicker.tsx`

- [ ] **Step 1: Create the edit dialog component**

Create `frontend/src/components/tasks/TaskLabelEditDialog.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TaskLabel, TaskLabelColor } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  TASK_LABEL_COLOR_OPTIONS,
  labelSwatchClass,
} from "./taskLabelUtils";

export function TaskLabelEditDialog({
  label,
  open,
  saving,
  onOpenChange,
  onSave,
}: {
  label: TaskLabel | null;
  open: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; color: TaskLabelColor }) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<TaskLabelColor>("teal");

  useEffect(() => {
    if (!label || !open) return;
    setName(label.name);
    setColor(
      TASK_LABEL_COLOR_OPTIONS.some((option) => option.value === label.color)
        ? (label.color as TaskLabelColor)
        : "slate"
    );
  }, [label, open]);

  const normalizedName = name.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Редактировать метку</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-label-name">Название</Label>
            <Input
              id="task-label-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label>Цвет</Label>
            <div className="grid grid-cols-4 gap-2">
              {TASK_LABEL_COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={saving}
                  onClick={() => setColor(option.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium",
                    color === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 hover:bg-muted"
                  )}
                >
                  <span
                    className={cn("h-3 w-3 rounded-full", labelSwatchClass(option.value))}
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Отмена
          </Button>
          <Button
            type="button"
            disabled={saving || !normalizedName}
            onClick={() => onSave({ name: normalizedName, color })}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add picker state and imports**

In `TaskLabelPicker.tsx`, add imports:

```tsx
import Link from "next/link";
import { Archive, Pencil, Settings } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PermissionService } from "@/lib/permissions";
import type { TaskLabelColor } from "@/lib/types";
import { TaskLabelEditDialog } from "./TaskLabelEditDialog";
import {
  TASK_LABEL_COLOR_OPTIONS,
  canArchiveTaskLabel,
  canEditTaskLabel,
  labelSwatchClass,
} from "./taskLabelUtils";
```

Keep the existing lucide import list deduplicated: include `Archive`, `Check`, `ChevronDown`, `Loader2`, `Pencil`, `Plus`, `Search`, `Settings`, and `X`.

Inside the component state, add:

```tsx
  const { user } = useCurrentUser();
  const { toastError, toastSuccess } = useToast();
  const isModerator = user ? PermissionService.isModerator(user) : false;
  const [createColor, setCreateColor] = useState<TaskLabelColor>("teal");
  const [editingLabel, setEditingLabel] = useState<TaskLabel | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [archiveLabel, setArchiveLabel] = useState<TaskLabel | null>(null);
  const [archiving, setArchiving] = useState(false);
```

- [ ] **Step 3: Add reload helper and create color payload**

Inside `TaskLabelPicker`, extract loading into:

```tsx
  async function loadLabels() {
    setLoadError(false);
    setLoading(true);
    try {
      const labels = await api.getTaskLabels({
        search: normalizedSearch || undefined,
        limit: 20,
      });
      setOptions(labels);
    } catch {
      setOptions([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }
```

Update the `useEffect` to call `loadLabels()` with a cancellation guard by keeping the existing pattern. The simplest safe implementation is to keep the current inline effect and add a separate `refreshLabels` function:

```tsx
  async function refreshLabels() {
    try {
      const labels = await api.getTaskLabels({
        search: normalizedSearch || undefined,
        limit: 20,
      });
      setOptions(labels);
    } catch {
      setLoadError(true);
    }
  }
```

In `createLabel`, change the API call:

```tsx
      const label = await api.createTaskLabel({
        name: labelName,
        color: createColor,
      });
```

After success, reset `createColor` to `"teal"`. In the catch block, show:

```tsx
      toastError(error instanceof Error ? error.message : "Не удалось создать метку");
```

- [ ] **Step 4: Add color swatches to create flow**

Before the create button, render the fixed palette when `canCreate`:

```tsx
          {!loading && canCreate && (
            <div className="mt-2 grid grid-cols-8 gap-1 border-t border-border/60 pt-2">
              {TASK_LABEL_COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={`Выбрать цвет ${option.label}`}
                  disabled={controlsDisabled}
                  onClick={() => setCreateColor(option.value)}
                  className={cn(
                    "flex h-7 items-center justify-center rounded-md border",
                    createColor === option.value
                      ? "border-primary bg-primary/10"
                      : "border-border/60 hover:bg-muted"
                  )}
                >
                  <span className={cn("h-3.5 w-3.5 rounded-full", labelSwatchClass(option.value))} />
                </button>
              ))}
            </div>
          )}
```

- [ ] **Step 5: Add row swatches and actions**

Replace each option row with a button plus row actions. Keep selection toggling on the main button:

```tsx
              <div
                key={label.id}
                className="flex items-center gap-1 rounded-md hover:bg-muted"
              >
                <button
                  type="button"
                  onClick={() => toggleLabel(label)}
                  disabled={controlsDisabled}
                  className="flex min-w-0 flex-1 items-center justify-between px-2 py-2 text-left text-sm disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", labelSwatchClass(label.color))} />
                    <span className="truncate">{label.name}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {label.usage_count}
                    {selectedIds.has(label.id) && <Check className="h-4 w-4 text-primary" />}
                  </span>
                </button>
                {(canEditTaskLabel(label) || canArchiveTaskLabel(label)) && (
                  <span className="flex shrink-0 items-center pr-1">
                    {canEditTaskLabel(label) && (
                      <button
                        type="button"
                        aria-label={`Редактировать метку ${label.name}`}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
                        onClick={() => setEditingLabel(label)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canArchiveTaskLabel(label) && (
                      <button
                        type="button"
                        aria-label={`Архивировать метку ${label.name}`}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-destructive"
                        onClick={() => setArchiveLabel(label)}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                )}
              </div>
```

- [ ] **Step 6: Implement edit and archive handlers**

Add handlers:

```tsx
  async function handleEditLabel(data: { name: string; color: TaskLabelColor }) {
    if (!editingLabel) return;
    setSavingEdit(true);
    try {
      const updated = await api.updateTaskLabel(editingLabel.id, data);
      setOptions((labels) => labels.map((label) => label.id === updated.id ? updated : label));
      onChange(valueRef.current.map((label) => label.id === updated.id ? updated : label));
      toastSuccess("Метка обновлена");
      setEditingLabel(null);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось обновить метку");
      await refreshLabels();
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleArchiveLabel() {
    if (!archiveLabel) return;
    setArchiving(true);
    try {
      const archived = await api.archiveTaskLabel(archiveLabel.id);
      setOptions((labels) => labels.filter((label) => label.id !== archived.id));
      onChange(valueRef.current.filter((label) => label.id !== archived.id));
      toastSuccess("Метка архивирована");
      setArchiveLabel(null);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось архивировать метку");
      await refreshLabels();
    } finally {
      setArchiving(false);
    }
  }
```

- [ ] **Step 7: Render dialogs and moderator link**

At the bottom of `PopoverContent`, before closing it, add:

```tsx
        {isModerator && (
          <div className="mt-2 border-t border-border/60 pt-2">
            <Link
              href="/settings?tab=task-labels"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
              Управлять метками
            </Link>
          </div>
        )}
```

Render siblings after `</Popover>`:

```tsx
      <TaskLabelEditDialog
        label={editingLabel}
        open={!!editingLabel}
        saving={savingEdit}
        onOpenChange={(open) => !open && setEditingLabel(null)}
        onSave={(data) => void handleEditLabel(data)}
      />
      <ConfirmDialog
        open={!!archiveLabel}
        onOpenChange={(open) => !open && setArchiveLabel(null)}
        title="Архивировать метку?"
        description="Метка останется на старых задачах, но больше не будет доступна для новых."
        confirmLabel="Архивировать"
        confirmDisabled={archiving}
        cancelDisabled={archiving}
        onConfirm={() => void handleArchiveLabel()}
      />
```

Wrap the component return in a fragment if needed.

- [ ] **Step 8: Run frontend checks**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 9: Commit Task 5**

Run:

```bash
git add frontend/src/components/tasks/TaskLabelPicker.tsx frontend/src/components/tasks/TaskLabelEditDialog.tsx
git commit -m "feat: manage owned task labels from picker"
```

## Task 6: Moderator Settings Label Management

**Files:**

- Create: `frontend/src/components/settings/TaskLabelsSection.tsx`
- Modify: `frontend/src/app/settings/page.tsx`

- [ ] **Step 1: Create TaskLabelsSection**

Create `frontend/src/components/settings/TaskLabelsSection.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Loader2, Pencil, RotateCcw, Search, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import type { TaskLabel, TaskLabelColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TaskLabelEditDialog } from "@/components/tasks/TaskLabelEditDialog";
import { TaskLabelChips } from "@/components/tasks/TaskLabelChips";
import { labelSwatchClass } from "@/components/tasks/taskLabelUtils";

type LabelStatusFilter = "active" | "archived";

export function TaskLabelsSection() {
  const { toastSuccess, toastError } = useToast();
  const { members } = useTeam();
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LabelStatusFilter>("active");
  const [editingLabel, setEditingLabel] = useState<TaskLabel | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [archiveLabel, setArchiveLabel] = useState<TaskLabel | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  const loadLabels = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTaskLabels({
        search: search.trim() || undefined,
        limit: 100,
        include_archived: true,
      });
      setLabels(data);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось загрузить метки");
    } finally {
      setLoading(false);
    }
  }, [search, toastError]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadLabels();
    }, 200);
    return () => clearTimeout(timeout);
  }, [loadLabels]);

  const visibleLabels = labels.filter((label) =>
    status === "archived" ? label.is_archived : !label.is_archived
  );

  async function handleEditLabel(data: { name: string; color: TaskLabelColor }) {
    if (!editingLabel) return;
    setSavingEdit(true);
    try {
      const updated = await api.updateTaskLabel(editingLabel.id, data);
      setLabels((items) => items.map((item) => item.id === updated.id ? updated : item));
      toastSuccess("Метка обновлена");
      setEditingLabel(null);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось обновить метку");
      await loadLabels();
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleArchiveLabel() {
    if (!archiveLabel) return;
    setArchiving(true);
    try {
      const archived = await api.archiveTaskLabel(archiveLabel.id);
      setLabels((items) => items.map((item) => item.id === archived.id ? archived : item));
      toastSuccess("Метка архивирована");
      setArchiveLabel(null);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось архивировать метку");
      await loadLabels();
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore(label: TaskLabel) {
    setRestoringId(label.id);
    try {
      const restored = await api.restoreTaskLabel(label.id);
      setLabels((items) => items.map((item) => item.id === restored.id ? restored : item));
      toastSuccess("Метка восстановлена");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось восстановить метку");
      await loadLabels();
    } finally {
      setRestoringId(null);
    }
  }

  if (loading && labels.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-3 p-6 pb-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Tags className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-heading text-base font-semibold">Метки задач</h2>
            <p className="text-xs text-muted-foreground">
              Цвета, названия и архив общих меток задач
            </p>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Найти метку"
              className="pl-9"
            />
          </div>

          <div className="flex gap-1.5">
            {(["active", "archived"] as LabelStatusFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  status === item
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item === "active" ? "Активные" : "Архив"}
              </button>
            ))}
          </div>

          {visibleLabels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
              <Tags className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {status === "active" ? "Активных меток нет" : "Архивных меток нет"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleLabels.map((label) => {
                const owner = label.created_by_id
                  ? membersById.get(label.created_by_id)
                  : null;
                return (
                  <div
                    key={label.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 p-3.5"
                  >
                    <span className={cn("h-3 w-3 shrink-0 rounded-full", labelSwatchClass(label.color))} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TaskLabelChips labels={[label]} maxVisible={1} />
                        {label.is_archived && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                            Архив
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-2xs text-muted-foreground">
                        {label.usage_count} задач · {owner?.full_name || "Без владельца"}
                      </p>
                    </div>
                    {!label.is_archived ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingLabel(label)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Редактировать</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setArchiveLabel(label)}
                        >
                          <Archive className="h-4 w-4" />
                          <span className="sr-only">Архивировать</span>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={restoringId === label.id}
                        onClick={() => void handleRestore(label)}
                      >
                        {restoringId === label.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Восстановить
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <TaskLabelEditDialog
        label={editingLabel}
        open={!!editingLabel}
        saving={savingEdit}
        onOpenChange={(open) => !open && setEditingLabel(null)}
        onSave={(data) => void handleEditLabel(data)}
      />
      <ConfirmDialog
        open={!!archiveLabel}
        onOpenChange={(open) => !open && setArchiveLabel(null)}
        title="Архивировать метку?"
        description="Метка останется на старых задачах, но больше не будет доступна для новых."
        confirmLabel="Архивировать"
        confirmDisabled={archiving}
        cancelDisabled={archiving}
        onConfirm={() => void handleArchiveLabel()}
      />
    </>
  );
}
```

- [ ] **Step 2: Add Settings tab**

In `frontend/src/app/settings/page.tsx`, import `Tags` and the section:

```tsx
import { Tags } from "lucide-react";
import { TaskLabelsSection } from "@/components/settings/TaskLabelsSection";
```

Update the tab type:

```ts
type TabId =
  | "integrations"
  | "reports"
  | "ai"
  | "notifications"
  | "reminders"
  | "task-labels";
```

Add the tab:

```ts
  { id: "task-labels", label: "Метки задач", icon: Tags, adminOnly: false },
```

Add the content case:

```tsx
    case "task-labels":
      return <TaskLabelsSection />;
```

The whole settings page is already wrapped in `ModeratorGuard`, so this tab is moderator/admin-only even though `adminOnly` is false.

- [ ] **Step 3: Run frontend checks**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
```

Expected: pass.

- [ ] **Step 4: Commit Task 6**

Run:

```bash
git add frontend/src/components/settings/TaskLabelsSection.tsx frontend/src/app/settings/page.tsx
git commit -m "feat: add moderator task label settings"
```

## Task 7: Documentation and Final Verification

**Files:**

- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`

- [ ] **Step 1: Update status**

Add this section near the top of `docs/STATUS.md`:

```markdown
## Task Label Management

- Current phase: implemented and under verification
- Spec: `docs/superpowers/specs/2026-05-06-task-label-management-design.md`
- Plan: `docs/PLAN.md`
- Scope: web portal label colors, member-owned label actions, moderator cleanup UI
- Latest verification:
  - Pending final backend and frontend validation commands.
```

After all verification commands pass, replace the pending bullet with the exact commands that passed.

- [ ] **Step 2: Update test plan**

Add this section to `docs/TEST_PLAN.md`:

```markdown
## Task Label Management

### Automated

- `cd backend && pytest tests/test_task_label_repository.py tests/test_task_label_api.py tests/test_task_label_task_api.py tests/test_task_permission_service.py tests/test_task_update_permissions.py -q`
- `cd backend && pytest -q`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`

### Manual

1. Create a label from the task label picker and choose a non-default color.
2. Confirm the label chip uses the selected color on task cards and task detail.
3. As the label creator, edit the label name and color before it is used on another person's task.
4. Attach the label to a task where the author or assignee is another user, then confirm ordinary member edit/archive actions disappear after refresh.
5. Archive an owned, non-shared label and confirm it disappears from normal picker results.
6. Confirm the archived label remains visible on a task that already had it.
7. As a moderator, open `/settings?tab=task-labels`.
8. Edit an active label from Settings.
9. Archive an active label from Settings.
10. Switch to the archive filter and restore the archived label.
11. Try creating a new label with the same name as an archived label and confirm the UI shows the archived-conflict message.
```

- [ ] **Step 3: Run backend validation**

Run:

```bash
cd backend && pytest tests/test_task_label_repository.py tests/test_task_label_api.py tests/test_task_label_task_api.py tests/test_task_permission_service.py tests/test_task_update_permissions.py -q
cd backend && pytest -q
```

Expected: both pass.

- [ ] **Step 4: Run frontend validation**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
```

Expected: all pass.

- [ ] **Step 5: Optional browser smoke**

Start the frontend dev server if it is not running:

```bash
cd frontend && npm run dev
```

Open the app and smoke these routes:

- `/tasks`: task label picker opens and renders color swatches.
- `/settings?tab=task-labels`: moderator label management tab renders.

If using the in-app browser, capture any visual regressions and fix them before final status.

- [ ] **Step 6: Update status with actual verification**

In `docs/STATUS.md`, replace the pending verification bullets with the commands that passed. If a command could not be run, record the reason.

- [ ] **Step 7: Commit docs**

Run:

```bash
git add docs/STATUS.md docs/TEST_PLAN.md
git commit -m "docs: update task label management status"
```

## Final Done Criteria

- Backend enforces fixed color palette, archived conflicts, member-owned label management, shared-label lockout, moderator restore, and archived attach guard.
- Frontend creation flow lets users choose a palette color.
- Picker row actions appear only from backend capability flags.
- Moderator Settings tab can edit/archive/restore labels.
- Archived labels remain visible on old tasks but disappear from normal picker results.
- All automated validation commands in `docs/TEST_PLAN.md` pass or have a documented blocker.
- `docs/STATUS.md` records the final verification state.
