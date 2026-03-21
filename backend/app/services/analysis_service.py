"""Service for running LLM analysis on downloaded Telegram content.

Handles: content loading, token estimation, chunking, multi-chunk synthesis,
progress tracking, result storage.

IMPORTANT: DB sessions are opened/closed for each DB operation to avoid
holding connections idle during long AI API calls (Supabase PgBouncer
drops idle connections after ~60s).
"""

import logging
import uuid
from datetime import date, datetime
from typing import Any, Callable, Coroutine

from app.db.database import async_session
from app.db.models import AnalysisStatus
from app.db.repositories import (
    AIFeatureConfigRepository,
    AnalysisPromptRepository,
    AnalysisRunRepository,
    TelegramChannelRepository,
    TelegramContentRepository,
)
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

# Token estimation: chars per token varies by provider and script.
# OpenAI BPE tokenizer is less efficient with Cyrillic: ~2.5 chars/token.
# Anthropic/Gemini tokenizers handle Cyrillic better: ~3.5 chars/token.
CHARS_PER_TOKEN_BY_PROVIDER = {
    "openai": 2.5,
    "anthropic": 3.5,
    "gemini": 3.5,
}
FALLBACK_CHARS_PER_TOKEN = 2.5  # Conservative default

# Reserve 30% of context for output
OUTPUT_RESERVE_RATIO = 0.30

# Default context windows by provider (conservative estimates)
DEFAULT_CONTEXT_WINDOWS = {
    "anthropic": 200_000,
    "openai": 128_000,
    "gemini": 1_000_000,
}
FALLBACK_CONTEXT_WINDOW = 100_000

# Maximum input tokens per single API request.
# Prevents exceeding TPM (tokens-per-minute) rate limits on lower-tier plans.
# OpenAI gpt-4o Tier 1: 30K TPM — use 20K to leave headroom.
# OpenAI gpt-4o-mini: 200K TPM — can use 60K safely.
MAX_INPUT_TOKENS_PER_REQUEST = {
    "openai": 20_000,
    "anthropic": 150_000,
    "gemini": 800_000,
}
# Higher limits for lightweight/mini models with larger TPM allowances
MAX_INPUT_TOKENS_MINI_MODELS = {
    "openai": 60_000,
}
MINI_MODEL_PATTERNS = ("mini", "gpt-4o-mini", "gpt-3.5")
FALLBACK_MAX_INPUT_TOKENS = 20_000

# Output token limit for analysis (much higher than default 1400 for short tasks)
ANALYSIS_MAX_OUTPUT_TOKENS = 4096

# Chunk overlap
CHUNK_OVERLAP_CHARS = 500

