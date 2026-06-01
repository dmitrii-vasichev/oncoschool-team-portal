# Content Factory Sprint 49 Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Prepare Content Factory for practical rollout with a production-readiness checklist, clearer first-use help, and focused first-use UI blockers fixed.

**Architecture:** Keep Sprint 49 as a readiness layer over the existing Content Factory implementation. Add one tracked rollout document, extend existing source guards, update the current help route, and improve first-use/empty-state copy on critical screens without adding new domain tables or providers.

**Tech Stack:** Next.js App Router, React, TypeScript, Node source-guard tests, FastAPI/Python focused smoke tests, Markdown repo docs.

---

## File Structure

- Create: `docs/content-factory-production-readiness.md`
  - Operator/developer rollout checklist for Content Factory.
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`
  - Source-level guard coverage for readiness doc, first-use help, and critical next-action empty states.
- Modify: `frontend/src/app/content-factory/help/page.tsx`
  - Add launch-first guide, current automation boundaries, manual confirmation boundaries, and Sprint 48 metric-collection limits.
- Modify: `frontend/src/app/content-factory/dashboard/page.tsx`
  - Add first-use onboarding state when there are no campaigns and no publications.
- Modify: `frontend/src/app/content-factory/publications/page.tsx`
  - Improve empty-state copy so the first user sees create/import next actions, while filtered empty state remains distinct.
- Modify: `frontend/src/app/content-factory/review/page.tsx`
  - Improve empty-state copy so users understand when the review queue becomes useful.
- Modify: `docs/PLAN.md`
  - Put Sprint 49 as the active top plan.
- Modify: `docs/STATUS.md`
  - Put Sprint 49 as the active top status section.
- Modify: `docs/TEST_PLAN.md`
  - Add Sprint 49 automated and manual QA plan.
- Modify: `docs/BACKLOG.md`
  - Move Sprint 49 from execution item to launch/manual-QA/post-release structure.
- Modify: `docs/content-factory-roadmap.md`
  - Mark Sprint 49 as the production readiness pass and define post-release direction.

---

### Task 1: Readiness Document And Source Guard

**Files:**
- Create: `docs/content-factory-production-readiness.md`
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [x] **Step 1: Write the failing source guard**

Add repo-level document helpers near the existing `srcDir` helper in `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`:

```ts
const repoDir = join(process.cwd(), "..");

function readRepoSource(path: string): string {
  return readFileSync(join(repoDir, path), "utf8");
}

function repoSourceExists(path: string): boolean {
  return existsSync(join(repoDir, path));
}
```

Add this test near the existing help-route tests:

```ts
test("production readiness document maps launch workflow", () => {
  assert.equal(
    repoSourceExists("docs/content-factory-production-readiness.md"),
    true,
  );

  const source = readRepoSource("docs/content-factory-production-readiness.md");

  assert.match(source, /Content Factory Production Readiness/);
  assert.match(source, /Launch Decision/);
  assert.match(source, /Campaign planning/);
  assert.match(source, /Publication readiness/);
  assert.match(source, /Publishing queue/);
  assert.match(source, /VK metric collection/);
  assert.match(
    source,
    /Telegram post analytics are not collected automatically/,
  );
  assert.match(source, /Manual QA/);
  assert.match(source, /Known limits/);
});
```

- [x] **Step 2: Run source guard to verify RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: FAIL because `docs/content-factory-production-readiness.md` does not exist yet.

- [x] **Step 3: Create the readiness document**

Create `docs/content-factory-production-readiness.md` with this content:

```md
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
```

- [x] **Step 4: Run source guard to verify GREEN**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: PASS with one additional test.

- [x] **Step 5: Commit**

```bash
git add docs/content-factory-production-readiness.md frontend/src/components/content-factory/contentFactorySourceGuards.test.ts
git commit -m "docs(cf): add production readiness checklist"
```

---

### Task 2: Help First-Use And Automation Boundaries

**Files:**
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`
- Modify: `frontend/src/app/content-factory/help/page.tsx`

- [x] **Step 1: Write the failing help guard**

Add this test after `content factory overview help explains operating model and automation boundaries`:

