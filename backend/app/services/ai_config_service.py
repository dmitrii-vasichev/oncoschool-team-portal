"""Service for per-feature AI provider/model configuration."""

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AIFeatureConfig
from app.db.repositories import AIFeatureConfigRepository

logger = logging.getLogger(__name__)

_repo = AIFeatureConfigRepository()


class AIFeatureConfigService:
    @staticmethod
    async def get_config(
        session: AsyncSession, feature_key: str
    ) -> AIFeatureConfig | None:
        """Get config for feature_key with fallback to 'default' row."""
        return await _repo.get_with_default_fallback(session, feature_key)

    @staticmethod
    async def get_all_configs(session: AsyncSession) -> list[AIFeatureConfig]:
        return await _repo.get_all(session)

    @staticmethod
    async def update_config(
        session: AsyncSession,
        feature_key: str,
        provider: str | None,
        model: str | None,
        updated_by: uuid.UUID | None = None,
    ) -> AIFeatureConfig:
        return await _repo.upsert(
            session,
            feature_key,
            provider=provider,
            model=model,
            updated_by_id=updated_by,
        )

    @staticmethod
    async def get_provider_for_feature(
        session: AsyncSession, feature_key: str
    ) -> tuple[str | None, str | None]:
        """Return (provider, model) for a feature. Falls back to 'default'."""
        config = await _repo.get_with_default_fallback(session, feature_key)
        if config:
            return config.provider, config.model
        return None, None
