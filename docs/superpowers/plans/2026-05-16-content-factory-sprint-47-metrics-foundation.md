# Content Factory Sprint 47 Metrics Integration Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the durable foundation for future automated metric collection: metric source configs, import runs, snapshot provenance, and deduplication.

**Architecture:** Extend the existing Content Factory metric snapshot model instead of replacing it. Add two new backend resources (`cf_metric_source_config`, `cf_metric_import_run`) plus service methods that future collectors can reuse. Keep the frontend lightweight by showing integration provenance inside existing metric history, without adding another Content Factory menu item.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy async ORM, Alembic, PostgreSQL JSONB/partial indexes, pytest, Next.js 14, React 18, TypeScript, Node test runner, Tailwind/shadcn UI.

---

## File Structure

- Create `backend/alembic/versions/047_cf_metric_integration_foundation.py`: creates source config and import run tables, adds metric snapshot provenance columns and unique dedupe index.
- Modify `backend/app/db/models.py`: add `CFMetricSourceConfig`, `CFMetricImportRun`, and optional provenance fields on `CFMetricSnapshot`.
- Modify `backend/app/db/schemas.py`: add metric source/run literals and request/response schemas; extend `CFMetricSnapshotCreate/Response`.
- Create `backend/app/services/content_factory/metric_source_service.py`: source config CRUD, import run lifecycle, and validation.
- Modify `backend/app/services/content_factory/metric_service.py`: add dedupe-aware recording while preserving existing `record`.
- Create `backend/app/api/content_factory/metric_sources.py`: API endpoints for metric sources and import runs.
- Modify `backend/app/api/content_factory/__init__.py`: include metric source router.
- Modify backend tests:
  - `backend/tests/test_content_factory_models.py`
  - `backend/tests/test_content_factory_schemas.py`
  - create `backend/tests/test_cf_metric_source_service.py`
  - create `backend/tests/test_content_factory_metric_sources_api.py`
  - modify `backend/tests/test_cf_segment_metric_retro_services.py`
- Modify frontend:
  - `frontend/src/lib/types.ts`
  - `frontend/src/lib/api.ts`
  - `frontend/src/components/content-factory/ContentFactoryMetricHistory.tsx`
  - `frontend/src/app/content-factory/publications/[id]/page.tsx`
  - `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`
- Modify docs:
  - `docs/PLAN.md`
  - `docs/STATUS.md`
  - `docs/TEST_PLAN.md`
  - `docs/BACKLOG.md`

---

## Task 1: Backend Model, Schema, And Migration

**Files:**
- Create: `backend/alembic/versions/047_cf_metric_integration_foundation.py`
- Modify: `backend/app/db/models.py`
- Modify: `backend/app/db/schemas.py`
- Test: `backend/tests/test_content_factory_models.py`
- Test: `backend/tests/test_content_factory_schemas.py`

- [ ] **Step 1: Write failing model tests**

Add tests expecting the new models and metric snapshot provenance fields:

```python
def test_cf_metric_source_config_exists(self):
    self.assertEqual(models.CFMetricSourceConfig.__tablename__, "cf_metric_source_config")
    self.assertTrue(hasattr(models.CFMetricSourceConfig, "freshness_window_hours"))
    self.assertTrue(hasattr(models.CFMetricSourceConfig, "last_success_at"))

def test_cf_metric_import_run_exists(self):
    self.assertEqual(models.CFMetricImportRun.__tablename__, "cf_metric_import_run")
    self.assertTrue(hasattr(models.CFMetricImportRun, "skipped_duplicate_count"))
    self.assertTrue(hasattr(models.CFMetricImportRun, "raw_summary"))

def test_cf_metric_snapshot_provenance_fields_exist(self):
    self.assertTrue(hasattr(models.CFMetricSnapshot, "source_config_id"))
    self.assertTrue(hasattr(models.CFMetricSnapshot, "import_run_id"))
    self.assertTrue(hasattr(models.CFMetricSnapshot, "external_metric_id"))
    self.assertTrue(hasattr(models.CFMetricSnapshot, "dedupe_key"))
```

