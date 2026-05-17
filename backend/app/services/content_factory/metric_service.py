import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CFMetricSnapshot
from app.db.schemas import CFMetricSnapshotCreate


@dataclass(frozen=True)
class MetricRecordResult:
    snapshot: CFMetricSnapshot
    created: bool


def _build_snapshot(payload: CFMetricSnapshotCreate) -> CFMetricSnapshot:
    return CFMetricSnapshot(
        publication_id=payload.publication_id,
        window=payload.window,
        metric_name=payload.metric_name,
        metric_value=payload.metric_value,
        metric_value_text=payload.metric_value_text,
        source=payload.source,
        source_method=payload.source_method,
        confidence=payload.confidence,
        raw_payload=payload.raw_payload,
        note=payload.note,
        captured_by_id=payload.captured_by_id,
        source_config_id=payload.source_config_id,
        import_run_id=payload.import_run_id,
        external_metric_id=payload.external_metric_id,
        dedupe_key=payload.dedupe_key,
    )


class MetricService:
    @staticmethod
    async def record(session: AsyncSession, payload: CFMetricSnapshotCreate) -> CFMetricSnapshot:
        result = await MetricService.record_deduped(session, payload)
        return result.snapshot

    @staticmethod
    async def record_deduped(
        session: AsyncSession,
        payload: CFMetricSnapshotCreate,
    ) -> MetricRecordResult:
        if payload.dedupe_key:
            result = await session.execute(
                select(CFMetricSnapshot).where(
                    CFMetricSnapshot.dedupe_key == payload.dedupe_key
                )
            )
            existing = result.scalar_one_or_none()
            if existing is not None:
                return MetricRecordResult(snapshot=existing, created=False)

        snap = _build_snapshot(payload)
        session.add(snap)
        await session.flush()
        await session.refresh(snap)
        return MetricRecordResult(snapshot=snap, created=True)

    @staticmethod
    async def list_for_publication(
        session: AsyncSession, publication_id: uuid.UUID
    ) -> list[CFMetricSnapshot]:
        result = await session.execute(
            select(CFMetricSnapshot).where(CFMetricSnapshot.publication_id == publication_id)
            .order_by(CFMetricSnapshot.captured_at)
        )
        return list(result.scalars().all())
