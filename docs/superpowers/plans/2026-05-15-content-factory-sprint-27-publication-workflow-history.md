# Content Factory Sprint 27 Publication Workflow History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record publication workflow status changes in the existing publication history and make the history panel read as a workflow audit trail.

**Architecture:** Extend `PublicationService.update` to create `CFPublicationVersion` rows for body or status changes, using the existing table and API response schema. Polish the existing frontend version list copy so the new status notes are understandable.

**Tech Stack:** FastAPI service layer, SQLAlchemy async session, Pydantic schemas, pytest/unittest, Next.js React components, Node source guard tests.

---

## File Map

- Modify `backend/app/services/content_factory/publication_service.py`: derive approval event, status labels, status notes, and create one history row for body/status changes.
- Modify `backend/app/api/content_factory/publications.py`: stop forcing `approval_event="reviewed"` from PATCH.
- Modify `backend/tests/test_cf_publication_service.py`: add RED tests for status history and combined body+status updates.
- Modify `backend/tests/test_content_factory_publications_api.py`: guard that PATCH delegates without a hard-coded approval event.
- Modify `frontend/src/components/content-factory/ContentFactoryPublicationVersionList.tsx`: rename the panel and add workflow explanatory copy.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`: guard frontend copy and notes rendering.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, `docs/BACKLOG.md`: record Sprint 27 status and verification.

## Task 1: Backend RED Tests

**Files:**

- Modify: `backend/tests/test_cf_publication_service.py`
- Modify: `backend/tests/test_content_factory_publications_api.py`

- [ ] **Step 1: Add status-only history test**

```python
    async def test_update_publication_creates_history_on_status_change(self):
        session = AsyncMock()
        publication = SimpleNamespace(
            id=uuid.uuid4(), bundle_id=uuid.uuid4(), body_text="ready text",
            version_number=1, status="needs_copy", title="t",
        )
        PublicationService.get = AsyncMock(return_value=publication)

        editor_id = uuid.uuid4()
        result = await PublicationService.update(
            session,
            publication.id,
            CFPublicationUpdate(status="factcheck"),
            editor_id=editor_id,
        )

        self.assertEqual(result.status, "factcheck")
        self.assertEqual(result.version_number, 2)
        version = session.add.call_args.args[0]
        self.assertEqual(version.version_number, 2)
        self.assertEqual(version.body_text, "ready text")
        self.assertEqual(version.edited_by_id, editor_id)
        self.assertEqual(version.approval_event, "reviewed")
        self.assertEqual(version.notes, "Статус: Нужен текст -> Фактчек")
```

- [ ] **Step 2: Add combined body+status single-history test**

```python
    async def test_update_publication_body_and_status_creates_one_history_row(self):
        session = AsyncMock()
        publication = SimpleNamespace(
            id=uuid.uuid4(), bundle_id=uuid.uuid4(), body_text="old",
            version_number=1, status="doctor_review", title="t",
        )
        PublicationService.get = AsyncMock(return_value=publication)

        editor_id = uuid.uuid4()
        result = await PublicationService.update(
            session,
            publication.id,
            CFPublicationUpdate(body_text="new", status="approved"),
            editor_id=editor_id,
            approval_event="doctor_approved",
        )

        self.assertEqual(result.body_text, "new")
        self.assertEqual(result.status, "approved")
        self.assertEqual(result.version_number, 2)
        self.assertEqual(session.add.call_count, 1)
        version = session.add.call_args.args[0]
        self.assertEqual(version.body_text, "new")
        self.assertEqual(version.approval_event, "doctor_approved")
        self.assertEqual(version.notes, "Статус: Проверка врача -> Одобрено")
```

- [ ] **Step 3: Add API delegation guard**

In `test_update_publication_404`, after the call, assert:

```python
    _, kwargs = pubs_api.publication_service.update.await_args
    assert "approval_event" not in kwargs
```

- [ ] **Step 4: Verify backend RED**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_cf_publication_service.py tests/test_content_factory_publications_api.py -q
```

Expected: FAIL because status-only updates do not create history yet and API still passes `approval_event`.

## Task 2: Backend Implementation

**Files:**

- Modify: `backend/app/services/content_factory/publication_service.py`
- Modify: `backend/app/api/content_factory/publications.py`

- [ ] **Step 1: Add status label and event helpers**

Add module-level dictionaries for status labels and target status to approval event.

- [ ] **Step 2: Update `PublicationService.update`**

Capture old status before applying changes. Create a version row when `body_changed or status_changed`. Use the explicit approval event when provided; otherwise derive from target status. Set notes only for status changes.

- [ ] **Step 3: Update publication PATCH route**

Remove `approval_event="reviewed"` from the `publication_service.update` call.

- [ ] **Step 4: Verify backend GREEN**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_cf_publication_service.py tests/test_content_factory_publications_api.py -q
```

Expected: PASS.

## Task 3: Frontend RED/GREEN

**Files:**

- Modify: `frontend/src/components/content-factory/ContentFactoryPublicationVersionList.tsx`
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] **Step 1: Add source guard assertions**

In the publication detail/version guard, assert:

```ts
  const versionListSource = readSource(
    "components/content-factory/ContentFactoryPublicationVersionList.tsx",
  );
  assert.match(versionListSource, /История публикации/);
  assert.match(versionListSource, /workflow/);
  assert.match(versionListSource, /version\.notes/);
```

- [ ] **Step 2: Verify frontend RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: FAIL because the component still says `История версий`.

- [ ] **Step 3: Update version list copy**

Change title to `История публикации`, add explanatory copy `Версии текста и переходы по workflow.`, and change empty state to `Истории публикации пока нет`.

- [ ] **Step 4: Verify frontend GREEN**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: PASS.

## Task 4: Full Verification And Docs

**Files:**

- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`

- [ ] **Step 1: Run focused verification**

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_cf_publication_service.py tests/test_content_factory_publications_api.py -q
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run broader verification**

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Expected: PASS for every command.

- [ ] **Step 3: Update durable docs**

Make Sprint 27 the top active plan in `docs/PLAN.md`, add a top status entry in `docs/STATUS.md`, add automated/manual checks to `docs/TEST_PLAN.md`, and add manual QA to `docs/BACKLOG.md`.

- [ ] **Step 4: Commit, merge, and push**

```bash
git add backend frontend docs
git commit -m "feat(cf): record publication workflow history"
git switch main
git merge --ff-only codex/content-factory-sprint-27-publication-workflow-history
git push origin main
```

