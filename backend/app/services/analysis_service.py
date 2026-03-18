"""Service for running LLM analysis on downloaded Telegram content.

Handles: content loading, token estimation, chunking, multi-chunk synthesis,
progress tracking, result storage.
"""

import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any, Callable, Coroutine

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AnalysisContentType, AnalysisStatus
from app.db.repositories import (
    AIFeatureConfigRepository,
    AnalysisPromptRepository,
    AnalysisRunRepository,
    TelegramChannelRepository,
    TelegramContentRepository,
)
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

# Token estimation: ~4 chars per token for Russian text
CHARS_PER_TOKEN = 4

# Reserve 30% of context for output
OUTPUT_RESERVE_RATIO = 0.30

# Default context windows by provider (conservative estimates)
DEFAULT_CONTEXT_WINDOWS = {
    "anthropic": 200_000,
    "openai": 128_000,
    "gemini": 1_000_000,
}
FALLBACK_CONTEXT_WINDOW = 100_000

# Chunk overlap
CHUNK_OVERLAP_CHARS = 500

FEATURE_KEY = "telegram_content_analysis"

ProgressCallback = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]


ANALYSIS_SYSTEM_PROMPT = """You are a professional analyst processing Telegram channel content.

Analyze the provided posts/comments and produce a detailed report in Markdown format.
Use the language of the content (likely Russian).

Follow the user's instructions (prompt) precisely.
Structure your response with clear headings, bullet points, and quotes where relevant.
If the content contains multiple topics, organize by topic.
Be thorough but concise — focus on insights, not restating raw content."""

SYNTHESIS_SYSTEM_PROMPT = """You are a professional analyst consolidating partial analysis results.

You received multiple partial analyses of Telegram channel content (processed in chunks).
Merge them into a single coherent report in Markdown format.
Use the language of the partial reports.

Rules:
- Remove duplicate information across chunks
- Preserve all unique insights, quotes, and data points
- Create a unified structure with clear headings
- If chunks cover different time periods or topics, organize chronologically or by topic
- Keep the tone analytical and professional"""


