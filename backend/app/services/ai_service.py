import asyncio
import json
import logging
import re
from abc import ABC, abstractmethod
from datetime import date

import anthropic
import openai
from google import genai
from google.genai import types as genai_types
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import TeamMember
from app.db.repositories import AIFeatureConfigRepository, AppSettingsRepository

logger = logging.getLogger(__name__)


# ── Pydantic models for parsed results ──


class ParsedTask(BaseModel):
    title: str
    description: str | None = None
    assignee_name: str | None = None
    priority: str = "medium"
    deadline: str | None = None  # YYYY-MM-DD


class ParsedMeeting(BaseModel):
    title: str
    summary: str
    decisions: list[str] = []
    tasks: list[ParsedTask] = []
    participants: list[str] = []


class ParsedVoiceTask(BaseModel):
    title: str
    description: str | None = None
    assignee_name: str | None = None
    priority: str = "medium"
    deadline: str | None = None  # YYYY-MM-DD
    reminder_at: str | None = None  # YYYY-MM-DDTHH:MM
    reminder_comment: str | None = None


# ── AI Prompts ──


MEETING_SUMMARY_PROMPT = """Ты — ассистент для извлечения задач из протоколов встреч (Zoom AI Summary).

Участники команды (JSON):
{team_members_json}

Проанализируй текст протокола встречи и извлеки структурированные данные.
Ответь строго в формате JSON (без markdown-обёртки):

{{
  "title": "краткое название встречи (до 100 символов)",
  "summary": "краткое резюме встречи (2-5 предложений)",
  "decisions": ["решение 1", "решение 2"],
  "tasks": [
    {{
      "title": "название задачи (до 100 символов)",
      "description": "описание если есть контекст, иначе null",
      "assignee_name": "имя исполнителя из списка участников или null",
      "priority": "low | medium | high | urgent",
      "deadline": "YYYY-MM-DD или null"
    }}
  ],
  "participants": ["Имя Фамилия участника 1", "Имя Фамилия участника 2"]
}}

Правила:
- Извлекай ТОЛЬКО конкретные задачи с действием (не общие обсуждения).
- Сопоставляй имена исполнителей со списком участников. Учитывай варианты имён (name_variants).
  Если имя не найдено в списке, оставь assignee_name = null.
- Определяй приоритет по контексту: "срочно", "критично" -> urgent/high;
  "когда будет время", "по возможности" -> low.
- Извлекай дедлайны из фраз: "до пятницы", "к 1 марта", "на следующей неделе".
  Сегодня: {today}.
- Если задач нет — верни пустой список tasks.
- Participants — имена всех упомянутых людей на встрече.
"""

VOICE_TASK_PROMPT = """Ты — ассистент для создания задач из голосовых сообщений.

Пользователь: {author_name}
Роль: {role_label}

Участники команды (JSON):
{team_members_json}

Из текста извлеки задачу. Ответь строго в формате JSON (без markdown-обёртки):

{{
  "title": "краткое название задачи до 100 символов",
  "description": "описание если есть дополнительный контекст, иначе null",
  "assignee_name": "имя исполнителя если упомянут, иначе null",
  "priority": "low | medium | high | urgent",
  "deadline": "YYYY-MM-DD если упомянут, иначе null",
  "reminder_at": "YYYY-MM-DDTHH:MM если есть явное напоминание с датой и временем, иначе null",
  "reminder_comment": "краткий комментарий к напоминанию (что проверить/сделать), иначе null"
}}

Правила:
- Если пользователь может назначать задачи другим участникам и упомянул другого человека,
  сопоставь имя с участниками команды (учитывай name_variants). Если не найден — null.
- Если пользователь не может назначать задачи другим участникам,
  assignee_name ВСЕГДА null (задача будет назначена на него самого).
- Определи приоритет по контексту: "срочно", "важно", "критично" -> high/urgent;
  "когда будет время", "не горит" -> low; по умолчанию -> medium.
- Извлеки дедлайн из фраз: "до пятницы", "к 1 марта", "на этой неделе".
  Сегодня: {today}.
- Если в тексте есть просьба напомнить (например, "напомни завтра в 15:00"),
  заполни reminder_at в формате YYYY-MM-DDTHH:MM.
- Если для напоминания нет явного времени, reminder_at = null.
- reminder_comment заполняй только если есть понятный контекст для комментария.
- title должен быть кратким и конкретным — описание действия.
"""

MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0
OPENAI_MAX_TOKENS = 1400
MEETING_SUMMARY_OPENAI_MODEL = "gpt-4o-mini"
MEETING_CHUNK_CHARS_DEFAULT = 8000
MEETING_CHUNK_CHARS_MINI = 10000
MEETING_CHUNK_OVERLAP_CHARS = 1200
MEETING_MAX_CHUNKS = 24


# ── Abstract provider ──


class AIProvider(ABC):
    @abstractmethod
    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        """Send a request and get a text response."""


# ── Concrete providers ──


class AnthropicProvider(AIProvider):
    def __init__(self, api_key: str, model: str):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return response.content[0].text


class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str):
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = model

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            max_tokens=OPENAI_MAX_TOKENS,
            temperature=0.1,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content


class GeminiProvider(AIProvider):
    def __init__(self, api_key: str, model: str):
        self.client = genai.Client(api_key=api_key)
        self.model = model

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=user_prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
            ),
        )
        return response.text


# ── Main AI Service ──


class AIService:
    """Delegates to the current AI provider from app_settings."""

    def __init__(self):
        self.provider_factories: dict[str, callable] = {}
        if settings.ANTHROPIC_API_KEY:
            self.provider_factories["anthropic"] = (
                lambda model: AnthropicProvider(settings.ANTHROPIC_API_KEY, model)
            )
        if settings.OPENAI_API_KEY:
            self.provider_factories["openai"] = (
                lambda model: OpenAIProvider(settings.OPENAI_API_KEY, model)
            )
        if settings.GOOGLE_API_KEY:
            self.provider_factories["gemini"] = (
                lambda model: GeminiProvider(settings.GOOGLE_API_KEY, model)
            )

    async def _get_current_provider(
        self, session: AsyncSession, feature_key: str | None = None
    ) -> AIProvider:
        """Read current provider and instantiate.

        If feature_key is given, reads from ai_feature_config table (with default fallback).
        Otherwise falls back to legacy app_settings for backward compatibility.

        Falls back to first available provider when the configured one
        has no API key (e.g. seed defaults to anthropic but only openai key is set).
        """
        if not self.provider_factories:
            raise ValueError("Нет доступных AI-провайдеров (не заданы API ключи)")

        provider_name = None
        model = None

        # Try per-feature config first
        if feature_key:
            config_repo = AIFeatureConfigRepository()
            config = await config_repo.get_with_default_fallback(session, feature_key)
            if config and config.provider:
                provider_name = config.provider
                model = config.model

        # Fall back to legacy app_settings
        if not provider_name:
            settings_repo = AppSettingsRepository()
            setting = await settings_repo.get(session, "ai_provider")
            if not setting:
                raise ValueError("AI provider not configured")
            provider_name = setting.value["provider"]
            model = setting.value["model"]

        if provider_name not in self.provider_factories:
            fallback_name = next(iter(self.provider_factories))
            settings_repo = AppSettingsRepository()
            config_setting = await settings_repo.get(session, "ai_providers_config")
            fallback_model = model
            if config_setting and fallback_name in config_setting.value:
                fallback_model = config_setting.value[fallback_name].get("default", model)

            logger.critical(
                "AI PROVIDER FALLBACK: %s недоступен (нет API ключа), "
                "автоматически переключено на %s/%s. "
                "Проверьте конфигурацию AI-провайдера!",
                provider_name, fallback_name, fallback_model,
            )
            provider_name, model = fallback_name, fallback_model

        return self.provider_factories[provider_name](model)

    async def get_current_provider_info(self, session: AsyncSession) -> dict:
        """Return current provider name and model."""
        settings_repo = AppSettingsRepository()
        setting = await settings_repo.get(session, "ai_provider")
        if not setting:
            return {"provider": "not configured", "model": ""}
        return {"provider": setting.value["provider"], "model": setting.value["model"]}

    def get_available_providers(self) -> dict[str, bool]:
        """Return which providers have API keys configured."""
        return {name: True for name in self.provider_factories}

    async def _complete_with_retry(
        self, provider: AIProvider, system_prompt: str, user_prompt: str
    ) -> str:
        """Call provider.complete with exponential backoff retry."""
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                return await provider.complete(system_prompt, user_prompt)
            except Exception as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(
                        f"AI request failed (attempt {attempt + 1}/{MAX_RETRIES}): {e}. "
                        f"Retrying in {delay}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"AI request failed after {MAX_RETRIES} attempts: {e}")
        raise last_error

    @staticmethod
    def _extract_json(text: str) -> dict:
        """Strip ```json``` wrapper and parse JSON."""
        text = text.strip()
        # Remove markdown code fences
        if text.startswith("```"):
            # Remove first line (```json or ```)
            text = re.sub(r"^```(?:json)?\s*\n?", "", text)
            text = re.sub(r"\n?```\s*$", "", text)
        return json.loads(text)

    @staticmethod
    def _prepare_meeting_text(text: str) -> str:
        """Normalize transcript formatting while preserving full content."""
        return re.sub(r"\n{3,}", "\n\n", text).strip()

    @staticmethod
    def _split_meeting_text(
        text: str,
        model_hint: str | None = None,
    ) -> list[str]:
        """Split transcript into overlapping chunks so middle content is never dropped."""
        chunk_chars = (
            MEETING_CHUNK_CHARS_MINI
            if model_hint == MEETING_SUMMARY_OPENAI_MODEL
            else MEETING_CHUNK_CHARS_DEFAULT
        )

        if len(text) <= chunk_chars:
            return [text]

        chunks: list[str] = []
        start = 0
        total_len = len(text)

        while start < total_len:
            hard_end = min(start + chunk_chars, total_len)
            end = hard_end

            # Prefer cutting near newline to keep semantic boundaries.
            if hard_end < total_len:
                search_from = max(start + int(chunk_chars * 0.55), start)
                newline_idx = text.rfind("\n", search_from, hard_end)
                if newline_idx != -1:
                    end = newline_idx

            if end <= start:
                end = hard_end

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
                if len(chunks) > MEETING_MAX_CHUNKS:
                    raise ValueError(
                        "Транскрипция слишком длинная для обработки одним запуском. "
                        "Разделите встречу на части и обработайте по очереди."
                    )

            if end >= total_len:
                break
            start = max(end - MEETING_CHUNK_OVERLAP_CHARS, start + 1)

        return chunks

    @staticmethod
    def _norm_text(value: str | None) -> str:
        return re.sub(r"\s+", " ", (value or "").strip().lower())

    @classmethod
    def _merge_parsed_chunks(cls, chunks: list[ParsedMeeting]) -> ParsedMeeting:
        """Deterministically merge chunk-level extraction results without losing tasks."""
        title = ""
        summary_parts: list[str] = []
        summary_seen: set[str] = set()

        decisions: list[str] = []
        decisions_seen: set[str] = set()

        participants: list[str] = []
        participants_seen: set[str] = set()

        tasks: list[ParsedTask] = []
        task_index_by_key: dict[tuple[str, str, str], int] = {}
        task_index_by_title_assignee: dict[tuple[str, str], int] = {}
        priority_rank = {"low": 1, "medium": 2, "high": 3, "urgent": 4}

        for chunk in chunks:
            if not title and chunk.title.strip():
                title = chunk.title.strip()

            chunk_summary = chunk.summary.strip()
            summary_key = cls._norm_text(chunk_summary)
            if chunk_summary and summary_key and summary_key not in summary_seen:
                summary_seen.add(summary_key)
                summary_parts.append(chunk_summary)

            for decision in chunk.decisions:
                key = cls._norm_text(decision)
                if not key or key in decisions_seen:
                    continue
                decisions_seen.add(key)
                decisions.append(decision.strip())

            for participant in chunk.participants:
                key = cls._norm_text(participant)
                if not key or key in participants_seen:
                    continue
                participants_seen.add(key)
                participants.append(participant.strip())

            for task in chunk.tasks:
                title_key = cls._norm_text(task.title)
                if not title_key:
                    continue
                assignee_key = cls._norm_text(task.assignee_name)
                deadline_key = (task.deadline or "").strip()
                key = (title_key, assignee_key, deadline_key)
                weak_key = (title_key, assignee_key)

                existing_idx = task_index_by_key.get(key)
                if existing_idx is None:
                    existing_idx = task_index_by_title_assignee.get(weak_key)

                if existing_idx is None:
                    idx = len(tasks)
                    task_index_by_key[key] = idx
                    if weak_key not in task_index_by_title_assignee:
                        task_index_by_title_assignee[weak_key] = idx
                    tasks.append(task)
                    continue

                # Merge sparse duplicates by keeping the richer version.
                existing = tasks[existing_idx]
                if (not existing.description) and task.description:
                    existing.description = task.description
                if (not existing.assignee_name) and task.assignee_name:
                    existing.assignee_name = task.assignee_name
                if (not existing.deadline) and task.deadline:
                    existing.deadline = task.deadline
                if priority_rank.get(task.priority, 2) > priority_rank.get(existing.priority, 2):
                    existing.priority = task.priority

        if not title:
            title = "Итоги встречи"

        summary = " ".join(summary_parts[:4]).strip()
        if not summary:
            summary = "Ключевые итоги встречи извлечены из полной транскрипции."

        return ParsedMeeting(
            title=title,
            summary=summary,
            decisions=decisions,
            tasks=tasks,
            participants=participants,
        )

    async def parse_meeting_summary(
        self,
        session: AsyncSession,
        summary_text: str,
        team_members: list[TeamMember],
    ) -> ParsedMeeting:
        """Parse Zoom Summary via current AI provider."""
        provider = await self._get_current_provider(session, feature_key="meetings_summary")
        if (
            isinstance(provider, OpenAIProvider)
            and provider.model != MEETING_SUMMARY_OPENAI_MODEL
        ):
            logger.info(
                "Meeting summary parse uses %s instead of configured OpenAI model %s",
                MEETING_SUMMARY_OPENAI_MODEL,
                provider.model,
            )
            provider = OpenAIProvider(
                api_key=settings.OPENAI_API_KEY,
                model=MEETING_SUMMARY_OPENAI_MODEL,
            )

        model_hint = provider.model if hasattr(provider, "model") else None

        team_json = json.dumps(
            [
                {"name": m.full_name, "variants": m.name_variants or []}
                for m in team_members
            ],
            ensure_ascii=False,
        )

        system_prompt = MEETING_SUMMARY_PROMPT.format(
            team_members_json=team_json,
            today=date.today().isoformat(),
        )

        prepared_text = self._prepare_meeting_text(summary_text)
        chunks = self._split_meeting_text(prepared_text, model_hint=model_hint)
        logger.info(
            "Meeting summary parse started (chunks=%s, total_chars=%s, model=%s)",
            len(chunks),
            len(prepared_text),
            model_hint or "unknown",
        )

        parsed_chunks: list[ParsedMeeting] = []
        for idx, chunk in enumerate(chunks, start=1):
            response = await self._complete_with_retry(provider, system_prompt, chunk)
            try:
                data = self._extract_json(response)
                parsed_chunks.append(ParsedMeeting(**data))
            except (json.JSONDecodeError, ValueError) as e:
                logger.error(
                    "Failed to parse AI chunk %s/%s as ParsedMeeting: %s\nResponse: %s",
                    idx,
                    len(chunks),
                    e,
                    response,
                )
                raise ValueError(
                    f"AI вернул некорректный ответ на части {idx}/{len(chunks)}: {e}"
                )

        merged = self._merge_parsed_chunks(parsed_chunks)
        logger.info(
            "Meeting summary parse merged (chunks=%s, tasks=%s, decisions=%s, participants=%s)",
            len(chunks),
            len(merged.tasks),
            len(merged.decisions),
            len(merged.participants),
        )
        return merged

    async def parse_task_from_text(
        self,
        session: AsyncSession,
        text: str,
        author_name: str,
        can_assign_to_others: bool,
        team_members: list[TeamMember],
    ) -> ParsedVoiceTask:
        """Extract task from arbitrary text (after STT). Used in Phase 6."""
        provider = await self._get_current_provider(session)

        team_json = json.dumps(
            [
                {"name": m.full_name, "variants": m.name_variants or []}
                for m in team_members
            ],
            ensure_ascii=False,
        )

        system_prompt = VOICE_TASK_PROMPT.format(
            author_name=author_name,
            role_label=(
                "может назначать задачи другим участникам"
                if can_assign_to_others
                else "назначает задачи только себе"
            ),
            team_members_json=team_json,
            today=date.today().isoformat(),
        )

        response = await self._complete_with_retry(provider, system_prompt, text)

        try:
            data = self._extract_json(response)
            return ParsedVoiceTask(**data)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse AI response as ParsedVoiceTask: {e}\nResponse: {response}")
            raise ValueError(f"AI вернул некорректный ответ: {e}")

    async def complete_for_feature(
        self,
        session: AsyncSession,
        feature_key: str,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """Generic completion using a per-feature AI provider. Used by Content module."""
        provider = await self._get_current_provider(session, feature_key=feature_key)
        return await self._complete_with_retry(provider, system_prompt, user_prompt)
