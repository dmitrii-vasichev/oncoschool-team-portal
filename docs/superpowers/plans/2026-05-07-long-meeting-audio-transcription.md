# Long Meeting Audio Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make meeting audio transcription reliable for one- to two-hour Zoom recordings by queueing work, preparing audio chunks under OpenAI's 25 MB limit, and notifying the requester when processing finishes.

**Architecture:** Keep the current Railway deployment simple by running a PostgreSQL-backed transcription queue inside the existing backend container. Add `ffmpeg` audio preparation, an APScheduler polling worker, progress fields on `meeting_ai_processing`, a lightweight processing status API, and frontend polling/notification UX.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic/PostgreSQL, APScheduler, aiogram Telegram bot, OpenAI Audio Transcriptions API, `ffmpeg`/`ffprobe`, Next.js 14, React 18, TypeScript, Tailwind CSS, Python `pytest`, frontend Node tests, TypeScript, ESLint, Next build.

---

## Source Documents

- Design spec: `docs/superpowers/specs/2026-05-07-long-meeting-audio-transcription-design.md`
- Existing meeting AI service: `backend/app/services/meeting_ai_outcomes_service.py`
- Existing Zoom service: `backend/app/services/zoom_service.py`
- Existing voice service: `backend/app/services/voice_service.py`
- Existing scheduler pattern: `backend/app/services/broadcast_scheduler_service.py`
- Existing app startup: `backend/app/main.py`
- Existing meeting API: `backend/app/api/meetings.py`
- Existing AI outcomes panel: `frontend/src/components/meetings/MeetingAiOutcomesPanel.tsx`
- Existing notification services: `backend/app/services/in_app_notification_service.py`, `backend/app/services/notification_service.py`

## Scope Check

This plan implements one cohesive improvement: durable long audio transcription. It touches database state, backend processing, deployment dependencies, user notifications, and frontend progress display. It does not add speaker diarization, live transcription, Redis/Celery, a separate Railway worker, or automatic transcription for all meetings.

## File Structure

- Create `backend/alembic/versions/032_long_meeting_transcription_queue.py`: add queue/progress/requester fields to `meeting_ai_processing`.
- Modify `backend/app/db/models.py`: add new `MeetingAIProcessing` columns and requester relationship.
- Modify `backend/app/db/schemas.py`: add `queued` status and progress fields to `MeetingAIProcessingResponse`.
- Modify `backend/app/db/repositories.py`: extend `MeetingAIProcessingRepository` with queue, claim, heartbeat, complete, and failure helpers.
- Create `backend/app/services/audio_preparation_service.py`: prepare OpenAI-safe MP3 chunks with `ffmpeg` and clean up temporary files.
- Modify `backend/app/services/voice_service.py`: expose chunk-safe constants and reuse file transcription for prepared chunks.
- Modify `backend/app/services/meeting_ai_outcomes_service.py`: split queueing from actual transcription work and add notification helpers.
- Create `backend/app/services/meeting_transcription_scheduler_service.py`: poll and process queued/stale jobs with APScheduler.
- Modify `backend/app/services/zoom_service.py`: remove the pre-download hard stop for files over 25 MB on meeting audio, while keeping streamed temporary download safety.
- Modify `backend/app/api/meetings.py`: queue transcription instead of doing long work inline; add current processing endpoint.
- Modify `backend/app/main.py`: instantiate and start/stop the transcription scheduler.
- Modify `backend/Dockerfile` and root `Dockerfile.railway`: install `ffmpeg`.
- Modify `frontend/src/lib/types.ts`: add queued/progress fields.
- Modify `frontend/src/lib/api.ts`: add `getMeetingAIProcessing`.
- Modify `frontend/src/components/meetings/MeetingAiOutcomesPanel.tsx`: load status, poll active jobs, render progress, and refresh after completion.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, and `docs/TEST_PLAN.md`: record the active plan and validation path.

## Task 1: Data Model, Schemas, And Repository Queue Helpers

**Files:**
- Create: `backend/alembic/versions/032_long_meeting_transcription_queue.py`
- Modify: `backend/app/db/models.py`
- Modify: `backend/app/db/schemas.py`
- Modify: `backend/app/db/repositories.py`
- Test: `backend/tests/test_meeting_ai_outcomes_service.py`

- [ ] **Step 1: Add failing tests for queued processing fields and duplicate queue protection**

Append tests that construct `MeetingAIProcessingResponse` with the new fields and verify repository queue behavior with mocks where direct database setup already exists in the file.

Expected schema assertion:

