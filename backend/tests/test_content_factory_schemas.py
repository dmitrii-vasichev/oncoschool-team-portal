import uuid
import unittest
from datetime import date

from pydantic import ValidationError

from app.db import schemas


class TestCFReferenceSchemas(unittest.TestCase):
    def test_cf_platform_response(self):
        m = schemas.CFPlatformResponse(
            id=uuid.uuid4(), code="telegram", display_name="Telegram",
            is_active=True, capabilities={"can_api_publish": True}, display_order=1,
        )
        self.assertEqual(m.code, "telegram")

    def test_cf_platform_create_requires_code(self):
        with self.assertRaises(ValidationError):
            schemas.CFPlatformCreate(display_name="X")

    def test_cf_format_response(self):
        m = schemas.CFFormatResponse(
            id=uuid.uuid4(), code="button", display_name="Кнопка",
            default_objective="registration", requires_medical_review=False,
            is_active=True, display_order=1,
        )
        self.assertEqual(m.code, "button")

    def test_cf_rubric_response(self):
        m = schemas.CFRubricResponse(
            id=uuid.uuid4(), code="expert", display_name="Экспертный", is_active=True,
        )
        self.assertEqual(m.code, "expert")

    def test_cf_nosology_response(self):
        m = schemas.CFNosologyResponse(
            id=uuid.uuid4(), code="rmj", display_name="РМЖ", is_active=True,
        )
        self.assertEqual(m.code, "rmj")

    def test_cf_funnel_template_response(self):
        m = schemas.CFFunnelTemplateResponse(
            id=uuid.uuid4(), code="live_funnel", name="Воронка эфира",
            description=None, template_publications=[], is_active=True,
        )
        self.assertEqual(m.code, "live_funnel")


class TestCFCoreSchemas(unittest.TestCase):
    def test_cf_bundle_create_minimal(self):
        m = schemas.CFBundleCreate(
            name="Эфир с Воротниковым",
            product_stream="onco_school",
            owner_id=uuid.uuid4(),
        )
        self.assertEqual(m.status, "planning")

    def test_cf_bundle_create_rejects_bad_stream(self):
        with self.assertRaises(ValidationError):
            schemas.CFBundleCreate(
                name="x", product_stream="not_a_stream", owner_id=uuid.uuid4()
            )

    def test_cf_publication_create_minimal(self):
        m = schemas.CFPublicationCreate(
            bundle_id=uuid.uuid4(),
            platform_id=uuid.uuid4(),
            format_id=uuid.uuid4(),
            responsible_id=uuid.uuid4(),
        )
        self.assertEqual(m.status, "draft")

    def test_cf_metric_snapshot_create_requires_window(self):
        with self.assertRaises(ValidationError):
            schemas.CFMetricSnapshotCreate(
                publication_id=uuid.uuid4(), metric_name="reach",
            )

    def test_cf_metric_snapshot_create_ok(self):
        m = schemas.CFMetricSnapshotCreate(
            publication_id=uuid.uuid4(),
            window="24h", metric_name="reach", metric_value=605, source="manual",
            confidence="high",
        )
        self.assertEqual(m.metric_value, 605)

    def test_cf_retro_note_create(self):
        m = schemas.CFRetroNoteCreate(
            period_start=date(2026, 5, 6), period_end=date(2026, 5, 12),
            retro_type="weekly", facilitator_id=uuid.uuid4(),
        )
        self.assertEqual(m.retro_type, "weekly")


if __name__ == "__main__":
    unittest.main()
