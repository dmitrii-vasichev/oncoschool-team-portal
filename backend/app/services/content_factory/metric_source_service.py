from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CFMetricImportRun, CFMetricSourceConfig
from app.db.schemas import CFMetricSourceConfigCreate, CFMetricSourceConfigUpdate


TERMINAL_RUN_STATUSES = {"succeeded", "failed", "partial"}


class MetricSourceValidationError(ValueError):
    """Raised when a metric source or import run operation is not allowed."""


class MetricSourceConfigService:
    @staticmethod
    async def create(
        session: AsyncSession,
        payload: CFMetricSourceConfigCreate,
    ) -> CFMetricSourceConfig:
        source = CFMetricSourceConfig(
            source=payload.source,
            name=payload.name,
            description=payload.description,
            is_active=payload.is_active,
            freshness_window_hours=payload.freshness_window_hours,
            default_confidence=payload.default_confidence,
            config=payload.config,
            credentials_ref=payload.credentials_ref,
            created_by_id=payload.created_by_id,
        )
        session.add(source)
        await session.flush()
        await session.refresh(source)
        return source

    @staticmethod
    async def get(
        session: AsyncSession,
        source_config_id: uuid.UUID,
    ) -> CFMetricSourceConfig | None:
        return await session.get(CFMetricSourceConfig, source_config_id)

    @staticmethod
    async def list(
        session: AsyncSession,
        *,
        source: str | None = None,
        is_active: bool | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CFMetricSourceConfig]:
        stmt = select(CFMetricSourceConfig)
        if source:
            stmt = stmt.where(CFMetricSourceConfig.source == source)
        if is_active is not None:
            stmt = stmt.where(CFMetricSourceConfig.is_active.is_(is_active))
        stmt = (
            stmt.order_by(
                CFMetricSourceConfig.is_active.desc(),
                CFMetricSourceConfig.source.asc(),
                CFMetricSourceConfig.name.asc(),
            )
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def update(
        session: AsyncSession,
        source_config_id: uuid.UUID,
        payload: CFMetricSourceConfigUpdate,
    ) -> CFMetricSourceConfig | None:
        source = await MetricSourceConfigService.get(session, source_config_id)
        if source is None:
            return None

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(source, field, value)
        source.updated_at = datetime.now(timezone.utc)
        await session.flush()
        await session.refresh(source)
        return source


class MetricImportRunService:
    @staticmethod
    async def start_run(
        session: AsyncSession,
        source_config: CFMetricSourceConfig,
        *,
        triggered_by: str = "manual",
        requested_by_id: uuid.UUID | None = None,
    ) -> CFMetricImportRun:
        now = datetime.now(timezone.utc)
        run = CFMetricImportRun(
            source_config_id=source_config.id,
            status="running",
            triggered_by=triggered_by,
            requested_by_id=requested_by_id,
            started_at=now,
        )
        source_config.last_run_at = now
        source_config.updated_at = now
        session.add(run)
        await session.flush()
        await session.refresh(run)
        return run

    @staticmethod
    async def finish_run(
        session: AsyncSession,
        run: CFMetricImportRun,
        *,
        status: str,
        found_count: int,
        created_count: int,
        skipped_duplicate_count: int,
        error_count: int,
        error_message: str | None = None,
        raw_summary: dict[str, Any] | None = None,
    ) -> CFMetricImportRun:
        if run.status in TERMINAL_RUN_STATUSES:
            raise MetricSourceValidationError("Import run is already finished")
        if status not in TERMINAL_RUN_STATUSES:
            raise MetricSourceValidationError("Import run must finish with a terminal status")

        now = datetime.now(timezone.utc)
        run.status = status
        run.finished_at = now
        run.found_count = found_count
        run.created_count = created_count
        run.skipped_duplicate_count = skipped_duplicate_count
        run.error_count = error_count
        run.error_message = error_message
        run.raw_summary = raw_summary
        run.updated_at = now

        source_config = run.source_config
        if source_config is not None:
            source_config.last_run_at = now
            source_config.updated_at = now
            if status == "succeeded":
                source_config.last_success_at = now
                source_config.last_error_message = None
            else:
                source_config.last_error_at = now
                source_config.last_error_message = error_message

        await session.flush()
        await session.refresh(run)
        return run

    @staticmethod
    async def list_runs(
        session: AsyncSession,
        *,
        source_config_id: uuid.UUID | None = None,
        status: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CFMetricImportRun]:
        stmt = select(CFMetricImportRun)
        if source_config_id is not None:
            stmt = stmt.where(CFMetricImportRun.source_config_id == source_config_id)
        if status:
            stmt = stmt.where(CFMetricImportRun.status == status)
        stmt = stmt.order_by(CFMetricImportRun.created_at.desc()).limit(limit).offset(offset)
        result = await session.execute(stmt)
        return list(result.scalars().all())