```python
response = MeetingAIProcessingResponse(
    id=uuid.uuid4(),
    meeting_id=uuid.uuid4(),
    status="queued",
    transcript_source=None,
    transcription_model="gpt-4o-mini-transcribe",
    started_at=None,
    completed_at=None,
    error_message=None,
    transcript_char_count=None,
    audio_duration_seconds=None,
    estimated_cost_usd=None,
    draft_summary=None,
    draft_decisions=[],
    draft_tasks=[],
    published_at=None,
    published_by_id=None,
    transcription_requested_by_id=uuid.uuid4(),
    transcription_phase="queued",
    transcription_progress_percent=0,
    transcription_current_chunk=0,
    transcription_total_chunks=0,
    transcription_source_bytes=None,
    transcription_prepared_bytes=None,
    transcription_attempt_count=0,
    transcription_last_heartbeat_at=None,
)
assert response.status == "queued"
assert response.transcription_phase == "queued"
```

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_ai_outcomes_service.py -q
```

Expected: fail because the new status and fields do not exist yet.

- [ ] **Step 2: Add Alembic migration**

Create revision `032_long_audio_queue` with `down_revision = "031_meeting_board_ai_outcomes"` and add nullable/defaulted columns:

```python
op.add_column("meeting_ai_processing", sa.Column("transcription_requested_by_id", postgresql.UUID(as_uuid=True), nullable=True))
op.add_column("meeting_ai_processing", sa.Column("transcription_phase", sa.String(length=40), nullable=True))
op.add_column("meeting_ai_processing", sa.Column("transcription_progress_percent", sa.Integer(), server_default="0", nullable=False))
op.add_column("meeting_ai_processing", sa.Column("transcription_current_chunk", sa.Integer(), server_default="0", nullable=False))
op.add_column("meeting_ai_processing", sa.Column("transcription_total_chunks", sa.Integer(), server_default="0", nullable=False))
op.add_column("meeting_ai_processing", sa.Column("transcription_source_bytes", sa.BigInteger(), nullable=True))
op.add_column("meeting_ai_processing", sa.Column("transcription_prepared_bytes", sa.BigInteger(), nullable=True))
op.add_column("meeting_ai_processing", sa.Column("transcription_attempt_count", sa.Integer(), server_default="0", nullable=False))
op.add_column("meeting_ai_processing", sa.Column("transcription_last_heartbeat_at", sa.DateTime(), nullable=True))
op.create_foreign_key(
    "fk_meeting_ai_processing_requested_by",
    "meeting_ai_processing",
    "team_members",
    ["transcription_requested_by_id"],
    ["id"],
    ondelete="SET NULL",
)
op.create_index("idx_meeting_ai_processing_phase", "meeting_ai_processing", ["transcription_phase"])
op.create_index("idx_meeting_ai_processing_heartbeat", "meeting_ai_processing", ["transcription_last_heartbeat_at"])
```

Downgrade drops indexes, foreign key, and columns in reverse order.

- [ ] **Step 3: Update SQLAlchemy model and Pydantic schema**

Add matching mapped columns to `MeetingAIProcessing` in `backend/app/db/models.py`, add a requester relationship with `foreign_keys=[transcription_requested_by_id]`, and extend `MeetingAIProcessingResponse` in `backend/app/db/schemas.py`. Add `"queued"` to `MeetingAIProcessingStatusType`.

- [ ] **Step 4: Add repository helpers**

Extend `MeetingAIProcessingRepository` with:

```python
async def queue_transcription(self, session, *, meeting_id, model, requested_by_id) -> MeetingAIProcessing | None: ...
async def get_next_transcription_job(self, session, *, stale_before, max_attempts, model) -> MeetingAIProcessing | None: ...
async def update_transcription_progress(self, session, *, meeting_id, phase, progress_percent, current_chunk=0, total_chunks=0, source_bytes=None, prepared_bytes=None) -> MeetingAIProcessing | None: ...
async def mark_transcription_complete(self, session, *, meeting_id, transcript_source, transcript_char_count, audio_duration_seconds=None, estimated_cost_usd=None) -> MeetingAIProcessing | None: ...
async def mark_transcription_failed(self, session, *, meeting_id, error_message) -> MeetingAIProcessing | None: ...
```

Use atomic `update(...).where(...)...returning(MeetingAIProcessing)` patterns matching the existing repository style.

- [ ] **Step 5: Run backend schema/repository tests**

Run the same pytest command from Step 1.

Expected: pass.

## Task 2: Audio Preparation Service With ffmpeg Chunks

**Files:**
- Create: `backend/app/services/audio_preparation_service.py`
- Modify: `backend/app/services/voice_service.py`
- Test: `backend/tests/test_meeting_ai_outcomes_service.py`

- [ ] **Step 1: Add failing tests for chunk planning and cleanup**

Add tests for a new `AudioPreparationService` that mock subprocess calls and verify:

- it creates a temporary chunk directory;
- it returns chunk paths in lexical order;
- it rejects chunks above the safe byte limit;
- cleanup removes source and chunk files.

Expected API:

```python
service = AudioPreparationService()
prepared = await service.prepare_chunks("/tmp/source.m4a")
assert prepared.chunk_paths == sorted(prepared.chunk_paths)
assert prepared.total_bytes >= 0
```

- [ ] **Step 2: Implement `AudioPreparationService`**

Create:

```python
@dataclass
class PreparedAudioChunks:
    source_path: str
    chunk_dir: str
    chunk_paths: list[str]
    duration_seconds: int | None
    source_bytes: int
    total_bytes: int