```ts
test("content factory help exposes launch first-use guide", () => {
  const source = readSource("app/content-factory/help/page.tsx");

  assert.match(source, /Первый запуск/);
  assert.match(source, /Готовность к запуску/);
  assert.match(source, /Что уже автоматизировано/);
  assert.match(source, /Что требует ручной проверки/);
  assert.match(source, /Telegram и VK/);
  assert.match(source, /VK-метрики/);
  assert.match(source, /Telegram.*аналитик.*не собира/i);
  assert.match(source, /\/content-factory\/publications/);
  assert.match(source, /\/content-factory\/help/);
});
```

- [x] **Step 2: Run source guard to verify RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: FAIL because the new launch-first phrases are not present.

- [x] **Step 3: Update help constants**

In `frontend/src/app/content-factory/help/page.tsx`, add `ArrowRight` to the `lucide-react` import list.

Add these constants after `CURRENT_CAPABILITIES`:

```ts
const CURRENT_AUTOMATION = [
  "Импорт публикационного плана из таблицы с предварительной проверкой строк.",
  "Матрица каналов внутри кампании: видно, какие публикации уже есть, а каких не хватает.",
  "Очередь публикации с аудитом, повторами, ручным fallback и отправкой сейчас.",
  "Telegram и VK могут отправлять текстовые публикации через настроенные интеграции.",
  "VK-метрики собираются автоматически для опубликованных VK-постов, если настроен источник и токен.",
];

const MANUAL_CONFIRMATION_BOUNDARIES = [
  "Перед запуском нужно вручную проверить доступы, токены, права каналов и реальные тестовые публикации.",
  "Факт публикации остается важным evidence: ссылка, дата выхода и внешний ID должны быть видны в карточке.",
  "Telegram-аналитика постов не собирается автоматически ботом: для нее нужен отдельный MTProto/admin-доступ.",
  "Медиа-вложения пока не отправляются автоматически: такие публикации должны уходить через ручной fallback.",
  "Ретроспектива остается ручным решением команды: система помогает собрать evidence, но не делает выводы вместо людей.",
];
```

Replace the stale `FUTURE_AUTOMATION` section rendering with two sections: current automation and manual confirmation boundaries. Keep `FUTURE_AUTOMATION` only if it is still used for post-release wording; otherwise remove it.

- [x] **Step 4: Add a first-launch help section**

Add this section immediately before the existing `Как начать без страха` section:

```tsx
<section className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4 shadow-sm sm:px-5">
  <div className="flex items-center gap-2">
    <Rocket className="h-4 w-4 text-primary" />
    <h2 className="text-sm font-semibold text-foreground">
      Первый запуск: что открыть по порядку
    </h2>
  </div>
  <p className="mt-3 text-sm leading-6 text-muted-foreground">
    Готовность к запуску проверяется не количеством заполненных полей, а тем,
    прошел ли хотя бы один понятный путь от кампании до вывода. Начните с
    небольшой реальной кампании и двигайтесь по шагам.
  </p>
  <div className="mt-4 grid gap-2 md:grid-cols-2">
    {[
      { label: "1. Кампания", href: "/content-factory/bundles" },
      { label: "2. Публикации", href: "/content-factory/publications" },
      { label: "3. Очередь проверки", href: "/content-factory/review" },
      { label: "4. Метрики и выводы", href: "/content-factory/effectiveness" },
    ].map((item) => (
      <Link
        key={item.href}
        href={item.href}
        className="flex items-center justify-between gap-3 rounded-md border border-primary/20 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
      >
        <span>{item.label}</span>
        <ArrowRight className="h-3.5 w-3.5 text-primary" />
      </Link>
    ))}
  </div>
</section>
```

Update the “already can do now” and automation area so the rendered page includes:

- `Что уже автоматизировано`
- `Что требует ручной проверки`
- `Telegram и VK`
- `VK-метрики`
- `Telegram-аналитика постов не собирается автоматически ботом`