- [ ] **Step 2: Run model tests to verify RED**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_content_factory_models.py -q
```

Expected: fail because `CFMetricSourceConfig` and `CFMetricImportRun` do not exist.

- [ ] **Step 3: Write failing schema tests**

Add tests:

```python
def test_cf_metric_source_config_create_ok(self):
    payload = schemas.CFMetricSourceConfigCreate(
        source="vk_api",
        name="VK community metrics",
        freshness_window_hours=24,
        default_confidence="medium",
        config={"owner_id": "-123"},
    )
    self.assertEqual(payload.source, "vk_api")
    self.assertEqual(payload.name, "VK community metrics")
    self.assertEqual(payload.config["owner_id"], "-123")

def test_cf_metric_source_config_rejects_blank_name(self):
    with self.assertRaises(ValidationError):
        schemas.CFMetricSourceConfigCreate(source="vk_api", name=" ")

def test_cf_metric_import_run_response_ok(self):
    now = datetime.now(UTC)
    run = schemas.CFMetricImportRunResponse(
        id=uuid.uuid4(),
        source_config_id=uuid.uuid4(),
        status="succeeded",
        triggered_by="manual",
        requested_by_id=uuid.uuid4(),
        started_at=now,
        finished_at=now,
        found_count=10,
        created_count=8,
        skipped_duplicate_count=2,
        error_count=0,
        error_message=None,
        raw_summary={"provider": "test"},
        created_at=now,
        updated_at=now,
    )
    self.assertEqual(run.skipped_duplicate_count, 2)

def test_cf_metric_snapshot_create_accepts_integration_provenance(self):
    run_id = uuid.uuid4()
    source_config_id = uuid.uuid4()
    payload = schemas.CFMetricSnapshotCreate(
        publication_id=uuid.uuid4(),
        window="24h",
        metric_name="views",
        metric_value=100,
        source="vk_api",
        confidence="medium",
        source_config_id=source_config_id,
        import_run_id=run_id,
        external_metric_id="post-123:views:24h",
        dedupe_key="vk-api:source:publication:24h:views",
    )
    self.assertEqual(payload.source_config_id, source_config_id)
    self.assertEqual(payload.import_run_id, run_id)
```

- [ ] **Step 4: Run schema tests to verify RED**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_content_factory_schemas.py -q
```

Expected: fail because new schemas and fields do not exist.

- [ ] **Step 5: Implement models, schemas, and migration**

Add:

```python
CFMetricImportRunStatusType = Literal["pending", "running", "succeeded", "failed", "partial"]
CFMetricImportRunTriggerType = Literal["manual", "scheduled", "system", "test"]
```

Add schema classes:

```python
class CFMetricSourceConfigBase(BaseModel):
    source: CFMetricSourceType
    name: str = Field(..., max_length=200)
    description: str | None = None
    is_active: bool = True
    freshness_window_hours: int = Field(default=24, ge=1)
    default_confidence: CFConfidenceType = "medium"
    config: dict = Field(default_factory=dict)
    credentials_ref: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped


class CFMetricSourceConfigCreate(CFMetricSourceConfigBase):
    created_by_id: uuid.UUID | None = None


class CFMetricSourceConfigUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    is_active: bool | None = None
    freshness_window_hours: int | None = Field(default=None, ge=1)
    default_confidence: CFConfidenceType | None = None
    config: dict | None = None
    credentials_ref: str | None = None


class CFMetricSourceConfigResponse(CFMetricSourceConfigBase):
    id: uuid.UUID
    created_by_id: uuid.UUID | None = None
    last_run_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error_at: datetime | None = None
    last_error_message: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

Extend `CFMetricSnapshotCreate` with:

```python
source_config_id: uuid.UUID | None = None
import_run_id: uuid.UUID | None = None
external_metric_id: str | None = Field(default=None, max_length=200)
dedupe_key: str | None = Field(default=None, max_length=500)
```

Add ORM classes using existing timestamp patterns. Add migration with:

- `cf_metric_source_config`
- `cf_metric_import_run`
- nullable provenance columns on `cf_metric_snapshot`
- indexes:
  - `ix_cf_metric_source_config_source_active`
  - `ix_cf_metric_import_run_source_created`
  - `ix_cf_metric_import_run_status`
  - partial unique index `uq_cf_metric_snapshot_dedupe_key` on `dedupe_key` where it is not null.

- [ ] **Step 6: Run model and schema tests to verify GREEN**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_content_factory_models.py tests/test_content_factory_schemas.py -q
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add backend/alembic/versions/047_cf_metric_integration_foundation.py backend/app/db/models.py backend/app/db/schemas.py backend/tests/test_content_factory_models.py backend/tests/test_content_factory_schemas.py
git commit -m "feat(cf): add metric integration models"
```

