# Content Factory Sprint 50 Launch QA Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an operator-facing launch QA guide to the existing Content Factory help page without adding another navigation item.

**Architecture:** Keep Sprint 50 frontend-only. Extend the existing help page with source-backed static launch QA content, protect it with source guards, and update durable repo docs so the next operator step remains visible outside the chat.

**Tech Stack:** Next.js App Router, React, TypeScript, Node source-guard tests, Markdown repo docs.

---

## File Structure

- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`
  - Add a failing source guard for the launch QA guide.
- Modify: `frontend/src/app/content-factory/help/page.tsx`
  - Add launch QA arrays and render a new `Проверка перед запуском` section.
- Modify: `docs/PLAN.md`
  - Put Sprint 50 as the active top plan.
- Modify: `docs/STATUS.md`
  - Put Sprint 50 as the active status section.
- Modify: `docs/TEST_PLAN.md`
  - Add Sprint 50 automated and manual test plan.
- Modify: `docs/BACKLOG.md`
  - Make launch blocker handling explicit as the next operator action.

---

### Task 1: Source Guard

**Files:**
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] **Step 1: Add the failing launch QA guard**

Add this test immediately after `content factory help exposes launch first-use guide`:

```ts
test("content factory help exposes launch QA guide", () => {
  const source = readSource("app/content-factory/help/page.tsx");
  const uiSource = readSource("lib/contentFactoryUi.ts");

  assert.match(source, /Проверка перед запуском/);
  assert.match(source, /LAUNCH_QA_GROUPS/);
  assert.match(source, /LAUNCH_BLOCKER_POLICY/);
  assert.match(source, /LAUNCH_QA_PATH/);
  assert.match(source, /launch blocker/);
  assert.match(source, /ручной обход/i);
  assert.match(source, /post-release backlog/i);
  assert.match(source, /VK-метрики/);
  assert.match(source, /Telegram/);
  assert.match(source, /docs\/content-factory-production-readiness\.md/);
  assert.match(source, /\/content-factory\/bundles/);
  assert.match(source, /\/content-factory\/publications/);
  assert.match(source, /\/content-factory\/review/);
  assert.match(source, /\/content-factory\/effectiveness/);
  assert.doesNotMatch(source, /\/content-factory\/launch/);
  assert.doesNotMatch(uiSource, /\/content-factory\/launch/);
});
```

- [ ] **Step 2: Run source guard to verify RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: FAIL because `LAUNCH_QA_GROUPS`, `LAUNCH_BLOCKER_POLICY`, `LAUNCH_QA_PATH`, and `Проверка перед запуском` do not exist yet.

- [ ] **Step 3: Commit the failing guard**

Do not commit a failing test by itself. Continue to Task 2 and commit the RED/GREEN pair together.

---

### Task 2: Help Page Launch QA Guide

**Files:**
- Modify: `frontend/src/app/content-factory/help/page.tsx`
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] **Step 1: Add launch QA constants**

In `frontend/src/app/content-factory/help/page.tsx`, add these constants after `FIRST_SAFE_PATH`:

```ts
const LAUNCH_QA_GROUPS = [
  {
    title: "Доступы и навигация",
    open: "Откройте Обзор, Календарь, Публикации, Кампании, Очередь проверки, Аудитории, Эффективность и Справку.",
    evidence: "Администратор входит без дополнительных флагов, обычный участник входит только с доступом к Контент-фабрике.",
    blocker: "Пользователь с нужной ролью не может открыть раздел или видит системную ошибку вместо понятного ограничения.",
  },
  {
    title: "Кампания и план",
    open: "Создайте одну реальную кампанию и одну публикацию из кампании или списка публикаций.",
    evidence: "Видны владелец, цель, дата события, материалы, связанные публикации и понятный следующий шаг.",
    blocker: "Нельзя создать кампанию, публикация не связывается с кампанией или матрица не показывает пропущенные каналы.",
  },
  {
    title: "Готовность публикации",
    open: "Заполните площадку, формат, дату, ответственного, текст, UTM, аудиторию и хотя бы одну адаптацию.",
    evidence: "Чек-лист объясняет, что готово, что отсутствует и какие пункты появятся только после публикации.",
    blocker: "Пользователь не понимает, что мешает выпуску, или карточка показывает технические названия вместо рабочих подсказок.",
  },
  {
    title: "Проверка и одобрение",
    open: "Проведите публикацию через текст, дизайн, фактчек, врачебную проверку, одобрение или расписание.",
    evidence: "Очередь проверки показывает следующий шаг, ответственного, срочность и понятную причину попадания в очередь.",
    blocker: "Материал пропадает из очереди, статус нельзя изменить или медицинская проверка не отличима от обычного статуса.",
  },
  {
    title: "Очередь публикации",
    open: "Поставьте одобренную или запланированную публикацию в очередь, попробуйте отправку сейчас и ручной обход.",
    evidence: "Telegram и VK текстовые публикации отправляются только при корректной настройке; ошибка или ручной обход остаются в журнале.",
    blocker: "Провайдер падает без понятного сообщения, ручной обход не требует причины или факт публикации не сохраняется.",
  },
  {
    title: "VK-метрики и ограничения Telegram",
    open: "Для опубликованного VK-поста запустите сбор метрик или проверьте активный источник; отдельно проверьте ручной ввод метрик.",
    evidence: "VK-метрики попадают в историю с источником и окном замера; Telegram-аналитика честно обозначена как неавтоматическая.",
    blocker: "VK-сбор не показывает понятную ошибку, дублирует замеры или интерфейс обещает Telegram-аналитику через бота.",
  },
  {
    title: "Выводы и blockers",
    open: "Создайте ретроспективу и запишите все найденные launch blocker, ручной обход или post-release backlog.",
    evidence: "Команда понимает, что блокирует запуск, что можно обойти вручную, а что безопасно отложить после релиза.",
    blocker: "Нельзя записать выводы, blocker теряется вне системы или команда не может отличить ограничение от дефекта.",
  },
];