class AnalysisService:
    """Runs LLM analysis on downloaded Telegram content."""

    def __init__(self, ai_service: AIService):
        self._ai = ai_service
        self._content_repo = TelegramContentRepository()
        self._channel_repo = TelegramChannelRepository()
        self._prompt_repo = AnalysisPromptRepository()
        self._run_repo = AnalysisRunRepository()
        self._config_repo = AIFeatureConfigRepository()

    async def run_analysis(
        self,
        session: AsyncSession,
        run_id: uuid.UUID,
        channel_ids: list[uuid.UUID],
        date_from: date,
        date_to: date,
        content_type: str,
        prompt_text: str,
        progress_callback: ProgressCallback | None = None,
    ) -> str:
        """Execute full analysis pipeline: load content → chunk → LLM calls → synthesis.

        Updates analysis_run status at each step.
        Returns the final Markdown result.
        """
        try:
            # Update status to analyzing
            await self._run_repo.update_status(session, run_id, AnalysisStatus.analyzing)
            await session.commit()

            # Load content from DB
            dt_from = datetime.combine(date_from, datetime.min.time())
            dt_to = datetime.combine(date_to, datetime.max.time())

            ct_filter = None if content_type == "all" else content_type
            content_items = await self._content_repo.get_by_channel_and_date_range(
                session, channel_ids, dt_from, dt_to, ct_filter
            )

            if not content_items:
                result = "# No content found\n\nNo messages found for the specified channels and date range."
                await self._run_repo.update_status(
                    session, run_id, AnalysisStatus.completed,
                    result_markdown=result,
                    completed_at=datetime.now(timezone.utc),
                )
                await session.commit()
                return result

            # Build channel name lookup
            channel_names = {}
            for ch_id in channel_ids:
                ch = await self._channel_repo.get_by_id(session, ch_id)
                if ch:
                    channel_names[str(ch.id)] = ch.display_name

            # Format content for LLM
            formatted = self._format_content(content_items, channel_names)

            if progress_callback:
                await progress_callback({
                    "phase": "analyzing",
                    "detail": f"Loaded {len(content_items)} messages ({len(formatted)} chars)",
                    "progress": 0,
                })

            # Determine context window and chunk
            config = await self._config_repo.get_with_default_fallback(session, FEATURE_KEY)
            provider_name = config.provider if config else None
            context_window = DEFAULT_CONTEXT_WINDOWS.get(provider_name, FALLBACK_CONTEXT_WINDOW)
            max_input_tokens = int(context_window * (1 - OUTPUT_RESERVE_RATIO))
            max_input_chars = max_input_tokens * CHARS_PER_TOKEN

            # Store provider info in run
            if config:
                await self._run_repo.update_status(
                    session, run_id, AnalysisStatus.analyzing,
                    ai_provider=config.provider, ai_model=config.model,
                )
                await session.commit()

            chunks = self._split_content(formatted, max_input_chars)

            if progress_callback:
                await progress_callback({
                    "phase": "analyzing",
                    "detail": f"Processing in {len(chunks)} chunk(s)",
                    "progress": 0,
                    "total_chunks": len(chunks),
                })

            # Process each chunk
            chunk_results: list[str] = []
            for idx, chunk in enumerate(chunks, start=1):
                if progress_callback:
                    await progress_callback({
                        "phase": "analyzing",
                        "detail": f"Analyzing chunk {idx}/{len(chunks)}",
                        "progress": int((idx - 1) / len(chunks) * 100),
                        "chunk": idx,
                        "total_chunks": len(chunks),
                    })

                user_prompt = f"## Analysis instructions\n\n{prompt_text}\n\n## Content to analyze\n\n{chunk}"
                result = await self._ai.complete_for_feature(
                    session, FEATURE_KEY, ANALYSIS_SYSTEM_PROMPT, user_prompt
                )
                chunk_results.append(result)

            # Synthesis if multiple chunks
            if len(chunk_results) > 1:
                if progress_callback:
                    await progress_callback({
                        "phase": "synthesizing",
                        "detail": "Consolidating results from all chunks",
                        "progress": 90,
                    })

                synthesis_input = "\n\n---\n\n".join(
                    f"## Partial analysis {i+1}/{len(chunk_results)}\n\n{r}"
                    for i, r in enumerate(chunk_results)
                )
                user_prompt = (
                    f"## Original analysis instructions\n\n{prompt_text}\n\n"
                    f"## Partial results to consolidate\n\n{synthesis_input}"
                )
                final_result = await self._ai.complete_for_feature(
                    session, FEATURE_KEY, SYNTHESIS_SYSTEM_PROMPT, user_prompt
                )
            else:
                final_result = chunk_results[0]

            # Save result
            await self._run_repo.update_status(
                session, run_id, AnalysisStatus.completed,
                result_markdown=final_result,
                completed_at=datetime.now(timezone.utc),
            )
            await session.commit()

            if progress_callback:
                await progress_callback({
                    "phase": "completed",
                    "detail": "Analysis completed",
                    "progress": 100,
                    "run_id": str(run_id),
                })

            logger.info(
                "Analysis %s completed: %d messages, %d chunks, %d chars result",
                run_id, len(content_items), len(chunks), len(final_result),
            )
            return final_result

        except Exception as e:
            logger.error("Analysis %s failed: %s", run_id, e)
            # Session may be in a broken state — rollback before updating
            try:
                await session.rollback()
                await self._run_repo.update_status(
                    session, run_id, AnalysisStatus.failed,
                    error_message=str(e)[:1000],
                    completed_at=datetime.now(timezone.utc),
                )
                await session.commit()
            except Exception:
                logger.warning("Failed to update run status via existing session, will retry with fresh session")
                # Let the outer handler in analysis.py create a fresh session
            if progress_callback:
                await progress_callback({
                    "phase": "error",
                    "detail": str(e)[:500],
                    "progress": 0,
                })
            raise

    @staticmethod
    def _format_content(content_items, channel_names: dict[str, str]) -> str:
        """Format content items into a single text block for LLM."""
        lines = []
        current_channel = None

        for item in content_items:
            ch_id = str(item.channel_id)
            if ch_id != current_channel:
                current_channel = ch_id
                ch_name = channel_names.get(ch_id, "Unknown")
                lines.append(f"\n### Channel: {ch_name}\n")

            date_str = item.message_date.strftime("%Y-%m-%d %H:%M")
            type_label = "💬" if item.content_type.value == "comment" else "📝"
            lines.append(f"[{date_str}] {type_label} {item.text}\n")

        return "\n".join(lines)

    @staticmethod
    def _split_content(text: str, max_chars: int) -> list[str]:
        """Split formatted content into chunks respecting max_chars."""
        if len(text) <= max_chars:
            return [text]

        chunks = []
        start = 0

        while start < len(text):
            end = min(start + max_chars, len(text))

            # Try to cut at a message boundary (newline)
            if end < len(text):
                newline_pos = text.rfind("\n[", start + int(max_chars * 0.5), end)
                if newline_pos > start:
                    end = newline_pos

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            if end >= len(text):
                break
            start = max(end - CHUNK_OVERLAP_CHARS, start + 1)

        return chunks
