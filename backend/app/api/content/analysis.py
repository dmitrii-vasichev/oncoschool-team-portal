"""Analysis API for Content module: prepare, run, stream, history, results."""

import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_content_operator, require_content_operator_query
from app.api.schemas.content import (
    AnalysisHistoryResponse,
    AnalysisPrepareRequest,
    AnalysisPrepareResponse,
    AnalysisRunRequest,
    AnalysisRunResponse,
    ChannelPrepareSummary,
)
from app.db.database import async_session, get_session
from app.db.models import AnalysisStatus, ContentSubSection, TeamMember
from app.db.repositories import AnalysisPromptRepository, AnalysisRunRepository
from app.services.ai_service import AIService
from app.services.analysis_service import AnalysisService
from app.services.telegram_download_service import (
    ChannelLockError,
    TelegramDownloadService,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["content-analysis"])

_operator = require_content_operator(ContentSubSection.telegram_analysis)
_operator_query = require_content_operator_query(ContentSubSection.telegram_analysis)
_run_repo = AnalysisRunRepository()
_prompt_repo = AnalysisPromptRepository()

# In-memory SSE event queues per run_id
_sse_queues: dict[uuid.UUID, asyncio.Queue] = {}


def _get_or_create_queue(run_id: uuid.UUID) -> asyncio.Queue:
    if run_id not in _sse_queues:
        _sse_queues[run_id] = asyncio.Queue()
    return _sse_queues[run_id]


def _cleanup_queue(run_id: uuid.UUID) -> None:
    _sse_queues.pop(run_id, None)


def _run_response(run) -> AnalysisRunResponse:
    return AnalysisRunResponse(
        id=run.id,
        channels=run.channels,
        date_from=run.date_from,
        date_to=run.date_to,
        content_type=run.content_type.value if hasattr(run.content_type, "value") else str(run.content_type),
        prompt_id=run.prompt_id,
        prompt_snapshot=run.prompt_snapshot,
        ai_provider=run.ai_provider,
        ai_model=run.ai_model,
        result_markdown=run.result_markdown,
        status=run.status.value if hasattr(run.status, "value") else str(run.status),
        error_message=run.error_message,
        run_by_id=run.run_by_id,
        run_by_name=run.run_by.full_name if run.run_by else None,
        created_at=run.created_at,
        completed_at=run.completed_at,
    )


@router.post("/prepare", response_model=AnalysisPrepareResponse)
async def prepare_analysis(
    body: AnalysisPrepareRequest,
    request: Request,
    member: TeamMember = Depends(_operator),
    session: AsyncSession = Depends(get_session),
):
    """Calculate existing vs missing content for the given parameters."""
    telegram_service = request.app.state.telegram_connection_service
    download_service = TelegramDownloadService(telegram_service)

    result = await download_service.prepare_analysis(
        session,
        channel_ids=body.channel_ids,
        date_from=body.date_from,
        date_to=body.date_to,
        content_type=body.content_type,
    )

    return AnalysisPrepareResponse(
        channels=[ChannelPrepareSummary(**ch) for ch in result["channels"]],
        total_existing=result["total_existing"],
        total_estimated_missing=result["total_estimated_missing"],
        telegram_connected=result["telegram_connected"],
    )


@router.post("/run")
async def run_analysis(
    body: AnalysisRunRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    member: TeamMember = Depends(_operator),
    session: AsyncSession = Depends(get_session),
):
    """Start an analysis run as a background task. Returns run_id."""
    # Resolve prompt text
    prompt_text = body.prompt_text
    prompt_id = body.prompt_id

    if prompt_id and not prompt_text:
        prompt = await _prompt_repo.get_by_id(session, prompt_id)
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        prompt_text = prompt.text

    if not prompt_text:
        raise HTTPException(status_code=400, detail="Either prompt_id or prompt_text is required")

    # Create analysis run record
    channel_ids_str = [str(cid) for cid in body.channel_ids]
    async with session.begin_nested():
        run = await _run_repo.create(
            session,
            channels=channel_ids_str,
            date_from=body.date_from,
            date_to=body.date_to,
            content_type=body.content_type,
            prompt_id=prompt_id,
            prompt_snapshot=prompt_text,
            status=AnalysisStatus.preparing,
            run_by_id=member.id,
        )
    await session.commit()

    run_id = run.id

    # Create SSE queue
    queue = _get_or_create_queue(run_id)

    # Launch background task
    background_tasks.add_task(
        _run_analysis_background,
        run_id=run_id,
        channel_ids=body.channel_ids,
        date_from=body.date_from,
        date_to=body.date_to,
        content_type=body.content_type,
        prompt_text=prompt_text,
        telegram_service=request.app.state.telegram_connection_service,
    )

    return {"id": str(run_id)}


