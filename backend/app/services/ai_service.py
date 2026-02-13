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
from app.db.repositories import AppSettingsRepository

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
  "deadline": "YYYY-MM-DD если упомянут, иначе null"
}}

Правила:
- Если пользователь — участник (не модератор), assignee_name ВСЕГДА null
  (задача будет назначена на него самого).
- Если пользователь — модератор и упомянул другого человека, сопоставь имя
  с участниками команды (учитывай name_variants). Если не найден — null.
- Определи приоритет по контексту: "срочно", "важно", "критично" -> high/urgent;
  "когда будет время", "не горит" -> low; по умолчанию -> medium.
- Извлеки дедлайн из фраз: "до пятницы", "к 1 марта", "на этой неделе".
  Сегодня: {today}.
- title должен быть кратким и конкретным — описание действия.
"""

MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0


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

    async def _get_current_provider(self, session: AsyncSession) -> AIProvider:
        """Read current provider from app_settings and instantiate.

        Falls back to first available provider when the configured one
        has no API key (e.g. seed defaults to anthropic but only openai key is set).
        """
        if not self.provider_factories:
            raise ValueError("Нет доступных AI-провайдеров (не заданы API ключи)")

        settings_repo = AppSettingsRepository()
        setting = await settings_repo.get(session, "ai_provider")
        if not setting:
            raise ValueError("AI provider not configured in app_settings")

        provider_name = setting.value["provider"]
        model = setting.value["model"]

        if provider_name not in self.provider_factories:
            fallback_name = next(iter(self.provider_factories))
            config_setting = await settings_repo.get(session, "ai_providers_config")
            fallback_model = model
            if config_setting and fallback_name in config_setting.value:
                fallback_model = config_setting.value[fallback_name].get("default", model)

            logger.warning(
                "Провайдер %s недоступен (нет API ключа), переключаюсь на %s/%s",
                provider_name, fallback_name, fallback_model,
            )
            await settings_repo.set(
                session, "ai_provider",
                {"provider": fallback_name, "model": fallback_model},
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

    async def parse_meeting_summary(
        self,
        session: AsyncSession,
        summary_text: str,
        team_members: list[TeamMember],
    ) -> ParsedMeeting:
        """Parse Zoom Summary via current AI provider."""
        provider = await self._get_current_provider(session)

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

        response = await self._complete_with_retry(provider, system_prompt, summary_text)

        try:
            data = self._extract_json(response)
            return ParsedMeeting(**data)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse AI response as ParsedMeeting: {e}\nResponse: {response}")
            raise ValueError(f"AI вернул некорректный ответ: {e}")

    async def parse_task_from_text(
        self,
        session: AsyncSession,
        text: str,
        author_name: str,
        is_moderator: bool,
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
            role_label="модератор" if is_moderator else "участник",
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