---

## Task 2: Backend Services And Deduplication

**Files:**
- Create: `backend/app/services/content_factory/metric_source_service.py`
- Modify: `backend/app/services/content_factory/metric_service.py`
- Test: `backend/tests/test_cf_metric_source_service.py`
- Test: `backend/tests/test_cf_segment_metric_retro_services.py`

- [ ] **Step 1: Write failing service tests for source config and runs**

Create `backend/tests/test_cf_metric_source_service.py` with tests for:

```python
async def test_create_metric_source_config_adds_record():
    session = AsyncMock()
    payload = CFMetricSourceConfigCreate(
        source="vk_api",
        name="VK wall metrics",
        freshness_window_hours=24,
        default_confidence="medium",
        config={"owner_id": "-123"},
        created_by_id=uuid.uuid4(),
    )

    result = await MetricSourceConfigService.create(session, payload)

    assert result.name == "VK wall metrics"
    assert result.source == "vk_api"
    session.add.assert_called_once()


async def test_start_import_run_creates_running_run():
    session = AsyncMock()
    source = SimpleNamespace(id=uuid.uuid4())
    run = await MetricImportRunService.start_run(
        session,
        source,
        triggered_by="manual",
        requested_by_id=uuid.uuid4(),
    )

    assert run.status == "running"
    assert run.source_config_id == source.id
    session.add.assert_called_once()


async def test_finish_import_run_success_updates_source_state():
    session = AsyncMock()
    source = SimpleNamespace(
        id=uuid.uuid4(),
        last_run_at=None,
        last_success_at=None,
        last_error_at=None,
        last_error_message=None,
    )
    run = SimpleNamespace(
        id=uuid.uuid4(),
        source_config=source,
        status="running",
        found_count=0,
        created_count=0,
        skipped_duplicate_count=0,
        error_count=0,
        error_message=None,
        raw_summary=None,
        finished_at=None,
    )

    result = await MetricImportRunService.finish_run(
        session,
        run,
        status="succeeded",
        found_count=10,
        created_count=8,
        skipped_duplicate_count=2,
        error_count=0,
        raw_summary={"provider": "test"},
    )

    assert result.status == "succeeded"
    assert source.last_success_at is not None
    assert source.last_error_message is None
```

- [ ] **Step 2: Run service tests to verify RED**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_metric_source_service.py -q
```

Expected: fail because `metric_source_service.py` does not exist.

- [ ] **Step 3: Write failing dedupe tests**

Add to `backend/tests/test_cf_segment_metric_retro_services.py`:

```python
async def test_record_metric_with_dedupe_key_returns_existing_duplicate(self):
    existing = SimpleNamespace(id=uuid.uuid4(), dedupe_key="same-key")
    session = AsyncMock()
    session.execute.return_value.scalar_one_or_none.return_value = existing
    payload = CFMetricSnapshotCreate(
        publication_id=uuid.uuid4(),
        window="24h",
        metric_name="views",
        metric_value=100,
        source="vk_api",
        confidence="medium",
        dedupe_key="same-key",
    )

    result = await MetricService.record_deduped(session, payload)

    self.assertIs(result.snapshot, existing)
    self.assertFalse(result.created)
    session.add.assert_not_called()


async def test_record_metric_without_dedupe_key_still_creates_new_snapshot(self):
    session = AsyncMock()
    payload = CFMetricSnapshotCreate(
        publication_id=uuid.uuid4(),
        window="24h",
        metric_name="views",
        metric_value=100,
        source="manual",
        confidence="high",
    )

    result = await MetricService.record_deduped(session, payload)

    self.assertTrue(result.created)
    session.add.assert_called_once()
```

- [ ] **Step 4: Run dedupe tests to verify RED**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_segment_metric_retro_services.py -q
```