- [x] **Step 5: Run source guard to verify GREEN**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add frontend/src/app/content-factory/help/page.tsx frontend/src/components/content-factory/contentFactorySourceGuards.test.ts
git commit -m "feat(cf): clarify production readiness help"
```

---

### Task 3: First-Use Empty States On Critical Screens

**Files:**
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`
- Modify: `frontend/src/app/content-factory/dashboard/page.tsx`
- Modify: `frontend/src/app/content-factory/publications/page.tsx`
- Modify: `frontend/src/app/content-factory/review/page.tsx`

- [x] **Step 1: Write the failing empty-state guard**

Add this test near the dashboard/publication/review route tests:

```ts
test("content factory critical pages explain first-use next actions", () => {
  const dashboardSource = readSource("app/content-factory/dashboard/page.tsx");
  const publicationsSource = readSource("app/content-factory/publications/page.tsx");
  const reviewSource = readSource("app/content-factory/review/page.tsx");

  assert.match(dashboardSource, /Создать первую кампанию/);
  assert.match(dashboardSource, /Импортировать план/);
  assert.match(dashboardSource, /Открыть справку/);
  assert.match(publicationsSource, /Создайте первую публикацию/);
  assert.match(publicationsSource, /Импортируйте строки из таблицы/);
  assert.match(reviewSource, /Когда публикации дойдут до текста/);
  assert.match(reviewSource, /Новая публикация/);
});
```

- [x] **Step 2: Run source guard to verify RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: FAIL because these first-use phrases are not present yet.

- [x] **Step 3: Add dashboard onboarding empty state**

In `frontend/src/app/content-factory/dashboard/page.tsx`, add `FileText` to the `lucide-react` import list.

After `const summary = useMemo(...)`, add:

```ts
const isFirstUseEmpty = bundles.length === 0 && publications.length === 0;
```

In the returned JSX, after the page header and before the campaign status section, add:

```tsx
{isFirstUseEmpty && (
  <section className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4 shadow-sm">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">
          Начните с одного полного цикла
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Создайте первую кампанию, добавьте публикацию или импортируйте план
          из таблицы. После публикации сюда начнут попадать ближайшие выходы,
          задержки и результаты.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild size="sm" className="h-8 gap-1.5 rounded-md px-3 text-xs">
          <Link href="/content-factory/bundles">
            <Factory className="h-3.5 w-3.5" />
            Создать первую кампанию
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 rounded-md px-3 text-xs">
          <Link href="/content-factory/publications">
            <FileText className="h-3.5 w-3.5" />
            Импортировать план
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="h-8 gap-1.5 rounded-md px-3 text-xs">
          <Link href="/content-factory/help">
            Открыть справку
          </Link>
        </Button>
      </div>
    </div>
  </section>
)}
```

- [x] **Step 4: Improve publications empty state**

In `frontend/src/app/content-factory/publications/page.tsx`, add:

```ts
const hasAnyPublications = publications.length > 0;
```

Place it near `filteredPublications`.

Replace the empty-state heading/body with conditional first-use copy:

```tsx
<h2 className="mt-3 text-sm font-semibold text-foreground">
  {hasAnyPublications
    ? "Публикаций по выбранным условиям нет"
    : "Создайте первую публикацию"}
</h2>
<p className="mt-1 text-sm text-muted-foreground">
  {hasAnyPublications
    ? "Измените поиск или фильтры, чтобы увидеть другие материалы."
    : "Добавьте публикацию вручную или импортируйте строки из таблицы, чтобы перенести текущий контент-план в систему."}
</p>
{!hasAnyPublications && (
  <p className="mt-2 text-xs text-muted-foreground">
    Импортируйте строки из таблицы, если план уже есть в Excel или Google Sheets.
  </p>
)}
```

- [x] **Step 5: Improve review queue empty state**

In `frontend/src/app/content-factory/review/page.tsx`, replace the empty-state paragraph with:

```tsx
<p className="mt-1 text-sm text-muted-foreground">
  Когда публикации дойдут до текста, дизайна, фактчека, врачебной проверки
  или одобрения, они появятся здесь с понятным следующим действием.
</p>
<Button
  asChild
  size="sm"
  variant="outline"
  className="mt-4 h-8 gap-1.5 rounded-md px-3 text-xs"
>
  <Link href="/content-factory/publications">
    <FileText className="h-3.5 w-3.5" />
    Новая публикация
  </Link>
</Button>
```