class AudioPreparationService:
    safe_chunk_bytes = 24 * 1024 * 1024
    default_chunk_seconds = 10 * 60

    async def prepare_chunks(self, source_path: str) -> PreparedAudioChunks: ...
    async def cleanup(self, prepared: PreparedAudioChunks | None, source_path: str | None = None) -> None: ...
```

Use `asyncio.create_subprocess_exec` for `ffprobe` and `ffmpeg`. The first `ffmpeg` command should convert to mono MP3 and segment by time:

```bash
ffmpeg -y -i source.m4a -vn -ac 1 -ar 16000 -b:a 32k -f segment -segment_time 600 -reset_timestamps 1 chunk_%03d.mp3
```

If any chunk exceeds the safe limit, retry once with `-b:a 24k` and `-segment_time 480`. If chunks still exceed the limit, raise `ValueError("Не удалось подготовить аудио: фрагмент больше 25 МБ")`.

- [ ] **Step 3: Update voice constants**

In `voice_service.py`, keep the OpenAI hard max at `25 * 1024 * 1024` and add:

```python
OPENAI_TRANSCRIPTION_SAFE_CHUNK_BYTES = 24 * 1024 * 1024
```

Keep `transcribe_file` checking the hard max so final API calls stay protected.

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_ai_outcomes_service.py -q
```

Expected: pass.

## Task 3: Queue-Based Transcription Service And Scheduler

**Files:**
- Modify: `backend/app/services/meeting_ai_outcomes_service.py`
- Create: `backend/app/services/meeting_transcription_scheduler_service.py`
- Modify: `backend/app/services/zoom_service.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_meeting_ai_outcomes_service.py`

- [ ] **Step 1: Add failing service tests**

Cover:

- `queue_meeting_audio_transcription` commits a queued job and does not call Zoom/OpenAI;
- `process_transcription_job` downloads Zoom audio, prepares chunks, transcribes each chunk, combines text, saves transcript, and deletes temporary files;
- failures mark the job failed and still clean temporary files;
- completion notification is attempted for the requester.

- [ ] **Step 2: Split queueing from processing**

In `MeetingAIOutcomesService`, replace direct long work in `transcribe_meeting_audio` with:

```python
async def queue_meeting_audio_transcription(self, session, *, meeting, zoom_service, moderator, model=DEFAULT_TRANSCRIPTION_MODEL) -> MeetingAIProcessing:
    if not meeting.zoom_meeting_id or not zoom_service:
        raise ValueError("Zoom-запись недоступна")
    processing = await self.processing_repo.queue_transcription(
        session,
        meeting_id=meeting.id,
        model=model,
        requested_by_id=moderator.id,
    )
    if not processing:
        raise ValueError("Транскрибация уже выполняется")
    await session.flush()
    return processing
```

Add `process_transcription_job(session, *, processing, zoom_service, bot, frontend_url)` for the scheduler.

- [ ] **Step 3: Allow large Zoom audio download**

In `zoom_service.py`, remove the metadata and streamed-byte rejection that stops download at 25 MB for meeting audio. Keep temporary file cleanup. The OpenAI limit now applies after `ffmpeg` chunk preparation in `VoiceService.transcribe_file`.

- [ ] **Step 4: Add scheduler service**

Create `MeetingTranscriptionSchedulerService` following existing scheduler style:

```python
class MeetingTranscriptionSchedulerService:
    def __init__(self, *, bot, session_maker, zoom_service, frontend_url: str): ...
    def start(self) -> None: ...
    def stop(self) -> None: ...
    async def _process_due_jobs(self) -> None: ...
```

Poll every minute, claim one job at a time, and skip work when Zoom is not configured.

- [ ] **Step 5: Wire scheduler in app startup**