Expected: fail because `record_deduped` does not exist.

- [ ] **Step 5: Implement services**

Implement:

```python
@dataclass
class MetricRecordResult:
    snapshot: CFMetricSnapshot
    created: bool
```

`MetricService.record_deduped`:

- If `payload.dedupe_key` exists, query `CFMetricSnapshot.dedupe_key == payload.dedupe_key`.
- Return `MetricRecordResult(existing, created=False)` when found.
- Otherwise create snapshot through the same field mapping as `record`.
- Preserve `MetricService.record` by making it return `(await record_deduped(...)).snapshot`.

`MetricSourceConfigService`:

- `create`
- `get`
- `list`
- `update`

`MetricImportRunService`:

- `start_run`
- `finish_run`
- `list_runs`

Terminal run statuses (`succeeded`, `failed`, `partial`) should not be finished again.

- [ ] **Step 6: Run service tests to verify GREEN**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_metric_source_service.py tests/test_cf_segment_metric_retro_services.py -q
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/content_factory/metric_source_service.py backend/app/services/content_factory/metric_service.py backend/tests/test_cf_metric_source_service.py backend/tests/test_cf_segment_metric_retro_services.py
git commit -m "feat(cf): add metric source services"
```

---

## Task 3: Backend API

**Files:**
- Create: `backend/app/api/content_factory/metric_sources.py`
- Modify: `backend/app/api/content_factory/__init__.py`
- Test: `backend/tests/test_content_factory_metric_sources_api.py`

- [ ] **Step 1: Write failing API tests**

Create API unit tests with monkeypatched service calls:

```python
async def test_list_metric_sources(monkeypatch):
    source = make_source_config()
    monkeypatch.setattr(
        metric_sources_api.source_config_service,
        "list",
        AsyncMock(return_value=[source]),
    )

    result = await metric_sources_api.list_metric_sources(
        member=cf_member(),
        session=AsyncMock(),
        source=None,
        is_active=None,
        limit=100,
        offset=0,
    )

    assert result == [source]


async def test_create_metric_source_sets_member(monkeypatch):
    captured = {}

    async def fake_create(session, payload):
        captured["payload"] = payload
        return make_source_config(created_by_id=payload.created_by_id)

    monkeypatch.setattr(metric_sources_api.source_config_service, "create", fake_create)
    member = cf_member()

    result = await metric_sources_api.create_metric_source(
        data=CFMetricSourceConfigCreate(source="vk_api", name="VK metrics"),
        member=member,
        session=AsyncMock(),
    )

    assert captured["payload"].created_by_id == member.id
    assert result.created_by_id == member.id


async def test_list_metric_import_runs(monkeypatch):
    run = make_import_run()
    monkeypatch.setattr(
        metric_sources_api.import_run_service,
        "list_runs",
        AsyncMock(return_value=[run]),
    )

    result = await metric_sources_api.list_metric_import_runs(
        member=cf_member(),
        session=AsyncMock(),
        source_config_id=None,
        status=None,
        limit=100,
        offset=0,
    )

    assert result == [run]
```

- [ ] **Step 2: Run API tests to verify RED**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_content_factory_metric_sources_api.py -q
```

Expected: fail because API module does not exist.

- [ ] **Step 3: Implement API module**

Add routes:

- `GET /metric-sources`
- `POST /metric-sources`
- `GET /metric-sources/{source_config_id}`
- `PATCH /metric-sources/{source_config_id}`
- `GET /metric-import-runs`
- `GET /metric-sources/{source_config_id}/import-runs`

Use `require_cf_access`, `get_session`, and service-level validation errors mapped to HTTP 400. Return 404 when service returns `None`.

- [ ] **Step 4: Run API tests to verify GREEN**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_content_factory_metric_sources_api.py tests/test_content_factory_metrics_api.py -q
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/content_factory/metric_sources.py backend/app/api/content_factory/__init__.py backend/tests/test_content_factory_metric_sources_api.py
git commit -m "feat(cf): expose metric source API"
```

---

## Task 4: Frontend Types, API, And Provenance Display

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/content-factory/ContentFactoryMetricHistory.tsx`
- Modify: `frontend/src/app/content-factory/publications/[id]/page.tsx`
- Test: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] **Step 1: Write failing source guard**