async def _run_analysis_background(
    run_id: uuid.UUID,
    channel_ids: list[uuid.UUID],
    date_from,
    date_to,
    content_type: str,
    prompt_text: str,
    telegram_service,
) -> None:
    """Background task: download missing content → run LLM analysis."""
    queue = _get_or_create_queue(run_id)

    async def progress_callback(event: dict) -> None:
        await queue.put(event)

    try:
        # Phase 1: Download — use dedicated session so errors don't poison analysis
        try:
            async with async_session() as dl_session:
                download_service = TelegramDownloadService(telegram_service)

                await _run_repo.update_status(dl_session, run_id, AnalysisStatus.downloading)
                await dl_session.commit()

                try:
                    download_result = await download_service.download_missing(
                        dl_session,
                        channel_ids=channel_ids,
                        date_from=date_from,
                        date_to=date_to,
                        content_type=content_type,
                        progress_callback=progress_callback,
                    )
                    await dl_session.commit()

                    await progress_callback({
                        "phase": "downloading",
                        "detail": f"Download complete: {download_result['total_downloaded']} new messages",
                        "progress": 100,
                    })
                except ChannelLockError as e:
                    await dl_session.rollback()
                    await _run_repo.update_status(
                        dl_session, run_id, AnalysisStatus.failed,
                        error_message=str(e),
                    )
                    await dl_session.commit()
                    await progress_callback({"phase": "error", "detail": str(e)})
                    return
                except ValueError as e:
                    # Telegram not connected — proceed with existing content only
                    await dl_session.rollback()
                    logger.warning("Download skipped: %s. Proceeding with existing content.", e)
                    await progress_callback({
                        "phase": "downloading",
                        "detail": f"Download skipped: {e}. Using existing content.",
                        "progress": 100,
                    })
                except Exception:
                    await dl_session.rollback()
                    raise
        except ChannelLockError:
            return  # Already handled above
        except ValueError:
            pass  # Already handled above — continue to analysis

        # Phase 2: Analysis — fresh session, isolated from download errors
        async with async_session() as an_session:
            ai_service = AIService()
            analysis_service = AnalysisService(ai_service)

            await analysis_service.run_analysis(
                an_session,
                run_id=run_id,
                channel_ids=channel_ids,
                date_from=date_from,
                date_to=date_to,
                content_type=content_type,
                prompt_text=prompt_text,
                progress_callback=progress_callback,
            )

    except Exception as e:
        logger.exception("Background analysis %s failed", run_id)
        try:
            async with async_session() as err_session:
                await _run_repo.update_status(
                    err_session, run_id, AnalysisStatus.failed,
                    error_message=str(e)[:1000],
                )
                await err_session.commit()
        except Exception:
            logger.exception("Failed to update run status after error")

        await queue.put({"phase": "error", "detail": str(e)[:500]})
    finally:
        # Signal end of stream
        await queue.put(None)


@router.get("/{run_id}/stream")
async def stream_analysis_progress(
    run_id: uuid.UUID,
    member: TeamMember = Depends(_operator_query),
    session: AsyncSession = Depends(get_session),
):
    """SSE endpoint for real-time analysis progress."""
    # Verify run exists
    run = await _run_repo.get_by_id(session, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")

    # If already completed/failed, return final status immediately
    if run.status in (AnalysisStatus.completed, AnalysisStatus.failed):
        async def _completed_stream():
            event = {
                "phase": "completed" if run.status == AnalysisStatus.completed else "error",
                "detail": run.error_message or "Analysis completed",
                "run_id": str(run_id),
            }
            yield f"data: {json.dumps(event)}\n\n"

        return StreamingResponse(
            _completed_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    queue = _get_or_create_queue(run_id)

    async def _event_stream():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield ": keepalive\n\n"
                    continue

                if event is None:
                    # End of stream
                    break

                yield f"data: {json.dumps(event)}\n\n"

                if event.get("phase") in ("completed", "error"):
                    break
        finally:
            _cleanup_queue(run_id)

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/history", response_model=AnalysisHistoryResponse)
async def get_history(
    page: int = 1,
    per_page: int = 20,
    member: TeamMember = Depends(_operator),
    session: AsyncSession = Depends(get_session),
):
    """List past analysis runs with pagination."""
    runs, total = await _run_repo.get_history(session, page=page, per_page=per_page)
    return AnalysisHistoryResponse(
        items=[_run_response(r) for r in runs],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{run_id}", response_model=AnalysisRunResponse)
async def get_analysis_run(
    run_id: uuid.UUID,
    member: TeamMember = Depends(_operator),
    session: AsyncSession = Depends(get_session),
):
    """Get full analysis run details including result."""
    run = await _run_repo.get_by_id(session, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    return _run_response(run)


@router.get("/{run_id}/download")
async def download_analysis_result(
    run_id: uuid.UUID,
    member: TeamMember = Depends(_operator),
    session: AsyncSession = Depends(get_session),
):
    """Download analysis result as a Markdown file."""
    run = await _run_repo.get_by_id(session, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    if not run.result_markdown:
        raise HTTPException(status_code=400, detail="Analysis has no result yet")

    filename = f"analysis_{run.date_from}_{run.date_to}.md"

    return StreamingResponse(
        iter([run.result_markdown.encode("utf-8")]),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