const LAUNCH_BLOCKER_POLICY = [
  {
    label: "launch blocker",
    text: "Запуск нельзя одобрять, если ломается доступ, создание кампании или публикации, очередь, сохранение факта выхода, VK-метрики для проверяемого поста или понятность критического статуса.",
  },
  {
    label: "ручной обход",
    text: "Запуск возможен, если действие можно надежно выполнить руками, причина обхода записана, а пользователь видит это как временный рабочий процесс.",
  },
  {
    label: "post-release backlog",
    text: "После запуска можно отложить улучшения, которые не мешают пройти один полный цикл: дополнительные провайдеры, медиа-автопубликацию, Telegram MTProto-аналитику и расширенные отчеты.",
  },
];

const LAUNCH_QA_PATH = [
  { label: "Кампания", href: "/content-factory/bundles" },
  { label: "Публикации", href: "/content-factory/publications" },
  { label: "Проверка", href: "/content-factory/review" },
  { label: "Эффективность", href: "/content-factory/effectiveness" },
  { label: "Readiness doc", href: "docs/content-factory-production-readiness.md" },
];
```

- [ ] **Step 2: Render the launch QA section**

Insert this section between `Первый запуск: что открыть по порядку` and `Как начать без страха`:

```tsx
<section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
  <div className="flex items-center gap-2">
    <ClipboardCheck className="h-4 w-4 text-primary" />
    <h2 className="text-sm font-semibold text-foreground">
      Проверка перед запуском
    </h2>
  </div>
  <p className="mt-3 text-sm leading-6 text-muted-foreground">
    Launch QA - это не попытка проверить все старые записи. Нужно пройти один
    реальный или production-like цикл и честно классифицировать найденное:
    launch blocker, ручной обход или post-release backlog.
  </p>
  <div className="mt-4 grid gap-3 lg:grid-cols-2">
    {LAUNCH_QA_GROUPS.map((group) => (
      <article
        key={group.title}
        className="rounded-lg border border-border/70 bg-background px-4 py-4"
      >
        <h3 className="text-sm font-semibold text-foreground">
          {group.title}
        </h3>
        <dl className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">Что открыть</dt>
            <dd>{group.open}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Evidence</dt>
            <dd>{group.evidence}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Blocker</dt>
            <dd>{group.blocker}</dd>
          </div>
        </dl>
      </article>
    ))}
  </div>
  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950">
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-4 w-4" />
      <h3 className="text-sm font-semibold">Как классифицировать найденное</h3>
    </div>
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      {LAUNCH_BLOCKER_POLICY.map((item) => (
        <div key={item.label} className="rounded-md bg-background/70 px-3 py-3">
          <div className="text-sm font-semibold">{item.label}</div>
          <p className="mt-2 text-xs leading-5">{item.text}</p>
        </div>
      ))}
    </div>
  </div>
  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
    {LAUNCH_QA_PATH.map((item) => {
      const isDoc = item.href.startsWith("docs/");
      return isDoc ? (
        <span
          key={item.href}
          className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm font-medium text-muted-foreground"
        >
          <span>{item.label}: {item.href}</span>
          <FileText className="h-3.5 w-3.5" />
        </span>
      ) : (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center justify-between gap-3 rounded-md border border-primary/20 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <span>{item.label}</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" />
        </Link>
      );
    })}
  </div>
</section>
```

- [ ] **Step 3: Run source guard to verify GREEN**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: PASS with 44 tests.

- [ ] **Step 4: Commit Task 1-2**

```bash
git add frontend/src/components/content-factory/contentFactorySourceGuards.test.ts frontend/src/app/content-factory/help/page.tsx
git commit -m "feat(cf): add launch QA guide"
```

---

### Task 3: Durable Docs

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`

- [ ] **Step 1: Update `docs/PLAN.md`**

Add a new top section before Sprint 49:

```md
# Active Plan: Content Factory Sprint 50 Launch QA Guide

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-06-01-content-factory-sprint-50-launch-qa-guide.md`. Keep `docs/STATUS.md` current after meaningful implementation or validation steps.

**Goal:** Add an operator-facing launch QA guide to the existing Content Factory help page without adding another navigation item.

**Detailed design:** `docs/superpowers/specs/2026-06-01-content-factory-sprint-50-launch-qa-guide-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-06-01-content-factory-sprint-50-launch-qa-guide.md`

**Milestones:**

1. Add source guard coverage for the launch QA guide.
2. Add the launch QA guide to `/content-factory/help`.
3. Update durable docs and backlog for blocker handling.
4. Run frontend verification.

**Implementation status:**

- In progress on branch `codex/content-factory-sprint-50-launch-qa-guide`.
- Sprint 1 through Sprint 49 work is merged to `main` and pushed.

**Definition of done:**

- `/content-factory/help` explains launch QA groups, evidence, blockers, manual workarounds, and post-release backlog classification.
- The guide links users to key Content Factory screens and the readiness document path.
- No new Content Factory navigation item is added.
- Source guards cover the launch QA section and route non-proliferation.
- Remaining authenticated launch decision QA stays visible in the backlog.

**Validation commands:**

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

**Latest verification result:**

- Pending implementation.

---
```

- [ ] **Step 2: Update `docs/STATUS.md`**

Add a new section below `# Status`:

```md
## Content Factory Sprint 50 Launch QA Guide

- Current phase: in progress on branch `codex/content-factory-sprint-50-launch-qa-guide`
- Source: Sprint 49 production readiness made launch QA the next operator step.
- Design: `docs/superpowers/specs/2026-06-01-content-factory-sprint-50-launch-qa-guide-design.md`
- Plan: `docs/superpowers/plans/2026-06-01-content-factory-sprint-50-launch-qa-guide.md`
- Scope: help-page launch QA guide, source guard, durable docs, and frontend verification
- Latest progress:
  - Created branch `codex/content-factory-sprint-50-launch-qa-guide`.
  - Wrote Sprint 50 design and implementation plan.
- Key decisions:
  - Do not add a new navigation item; keep launch QA inside the existing help page.
  - Keep this sprint frontend-only because no backend contracts change.
  - Treat real authenticated QA as an operator-run follow-up, not an automated local test.
- Next actions:
  - Implement the launch QA guide and run frontend verification.
- Latest verification:
  - Pending implementation.
```

- [ ] **Step 3: Update `docs/TEST_PLAN.md`**

Add this top section:

```md
## Content Factory Sprint 50 Launch QA Guide

### Automated

- `cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/help` and confirm `Проверка перед запуском` is easy to find after the first-launch section.
2. Confirm each launch QA group explains what to open, what evidence to confirm, and what counts as a blocker.
3. Confirm the blocker policy distinguishes `launch blocker`, `ручной обход`, and `post-release backlog`.
4. Confirm the guide does not create a new Content Factory navigation item.
5. Run real or production-like launch decision QA from `docs/content-factory-production-readiness.md` and record blockers in `docs/BACKLOG.md`.
```

- [ ] **Step 4: Update `docs/BACKLOG.md`**

Replace the first two `Next` bullets with:

```md
- Run launch decision QA from `docs/content-factory-production-readiness.md` and `/content-factory/help` with authenticated real or production-like data.
- Record every launch blocker, accepted manual workaround, and post-release backlog item from Sprint 50 launch QA with owner and expected fix sprint.
```

- [ ] **Step 5: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 6: Commit Task 3**

```bash
git add docs/PLAN.md docs/STATUS.md docs/TEST_PLAN.md docs/BACKLOG.md docs/superpowers/plans/2026-06-01-content-factory-sprint-50-launch-qa-guide.md
git commit -m "docs(cf): track launch QA guide sprint"
```

---

### Task 4: Verification And Final Status

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/superpowers/plans/2026-06-01-content-factory-sprint-50-launch-qa-guide.md`

- [ ] **Step 1: Run focused source guard**

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: PASS with 44 tests.

- [ ] **Step 2: Run full frontend tests**

```bash
cd frontend && npm test
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS. If `.next/types` is stale, run `npm run build` first and repeat `npx tsc --noEmit` sequentially.

- [ ] **Step 4: Run lint**

```bash
cd frontend && npm run lint
```

Expected: PASS with no ESLint warnings or errors.

- [ ] **Step 5: Run production build**

```bash
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 6: Run whitespace check**

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 7: Update verification docs**

Update Sprint 50 sections in `docs/PLAN.md` and `docs/STATUS.md` with actual command results. Mark all checkboxes in this plan as complete after the commands pass.

- [ ] **Step 8: Commit final status**

```bash
git add docs/PLAN.md docs/STATUS.md docs/superpowers/plans/2026-06-01-content-factory-sprint-50-launch-qa-guide.md
git commit -m "docs(cf): update launch QA guide verification"
```