Add `FileText` to the `lucide-react` import list for this route.

- [x] **Step 6: Run source guard to verify GREEN**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add frontend/src/app/content-factory/dashboard/page.tsx frontend/src/app/content-factory/publications/page.tsx frontend/src/app/content-factory/review/page.tsx frontend/src/components/content-factory/contentFactorySourceGuards.test.ts
git commit -m "feat(cf): add first-use readiness states"
```

---

### Task 4: Durable Sprint 49 Docs

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`
- Modify: `docs/content-factory-roadmap.md`

- [x] **Step 1: Update `docs/PLAN.md`**

Add a new top section above Sprint 48:

```md
# Active Plan: Content Factory Sprint 49 Production Readiness

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-06-01-content-factory-sprint-49-production-readiness.md`. Keep `docs/STATUS.md` current after meaningful implementation or validation steps.

**Goal:** Prepare Content Factory for practical rollout with a production-readiness checklist, clearer first-use help, and focused first-use UI blockers fixed.

**Detailed design:** `docs/superpowers/specs/2026-06-01-content-factory-sprint-49-production-readiness-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-06-01-content-factory-sprint-49-production-readiness.md`

**Milestones:**

1. Add the production readiness source guard and rollout document.
2. Clarify first-use help, current automation, and manual boundaries.
3. Improve first-use empty states on critical Content Factory screens.
4. Update durable repo docs and backlog for launch readiness.
5. Run backend/frontend verification.

**Implementation status:**

- In progress on branch `codex/content-factory-sprint-49-production-readiness`.
- Sprint 1 through Sprint 48 work is merged to `main` and pushed.

**Definition of done:**

- `docs/content-factory-production-readiness.md` exists and describes launch decision criteria.
- `/content-factory/help` explains first use, current automation, manual confirmation boundaries, and Telegram analytics limitations.
- Dashboard, publications, and review queue first-use states point users to concrete next actions.
- Source guards cover readiness documentation, help, and critical next-action copy.
- Remaining launch risks and post-release work are explicit in durable docs.

**Validation commands:**

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_metric_collector_service.py tests/test_cf_metric_import_scheduler_service.py tests/test_content_factory_metric_sources_api.py tests/test_content_factory_metrics_api.py -q
git diff --check
```

**Latest verification result:**

- Pending implementation.

---
```

- [x] **Step 2: Update `docs/STATUS.md`**

Add a new top section:

```md
## Content Factory Sprint 49 Production Readiness

- Current phase: in progress on branch `codex/content-factory-sprint-49-production-readiness`
- Source: Wave E stabilization and onboarding after Sprint 48 VK metric collection.
- Design: `docs/superpowers/specs/2026-06-01-content-factory-sprint-49-production-readiness-design.md`
- Plan: `docs/superpowers/plans/2026-06-01-content-factory-sprint-49-production-readiness.md`
- Scope: production readiness document, first-use help, current automation boundaries, critical empty-state copy, source guards, durable docs, and verification
- Latest progress:
  - Created branch `codex/content-factory-sprint-49-production-readiness`.
  - Wrote Sprint 49 design and implementation plan.
- Key decisions:
  - Sprint 49 is QA-first production readiness, not a new feature subsystem.
  - Keep historical manual QA backlog visible, but do not try to retire every old manual QA item without real users and credentials.
  - Use source guards to protect the release-readiness doc, first-use help, and critical next-action copy.
- Next actions:
  - Implement the Sprint 49 plan task by task.
  - Run full frontend verification and focused backend smoke checks.
- Latest verification:
  - Pending implementation.
```

- [x] **Step 3: Update `docs/TEST_PLAN.md`**

Add a new top section:

```md
## Content Factory Sprint 49 Production Readiness

### Automated

- `cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_metric_collector_service.py tests/test_cf_metric_import_scheduler_service.py tests/test_content_factory_metric_sources_api.py tests/test_content_factory_metrics_api.py -q`
- `git diff --check`

### Manual

1. Open `/content-factory/help` and confirm the first-use path is understandable without developer explanation.
2. Open `/content-factory/dashboard` with empty data and confirm it points to first campaign, table import, and help.
3. Open `/content-factory/publications` with empty data and confirm it explains manual creation and table import.
4. Open `/content-factory/review` with no review items and confirm it explains when the queue becomes useful.
5. Use `docs/content-factory-production-readiness.md` to run one campaign-to-retrospective workflow.
6. Record any launch blockers in `docs/BACKLOG.md` before release approval.
```

- [x] **Step 4: Update `docs/BACKLOG.md`**

Replace `Execute Sprint 49: production readiness, onboarding, and authenticated end-to-end QA.` with:

```md
- Run launch decision QA from `docs/content-factory-production-readiness.md` with authenticated real or production-like data.
- Record launch blockers from Sprint 49 manual QA with owner and expected fix sprint.
```

Under `### Later`, add:

```md
- Add post-release metric providers only after Sprint 49 launch QA confirms VK metric collection is operational.
- Revisit Telegram analytics only when MTProto/admin access is explicitly available and approved.
```

- [x] **Step 5: Update `docs/content-factory-roadmap.md`**

In Sprint 49, change the section to past-tense implementation criteria:

```md
#### Sprint 49: Production Readiness Pass

- Add a tracked production-readiness checklist for rollout decisions.
- Clarify first-use help, automation boundaries, and evidence flow.
- Fix focused first-use empty states and next-action copy.
- Keep remaining release risks visible in backlog instead of conversation history.
```

- [x] **Step 6: Commit**

```bash
git add docs/PLAN.md docs/STATUS.md docs/TEST_PLAN.md docs/BACKLOG.md docs/content-factory-roadmap.md
git commit -m "docs(cf): track production readiness sprint"
```

---

### Task 5: Verification And Final Status

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`

- [x] **Step 1: Run focused frontend source guard**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: PASS.

- [x] **Step 2: Run full frontend tests**

Run:

```bash
cd frontend && npm test
```

Expected: PASS. Existing Node module-type warnings are acceptable if unchanged.

- [x] **Step 3: Run TypeScript**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS.

- [x] **Step 4: Run lint**

Run:

```bash
cd frontend && npm run lint
```

Expected: PASS with no ESLint warnings or errors.

- [x] **Step 5: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS, including `/content-factory/help`, `/content-factory/dashboard`, `/content-factory/publications`, and `/content-factory/review`.

- [x] **Step 6: Run focused backend smoke**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_metric_collector_service.py tests/test_cf_metric_import_scheduler_service.py tests/test_content_factory_metric_sources_api.py tests/test_content_factory_metrics_api.py -q
```

Expected: PASS. Existing pytest-asyncio warnings are acceptable if unchanged.

- [x] **Step 7: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [x] **Step 8: Update final verification docs**

In `docs/PLAN.md` and `docs/STATUS.md`, replace `Pending implementation.` in Sprint 49 with the exact commands and pass/fail results from Steps 1-7.

If full DB-dependent backend verification is attempted and fails because local Postgres is unavailable, record the infrastructure limitation explicitly without treating it as a Sprint 49 code failure.

- [x] **Step 9: Commit final status**

```bash
git add docs/PLAN.md docs/STATUS.md
git commit -m "docs(cf): update production readiness verification"
```

---

## Final Integration

After Task 5:

1. Use `superpowers:verification-before-completion`.
2. Confirm `git status --short --branch` is clean on `codex/content-factory-sprint-49-production-readiness`.
3. Merge to `main` only after verification is green or documented as infrastructure-limited.
4. Run post-merge smoke:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_metric_collector_service.py tests/test_cf_metric_import_scheduler_service.py tests/test_content_factory_metric_sources_api.py tests/test_content_factory_metrics_api.py -q
```

5. Update `docs/PLAN.md` and `docs/STATUS.md` to mark Sprint 49 merged and pushed.
6. Commit that status update.
7. Push `main`.
