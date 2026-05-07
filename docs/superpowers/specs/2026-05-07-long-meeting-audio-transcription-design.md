# Long Meeting Audio Transcription Design

## Summary

Meeting audio transcription must work for normal Oncoschool meeting lengths: approximately one to two hours. The current implementation sends one Zoom audio file directly to OpenAI transcription and rejects files above 25 MB. That matches the OpenAI Transcriptions API upload limit, but it makes the feature unreliable for real meeting recordings.

The approved direction is a database-backed background transcription pipeline inside the existing backend service. The pipeline downloads Zoom audio to temporary storage, prepares the audio with `ffmpeg`, splits it into OpenAI-safe chunks, transcribes each chunk, combines the transcript, stores the final text, and notifies the moderator who started the job.

This first release should avoid adding Redis, Celery, RabbitMQ, or a separate Railway worker service. The current app already runs FastAPI, aiogram polling, and APScheduler in one backend container, so the least painful reliable approach is to add a small scheduler-driven queue backed by the existing PostgreSQL database.

## Goals

- Make `Transcribe audio` work for typical one- to two-hour Zoom meetings.
- Keep OpenAI audio requests below the 25 MB upload limit.
- Avoid making the browser wait for a long HTTP request.
- Show useful progress in the meeting UI.
- Let users leave the page while transcription continues.
- Notify the initiating moderator when transcription finishes or fails.
- Preserve the existing rule that Zoom audio is never persisted in portal storage.
- Keep the Railway deployment simple: one backend service, one database, and `ffmpeg` installed in the Docker image.
- Make stuck or interrupted work recoverable after a backend restart.

## Non-Goals

- No separate Redis or queue broker in the first release.
- No separate Railway background worker service in the first release.
- No permanent audio storage in Supabase, the database, or local app storage.
- No speaker diarization in this release.
- No real-time live meeting transcription.
- No automatic transcription for every meeting.
- No automatic AI outcome publication after transcription.

## Constraints

OpenAI Transcriptions API file uploads are limited to 25 MB. Long recordings must therefore be compressed, split into chunks, or both. The application should keep every submitted chunk below a conservative limit, such as 24 MB, to leave room for multipart upload overhead and metadata differences.

Railway builds and runs the backend from a Dockerfile. The backend image can install system packages during build, so `ffmpeg` should be added to both backend Dockerfiles used by local/backend and Railway deployment.

Railway can restart a service during deploys or platform events. A long transcription cannot rely only on in-memory FastAPI `BackgroundTasks`, because in-flight work may be lost. Job state must be stored in PostgreSQL.

## Recommended Architecture

Use the existing `meeting_ai_processing` table as the durable job record, extended with transcription progress and request ownership fields.

The `POST /api/meetings/{meeting_id}/ai/transcribe-audio` endpoint should become a queueing endpoint:

1. Validate moderator access, Zoom availability, and meeting existence.
2. Create or update the `meeting_ai_processing` row.
3. Store the requesting moderator as the transcription requester.
4. Set status to `queued` or `transcribing` with phase `queued`.
5. Commit immediately.
6. Return the processing record to the frontend.

An APScheduler-based `MeetingTranscriptionSchedulerService` should run in the backend container and poll for queued or stale transcription jobs. It should claim one job at a time with an atomic database update, process it, then mark it ready or failed.

This design keeps the current deployment model intact while making work recoverable. If the container restarts, a queued job remains in the database. If a job was in progress and its heartbeat becomes stale, the scheduler can retry it.

## Audio Processing Flow

For each claimed job:

1. Load the meeting and confirm it still has a Zoom meeting id.
2. Download the selected Zoom audio recording to a temporary file.
3. Probe audio duration with `ffprobe` when available.
4. Convert the recording to speech-oriented MP3 chunks with `ffmpeg`.
5. Use mono audio, a speech-friendly sample rate, and a conservative bitrate.
6. Split into fixed time chunks, initially 10 minutes per chunk.
7. Verify every chunk is below the OpenAI-safe chunk limit.
8. If any chunk is still too large, retry preparation with shorter chunk duration or lower bitrate.
9. Transcribe chunks sequentially with `gpt-4o-mini-transcribe`.
10. Combine chunk transcripts in chronological order with simple part separators.
11. Save `meeting.transcript`, `meeting.transcript_source = "openai_audio"`, transcript metadata, and final processing status.
12. Delete all temporary source and chunk files in success and failure paths.

The first release should transcribe chunks sequentially, not in parallel. Sequential processing is slower but safer for rate limits, simpler to reason about, and easier to retry. Parallel chunk transcription can be added later if processing time becomes a real bottleneck.

## Status And Progress

Add `queued` to the meeting AI processing status domain.

Add progress fields to `meeting_ai_processing`:

