import unittest
import uuid
from datetime import UTC, date, datetime

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

    def test_cf_publication_variant_upsert(self):
        m = schemas.CFPublicationVariantUpsert(
            title="Telegram title",
            body_text="Telegram body",
            notes="Check CTA",
        )
        self.assertEqual(m.body_text, "Telegram body")
        self.assertEqual(m.notes, "Check CTA")

    def test_cf_publication_variant_rejects_bad_channel_response(self):
        with self.assertRaises(ValidationError):
            schemas.CFPublicationVariantResponse(
                id=uuid.uuid4(),
                publication_id=uuid.uuid4(),
                channel="not_a_channel",
                title="Title",
                body_text="Body",
                notes=None,
                source_version_number=1,
                updated_by_id=uuid.uuid4(),
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

    def test_cf_publishing_queue_item_response(self):
        item = schemas.CFPublishingQueueItemResponse(
            id=uuid.uuid4(),
            publication_id=uuid.uuid4(),
            platform_id=uuid.uuid4(),
            status="queued",
            scheduled_for=datetime(2026, 5, 20, 10, 0, tzinfo=UTC),
            requested_by_id=uuid.uuid4(),
            attempts=0,
            max_attempts=3,
            last_attempt_at=None,
            next_retry_at=None,
            completed_at=None,
            error_message=None,
            manual_fallback_reason=None,
            payload={"title": "Telegram announcement"},
            provider_response=None,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        self.assertEqual(item.status, "queued")
        self.assertEqual(item.payload["title"], "Telegram announcement")

    def test_cf_publishing_queue_response_rejects_bad_status(self):
        with self.assertRaises(ValidationError):
            schemas.CFPublishingQueueItemResponse(
                id=uuid.uuid4(),
                publication_id=uuid.uuid4(),
                platform_id=uuid.uuid4(),
                status="not_a_queue_status",
                scheduled_for=None,
                requested_by_id=uuid.uuid4(),
                attempts=0,
                max_attempts=3,
                last_attempt_at=None,
                next_retry_at=None,
                completed_at=None,
                error_message=None,
                manual_fallback_reason=None,
                payload={},
                provider_response=None,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

    def test_cf_publishing_queue_manual_fallback_request_trims_reason(self):
        data = schemas.CFPublishingQueueManualFallbackRequest(
            reason="  API token is not ready yet  "
        )

        self.assertEqual(data.reason, "API token is not ready yet")

    def test_cf_publishing_queue_manual_fallback_request_rejects_blank_reason(self):
        with self.assertRaises(ValidationError):
            schemas.CFPublishingQueueManualFallbackRequest(reason="   ")

    def test_cf_publishing_queue_event_response(self):
        event = schemas.CFPublishingQueueEventResponse(
            id=uuid.uuid4(),
            queue_item_id=uuid.uuid4(),
            publication_id=uuid.uuid4(),
            actor_id=uuid.uuid4(),
            event_type="queued",
            message="Publication was queued",
            payload={"source": "operator"},
            created_at=datetime.now(UTC),
        )

        self.assertEqual(event.event_type, "queued")
        self.assertEqual(event.payload["source"], "operator")

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

    def test_cf_metric_source_config_create_ok(self):
        payload = schemas.CFMetricSourceConfigCreate(
            source="vk_api",
            name="VK community metrics",
            freshness_window_hours=24,
            default_confidence="medium",
            config={"owner_id": "-123"},
        )
        self.assertEqual(payload.source, "vk_api")
        self.assertEqual(payload.name, "VK community metrics")
        self.assertEqual(payload.config["owner_id"], "-123")

    def test_cf_metric_source_config_rejects_blank_name(self):
        with self.assertRaises(ValidationError):
            schemas.CFMetricSourceConfigCreate(source="vk_api", name=" ")

    def test_cf_metric_import_run_response_ok(self):
        now = datetime.now(UTC)
        run = schemas.CFMetricImportRunResponse(
            id=uuid.uuid4(),
            source_config_id=uuid.uuid4(),
            status="succeeded",
            triggered_by="manual",
            requested_by_id=uuid.uuid4(),
            started_at=now,
            finished_at=now,
            found_count=10,
            created_count=8,
            skipped_duplicate_count=2,
            error_count=0,
            error_message=None,
            raw_summary={"provider": "test"},
            created_at=now,
            updated_at=now,
        )
        self.assertEqual(run.skipped_duplicate_count, 2)

    def test_cf_metric_snapshot_create_accepts_integration_provenance(self):
        run_id = uuid.uuid4()
        source_config_id = uuid.uuid4()
        payload = schemas.CFMetricSnapshotCreate(
            publication_id=uuid.uuid4(),
            window="24h",
            metric_name="views",
            metric_value=100,
            source="vk_api",
            confidence="medium",
            source_config_id=source_config_id,
            import_run_id=run_id,
            external_metric_id="post-123:views:24h",
            dedupe_key="vk-api:source:publication:24h:views",
        )
        self.assertEqual(payload.source_config_id, source_config_id)
        self.assertEqual(payload.import_run_id, run_id)

    def test_cf_retro_note_create(self):
        m = schemas.CFRetroNoteCreate(
            period_start=date(2026, 5, 6), period_end=date(2026, 5, 12),
            retro_type="weekly", facilitator_id=uuid.uuid4(),
        )
        self.assertEqual(m.retro_type, "weekly")

    def test_cf_guest_story_create_defaults(self):
        m = schemas.CFGuestStoryCreate(
            display_name="Patient story candidate",
            role="patient",
            owner_id=uuid.uuid4(),
        )
        self.assertEqual(m.status, "sourced")
        self.assertEqual(m.source, "manual")
        self.assertEqual(m.consent_status, "not_started")
        self.assertEqual(m.anonymity_level, "full_name")
        self.assertEqual(m.gift_status, "not_required")
        self.assertEqual(m.allowed_channels, [])
        self.assertEqual(m.sensitive_topics, [])

    def test_cf_guest_story_create_rejects_bad_status(self):
        with self.assertRaises(ValidationError):
            schemas.CFGuestStoryCreate(
                display_name="Patient story candidate",
                role="patient",
                owner_id=uuid.uuid4(),
                status="not_a_stage",
            )

    def test_cf_guest_story_event_create_requires_body(self):
        with self.assertRaises(ValidationError):
            schemas.CFGuestStoryEventCreate(body="")
        with self.assertRaises(ValidationError):
            schemas.CFGuestStoryEventCreate(body="   ")

    def test_cf_guest_story_event_create_trims_body(self):
        parent_event_id = uuid.uuid4()
        event = schemas.CFGuestStoryEventCreate(
            body="  Комментарий  ",
            parent_event_id=parent_event_id,
        )
        self.assertEqual(event.body, "Комментарий")
        self.assertEqual(event.parent_event_id, parent_event_id)

    def test_cf_guest_story_event_response(self):
        parent_event_id = uuid.uuid4()
        event = schemas.CFGuestStoryEventResponse(
            id=uuid.uuid4(),
            guest_story_id=uuid.uuid4(),
            parent_event_id=parent_event_id,
            actor_id=uuid.uuid4(),
            event_type="comment",
            body="Попросили согласовать город.",
            old_value=None,
            new_value=None,
            payload={},
            created_at=datetime(2026, 5, 14, tzinfo=UTC),
        )
        self.assertEqual(event.event_type, "comment")
        self.assertEqual(event.parent_event_id, parent_event_id)


if __name__ == "__main__":
    unittest.main()
