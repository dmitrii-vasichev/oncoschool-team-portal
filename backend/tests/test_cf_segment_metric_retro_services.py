import uuid
import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from app.services.content_factory.segment_service import SegmentService
from app.services.content_factory.metric_service import MetricService
from app.services.content_factory.retro_service import RetroService
from app.db.schemas import (
    CFExternalSegmentCreate, CFMetricSnapshotCreate, CFRetroNoteCreate,
)


class TestServices(unittest.IsolatedAsyncioTestCase):
    async def test_create_segment_also_creates_snapshot(self):
        session = AsyncMock()
        payload = CFExternalSegmentCreate(
            source="getcourse", source_segment_id="seg-123",
            name="Старая база без покупок", population_count=12129,
        )
        result = await SegmentService.create(session, payload)
        self.assertEqual(result.name, payload.name)
        # one for segment, one for initial snapshot
        self.assertEqual(session.add.call_count, 2)

    async def test_record_metric_snapshot(self):
        session = AsyncMock()
        payload = CFMetricSnapshotCreate(
            publication_id=uuid.uuid4(), window="24h",
            metric_name="reach", metric_value=605, source="manual", confidence="high",
        )
        result = await MetricService.record(session, payload)
        self.assertEqual(result.metric_value, 605)
        session.add.assert_called_once()

    async def test_record_metric_with_dedupe_key_returns_existing_duplicate(self):
        existing = SimpleNamespace(id=uuid.uuid4(), dedupe_key="same-key")
        session = AsyncMock()
        session.execute.return_value = SimpleNamespace(
            scalar_one_or_none=lambda: existing,
        )
        payload = CFMetricSnapshotCreate(
            publication_id=uuid.uuid4(),
            window="24h",
            metric_name="views",
            metric_value=100,
            source="vk_api",
            confidence="medium",
            dedupe_key="same-key",
        )

        result = await MetricService.record_deduped(session, payload)

        self.assertIs(result.snapshot, existing)
        self.assertFalse(result.created)
        session.add.assert_not_called()

    async def test_record_metric_without_dedupe_key_still_creates_new_snapshot(self):
        session = AsyncMock()
        session.add = Mock()
        payload = CFMetricSnapshotCreate(
            publication_id=uuid.uuid4(),
            window="24h",
            metric_name="views",
            metric_value=100,
            source="manual",
            confidence="high",
        )

        result = await MetricService.record_deduped(session, payload)

        self.assertTrue(result.created)
        session.add.assert_called_once()

    async def test_create_retro(self):
        session = AsyncMock()
        payload = CFRetroNoteCreate(
            period_start=date(2026, 5, 6), period_end=date(2026, 5, 12),
            retro_type="weekly", facilitator_id=uuid.uuid4(),
        )
        result = await RetroService.create(session, payload)
        self.assertEqual(result.retro_type, "weekly")


if __name__ == "__main__":
    unittest.main()