- `transcription_requested_by_id`
- `transcription_phase`
- `transcription_progress_percent`
- `transcription_current_chunk`
- `transcription_total_chunks`
- `transcription_source_bytes`
- `transcription_prepared_bytes`
- `transcription_attempt_count`
- `transcription_last_heartbeat_at`

Recommended phases:

- `queued`
- `downloading`
- `preparing_audio`
- `transcribing`
- `saving`
- `completed`
- `failed`

The frontend can display these phases as:

- `В очереди`
- `Скачиваем запись`
- `Готовим аудио`
- `Транскрибируем 3/8`
- `Сохраняем результат`
- `Транскрипция готова`
- `Ошибка транскрибации`

The existing meeting AI panel should poll the processing endpoint while status is `queued` or `transcribing`. Polling every 5-10 seconds is enough. The global notification bell already polls every 30 seconds and can surface completion after the user leaves the page.

## Notifications

When transcription completes, notify the moderator who started the job.

Create an in-app notification:

- event type: `meeting_transcription_completed`
- recipient: `transcription_requested_by_id`
- title: `Транскрибация готова`
- body: meeting title, transcript character count, and optional duration
- action URL: `/meetings/{meeting_id}`

If that team member has `telegram_id`, also send a personal Telegram message through the existing aiogram bot.

Recommended Telegram success message:

```text
Транскрибация готова ✅

Встреча: {meeting_title}
Текст: {character_count} символов

Открыть встречу: {frontend_url}/meetings/{meeting_id}
```

On failure, send both in-app and Telegram notifications with a short safe error message and the same meeting link.

Notifications should be best-effort. A Telegram send failure must not roll back a successfully saved transcript.

## Error Handling

Expected user-facing failure cases:

- Zoom recording is not available.
- Zoom audio download fails.
- `ffmpeg` is missing or fails to prepare chunks.
- A prepared chunk still exceeds the safe OpenAI size limit after retries.
- OpenAI transcription fails.
- The backend restarts while a job is in progress.

The system should mark processing as `failed`, store a concise error message, and allow the moderator to retry.

For stale jobs, the scheduler should treat `transcribing` rows with an old heartbeat as recoverable unless the attempt count has exceeded the retry limit. A conservative first release can allow two attempts.

## Railway Deployment

Add `ffmpeg` to:

- `backend/Dockerfile`
- root `Dockerfile.railway`

The existing Railway setup uses Dockerfile-based deployment. Installing `ffmpeg` at build time keeps runtime operations simple and does not require a new Railway service.

The backend currently runs FastAPI, Telegram polling, and APScheduler in one process. The transcription scheduler should follow the same service pattern as existing scheduler services.

## API Changes

Add or update endpoints:

- `POST /api/meetings/{meeting_id}/ai/transcribe-audio`
  - queues a job and returns the processing record;
  - does not perform long transcription work inline.

- `GET /api/meetings/{meeting_id}/ai/processing`
  - returns the current processing record;
  - used by the frontend for progress polling and page reload recovery.

The existing `generate-draft` and `publish` endpoints should keep their current behavior. Draft generation still requires a completed transcript.

## Frontend Behavior

The meeting AI outcomes panel should:

- load the current processing state when the component mounts;
- show the latest status and progress;
- disable duplicate transcription starts while a job is queued or transcribing;
- keep polling while the job is active;
- stop polling when the job reaches `transcript_ready`, `draft_ready`, `published`, or `failed`;
- tell the user that they can leave the page and will be notified;
- refresh the meeting after transcript completion so the transcript tab shows the new text.

The button copy should avoid implying immediate completion. After queueing, the success toast can say:

`Транскрибация запущена. Можно закрыть страницу — мы пришлём уведомление.`

## Testing Strategy

Backend tests should cover:

- queueing a transcription stores requester and progress state;
- duplicate clicks do not create duplicate active jobs;
- scheduler claims only one job at a time;
- temporary files are deleted on success and failure;
- oversized input is prepared into safe chunks instead of rejected immediately;
- OpenAI transcription is called once per prepared chunk;
- chunk transcripts are combined in order;
- completion updates meeting transcript and processing metadata;
- failures mark processing as failed and allow retry;
- in-app and Telegram notifications are attempted for the requester;
- missing Telegram id does not fail the job.

Frontend tests should cover:

- active status rendering;
- duplicate start button disabling;
- polling until completion;
- error status rendering;
- completed transcription refresh path.

Manual verification should include:

- a short recording under 25 MB;
- a simulated or real recording above 25 MB;
- a retry after forced failure;
- Railway build confirmation that `ffmpeg` is available in the backend image.

## Rollout

The first release should keep the old Zoom text transcript fetch path as a separate fallback. Audio transcription should use the new queue and chunking pipeline.

If Railway resource use becomes a problem, the same database-backed job model can later move to a separate Railway background worker service without changing the user-facing workflow.