FEATURE_KEY = "telegram_analysis"

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
        run_id: uuid.UUID,
        channel_ids: list[uuid.UUID],
        date_from: date,
        date_to: date,
        content_type: str,
        prompt_text: str,
        progress_callback: ProgressCallback | None = None,
    ) -> str:
        """Execute full analysis pipeline: load content → chunk → LLM calls → synthesis.

        Uses short-lived DB sessions for each DB operation.
        AI API calls happen without any open DB session.
        Returns the final Markdown result.
        """
        try:
            # Step 1: Update status + load content + resolve config (short session)
            async with async_session() as session:
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
                        completed_at=datetime.utcnow(),
                    )
                    await session.commit()
                    return result

                # Build channel name lookup
                channel_names = {}
                for ch_id in channel_ids:
                    ch = await self._channel_repo.get_by_id(session, ch_id)
                    if ch:
                        channel_names[str(ch.id)] = ch.display_name

                # Determine AI config
                config = await self._config_repo.get_with_default_fallback(session, FEATURE_KEY)
                provider_name = config.provider if config else None
                ai_provider = config.provider if config else None
                ai_model = config.model if config else None

                # Store provider info in run
                if config:
                    await self._run_repo.update_status(
                        session, run_id, AnalysisStatus.analyzing,
                        ai_provider=config.provider, ai_model=config.model,
                    )
                    await session.commit()

            # Session is now CLOSED — safe for long operations

            # Step 2: Format content and chunk (CPU only, no DB)
            formatted = self._format_content(content_items, channel_names)

            if progress_callback:
                await progress_callback({
                    "phase": "analyzing",
                    "detail": f"Loaded {len(content_items)} messages ({len(formatted)} chars)",
                    "progress": 0,
                })

            context_window = DEFAULT_CONTEXT_WINDOWS.get(provider_name, FALLBACK_CONTEXT_WINDOW)
            context_based_tokens = int(context_window * (1 - OUTPUT_RESERVE_RATIO))

            # Use higher TPM limits for mini/lightweight models
            is_mini = ai_model and any(p in ai_model.lower() for p in MINI_MODEL_PATTERNS)
            if is_mini and provider_name in MAX_INPUT_TOKENS_MINI_MODELS:
                tpm_based_tokens = MAX_INPUT_TOKENS_MINI_MODELS[provider_name]
            else:
                tpm_based_tokens = MAX_INPUT_TOKENS_PER_REQUEST.get(
                    provider_name, FALLBACK_MAX_INPUT_TOKENS
                )
            max_input_tokens = min(context_based_tokens, tpm_based_tokens)
            chars_per_token = CHARS_PER_TOKEN_BY_PROVIDER.get(
                provider_name, FALLBACK_CHARS_PER_TOKEN
            )
            max_input_chars = int(max_input_tokens * chars_per_token)
            chunks = self._split_content(formatted, max_input_chars)

            if progress_callback:
                await progress_callback({
                    "phase": "analyzing",
                    "detail": f"Processing in {len(chunks)} chunk(s)",
                    "progress": 0,
                    "total_chunks": len(chunks),
                })

            # Step 3: Resolve AI provider ONCE (short session), then call AI without session
            async with async_session() as session:
                provider = await self._ai._get_current_provider(session, feature_key=FEATURE_KEY)

            # Step 4: Process each chunk (NO DB session held during AI calls)
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
                result = await self._ai._complete_with_retry(
                    provider, ANALYSIS_SYSTEM_PROMPT, user_prompt,
                    max_tokens=ANALYSIS_MAX_OUTPUT_TOKENS,
                )
                chunk_results.append(result)

            # Step 5: Synthesis if multiple chunks (NO DB session)
            if len(chunk_results) > 1:
                if progress_callback:
                    await progress_callback({
                        "phase": "synthesizing",
                        "detail": "Consolidating results from all chunks",
                        "progress": 90,
                    })

                final_result = await self._synthesize_results(
                    provider, chunk_results, prompt_text, max_input_chars
                )
            else:
                final_result = chunk_results[0]

            # Step 6: Save result (short session)
            async with async_session() as session:
                await self._run_repo.update_status(
                    session, run_id, AnalysisStatus.completed,
                    result_markdown=final_result,
                    completed_at=datetime.utcnow(),
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
            # Use fresh session for error status update
            try:
                async with async_session() as session:
                    await self._run_repo.update_status(
                        session, run_id, AnalysisStatus.failed,
                        error_message=str(e)[:1000],
                        completed_at=datetime.utcnow(),
                    )
                    await session.commit()
            except Exception:
                logger.warning("Failed to update run status after error")
            if progress_callback:
                await progress_callback({
                    "phase": "error",
                    "detail": str(e)[:500],
                    "progress": 0,
                })
            raise

    async def _synthesize_results(
        self,
        provider,
        chunk_results: list[str],
        prompt_text: str,
        max_input_chars: int,
    ) -> str:
        """Merge partial analysis results, chunking synthesis if needed."""
        synthesis_input = "\n\n---\n\n".join(
            f"## Partial analysis {i+1}/{len(chunk_results)}\n\n{r}"
            for i, r in enumerate(chunk_results)
        )
        user_prompt = (
            f"## Original analysis instructions\n\n{prompt_text}\n\n"
            f"## Partial results to consolidate\n\n{synthesis_input}"
        )

        if len(user_prompt) <= max_input_chars:
            return await self._ai._complete_with_retry(
                provider, SYNTHESIS_SYSTEM_PROMPT, user_prompt,
                max_tokens=ANALYSIS_MAX_OUTPUT_TOKENS,
            )

        # Synthesis input too large — merge in pairs hierarchically
        logger.info(
            "Synthesis input too large (%d chars, limit %d), merging hierarchically",
            len(user_prompt), max_input_chars,
        )
        results = list(chunk_results)
        while len(results) > 1:
            merged: list[str] = []
            for i in range(0, len(results), 2):
                if i + 1 < len(results):
                    pair_input = (
                        f"## Partial analysis A\n\n{results[i]}\n\n---\n\n"
                        f"## Partial analysis B\n\n{results[i+1]}"
                    )
                    pair_prompt = (
                        f"## Original analysis instructions\n\n{prompt_text}\n\n"
                        f"## Partial results to consolidate\n\n{pair_input}"
                    )
                    merged.append(
                        await self._ai._complete_with_retry(
                            provider, SYNTHESIS_SYSTEM_PROMPT, pair_prompt,
                            max_tokens=ANALYSIS_MAX_OUTPUT_TOKENS,
                        )
                    )
                else:
                    merged.append(results[i])
            results = merged

        return results[0]

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