Add a test:

```typescript
test("metric integration foundation is visible in frontend contracts and history", () => {
  const typesSource = readSource("lib/types.ts");
  const apiSource = readSource("lib/api.ts");
  const historySource = readSource(
    "components/content-factory/ContentFactoryMetricHistory.tsx",
  );
  const detailSource = readSource("app/content-factory/publications/[id]/page.tsx");

  assert.match(typesSource, /CFMetricSourceConfig/);
  assert.match(typesSource, /CFMetricImportRun/);
  assert.match(typesSource, /source_config_id/);
  assert.match(typesSource, /import_run_id/);
  assert.match(apiSource, /getCFMetricSources/);
  assert.match(apiSource, /getCFMetricImportRuns/);
  assert.match(detailSource, /api\.getCFMetricSources/);
  assert.match(historySource, /metricSources/);
  assert.match(historySource, /Интеграция/);
  assert.match(historySource, /external_metric_id/);
});
```

- [ ] **Step 2: Run source guard to verify RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because frontend contracts and provenance display do not exist.

- [ ] **Step 3: Implement frontend contracts and history display**

Add types:

```typescript
export type CFMetricImportRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "partial";
export type CFMetricImportRunTrigger = "manual" | "scheduled" | "system" | "test";

export interface CFMetricSourceConfig {
  id: string;
  source: CFMetricSource;
  name: string;
  description: string | null;
  is_active: boolean;
  freshness_window_hours: number;
  default_confidence: CFConfidence;
  config: CFJsonObject;
  credentials_ref: string | null;
  created_by_id: string | null;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
}
```

Extend `CFMetricSnapshot` and create request with `source_config_id`, `import_run_id`, `external_metric_id`, and `dedupe_key`.

Add API methods:

- `getCFMetricSources`
- `createCFMetricSource`
- `updateCFMetricSource`
- `getCFMetricImportRuns`
- `getCFMetricSourceImportRuns`

Publication detail should fetch metric sources in the same load block as other supporting resources, catching failure to `[]`.

`ContentFactoryMetricHistory` should accept `metricSources?: CFMetricSourceConfig[]`, build a `Map`, and show an additional small line for integration provenance when `metric.source_config_id` or `metric.import_run_id` or `metric.external_metric_id` exists.

- [ ] **Step 4: Run frontend source guard to verify GREEN**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/components/content-factory/ContentFactoryMetricHistory.tsx frontend/src/app/content-factory/publications/[id]/page.tsx frontend/src/components/content-factory/contentFactorySourceGuards.test.ts
git commit -m "feat(cf): show metric integration provenance"
```

---

## Task 5: Durable Docs And Verification

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`

- [ ] **Step 1: Update durable docs**

Add Sprint 47 as the active plan with:

- design doc path,
- implementation plan path,
- milestones,
- definition of done,
- validation commands,
- latest verification results as commands are run.

Move `Execute Sprint 47` out of `docs/BACKLOG.md` after implementation and leave Sprint 48 as next.

- [ ] **Step 2: Run focused backend verification**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_content_factory_models.py tests/test_content_factory_schemas.py tests/test_cf_metric_source_service.py tests/test_cf_segment_metric_retro_services.py tests/test_content_factory_metric_sources_api.py tests/test_content_factory_metrics_api.py -q
```

Expected: pass.

- [ ] **Step 3: Run full backend verification**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest -q
```

Expected: pass.

- [ ] **Step 4: Run frontend verification**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
```

Expected: pass.

- [ ] **Step 5: Run diff check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 6: Commit docs**

```bash
git add docs/PLAN.md docs/STATUS.md docs/TEST_PLAN.md docs/BACKLOG.md
git commit -m "docs(cf): update metrics foundation status"
```

---

## Self-Review

- Spec coverage: the plan covers metric source config, import runs, source freshness/error state, metric snapshot provenance, dedupe rules, backend APIs, lightweight frontend visibility, manual metric compatibility, and docs.
- No real external metric collector is included; that is intentionally deferred to Sprint 48.
- No new top-level Content Factory menu item is included.
- Existing manual and paste-import metric flows remain valid because dedupe is opt-in through `dedupe_key`.