In `main.py`, instantiate `meeting_transcription_scheduler`, store it on `app.state`, call `.start()` in startup and `.stop()` in shutdown.

- [ ] **Step 6: Run focused backend tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_ai_outcomes_service.py -q
```

Expected: pass.

## Task 4: API, Notifications, And Processing Status Endpoint

**Files:**
- Modify: `backend/app/api/meetings.py`
- Modify: `backend/app/services/in_app_notification_service.py`
- Modify: `backend/app/services/notification_service.py`
- Test: `backend/tests/test_meeting_ai_outcomes_api.py`

- [ ] **Step 1: Add failing API tests**

Cover:

- `POST /ai/transcribe-audio` returns queued processing and does not block on actual transcription;
- non-moderators still cannot queue transcription;
- duplicate active queue returns `422`;
- `GET /ai/processing` returns the existing processing record.

- [ ] **Step 2: Update transcription endpoint**

Change endpoint to call `queue_meeting_audio_transcription` and return `MeetingAIProcessingResponse`.

The success message should be represented by frontend copy, not backend text.

- [ ] **Step 3: Add processing endpoint**

Add:

```python
@router.get("/{meeting_id}/ai/processing", response_model=MeetingAIProcessingResponse)
async def get_meeting_ai_processing(...):
    meeting = await meeting_service.get_meeting_by_id(session, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Встреча не найдена")
    processing = await meeting_ai_outcomes_service.processing_repo.get_or_create(session, meeting_id)
    return MeetingAIProcessingResponse.model_validate(processing)
```

- [ ] **Step 4: Add notification helpers**

Add in-app methods:

```python
async def notify_meeting_transcription_completed(self, session, *, meeting, requester): ...
async def notify_meeting_transcription_failed(self, session, *, meeting, requester, error_message): ...
```

Add Telegram send methods in `NotificationService` or a focused helper inside `MeetingAIOutcomesService`; use `member.telegram_id`, `settings.NEXT_PUBLIC_FRONTEND_URL`, and best-effort `_send_safe` semantics.

- [ ] **Step 5: Run API tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_ai_outcomes_api.py -q
```

Expected: pass.

## Task 5: Frontend Progress Polling And UX

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/meetings/MeetingAiOutcomesPanel.tsx`
- Test: `frontend/src/components/meetings/MeetingAiOutcomesPanelUtils.test.ts`
- Test: `frontend/src/components/meetings/MeetingAiOutcomesPanelUtils.ts`

- [ ] **Step 1: Add failing frontend helper tests**

Add pure helpers for:

- active processing detection for `queued` and `transcribing`;
- phase label formatting;
- chunk progress label `Транскрибируем 3/8`;
- publish remains disabled until `draft_ready`.

- [ ] **Step 2: Update TypeScript types and API**

Add `queued` to `MeetingAIProcessingStatus`, add progress fields to `MeetingAIProcessing`, and add:

```ts
async getMeetingAIProcessing(meetingId: string): Promise<MeetingAIProcessing> {
  return this.request<MeetingAIProcessing>(`/api/meetings/${meetingId}/ai/processing`);
}
```

- [ ] **Step 3: Update AI outcomes panel**

On mount, load processing state. When status is `queued` or `transcribing`, poll every 5 seconds. Show:

- current status label;
- progress percent when available;
- current chunk/total chunks;
- a note that the user can leave the page and receive a notification.

After `transcript_ready`, stop polling and call `onPublished` or a new refresh callback so the meeting page reloads transcript data.

- [ ] **Step 4: Run frontend tests**

Run:

```bash
cd frontend && npm test -- MeetingAiOutcomesPanelUtils.test.ts
```

Expected: pass.

## Task 6: Deployment, Docs, And Full Verification

**Files:**
- Modify: `backend/Dockerfile`
- Modify: `Dockerfile.railway`
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`

- [ ] **Step 1: Add ffmpeg to Dockerfiles**

Update both Dockerfiles:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Update repo docs**

Record the plan in `docs/PLAN.md`, current progress in `docs/STATUS.md`, and add manual validation cases to `docs/TEST_PLAN.md`:

- short recording under 25 MB;
- recording over 25 MB;
- page-left notification path;
- retry after failure;
- Railway image has `ffmpeg`.

- [ ] **Step 3: Run backend focused tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_ai_outcomes_service.py tests/test_meeting_ai_outcomes_api.py -q
```

Expected: pass.

- [ ] **Step 4: Run broader backend tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q
```

Expected: pass.

- [ ] **Step 5: Run frontend checks**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
```

Expected: all pass.

- [ ] **Step 6: Run diff checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended files changed.
