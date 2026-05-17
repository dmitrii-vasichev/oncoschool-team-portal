import unittest
from sqlalchemy.orm import configure_mappers

from app.db import models


class TestContentFactoryReferenceModels(unittest.TestCase):
    def test_cf_platform_class_exists(self):
        self.assertTrue(hasattr(models, "CFPlatform"))
        self.assertEqual(models.CFPlatform.__tablename__, "cf_platform")

    def test_cf_format_class_exists(self):
        self.assertTrue(hasattr(models, "CFFormat"))
        self.assertEqual(models.CFFormat.__tablename__, "cf_format")

    def test_cf_rubric_class_exists(self):
        self.assertTrue(hasattr(models, "CFRubric"))

    def test_cf_nosology_class_exists(self):
        self.assertTrue(hasattr(models, "CFNosology"))

    def test_cf_funnel_template_class_exists(self):
        self.assertTrue(hasattr(models, "CFFunnelTemplate"))

    def test_mappers_configure_cleanly(self):
        configure_mappers()  # raises if relationships are broken


class TestContentFactoryCoreModels(unittest.TestCase):
    def test_cf_bundle_exists(self):
        self.assertEqual(models.CFBundle.__tablename__, "cf_bundle")

    def test_cf_publication_exists(self):
        self.assertEqual(models.CFPublication.__tablename__, "cf_publication")
        self.assertTrue(hasattr(models.CFPublication, "bundle_id"))
        self.assertTrue(hasattr(models.CFPublication, "platform_id"))

    def test_cf_publication_version_exists(self):
        self.assertEqual(models.CFPublicationVersion.__tablename__, "cf_publication_version")

    def test_cf_publication_variant_exists(self):
        self.assertEqual(models.CFPublicationVariant.__tablename__, "cf_publication_variant")
        self.assertTrue(hasattr(models.CFPublicationVariant, "publication_id"))
        self.assertTrue(hasattr(models.CFPublicationVariant, "channel"))
        self.assertTrue(hasattr(models.CFPublicationVariant, "source_version_number"))

    def test_cf_publishing_queue_item_exists(self):
        self.assertEqual(models.CFPublishingQueueItem.__tablename__, "cf_publishing_queue_item")
        self.assertTrue(hasattr(models.CFPublishingQueueItem, "publication_id"))
        self.assertTrue(hasattr(models.CFPublishingQueueItem, "platform_id"))
        self.assertTrue(hasattr(models.CFPublishingQueueItem, "status"))
        self.assertTrue(hasattr(models.CFPublishingQueueItem, "attempts"))
        self.assertTrue(hasattr(models.CFPublishingQueueItem, "manual_fallback_reason"))

    def test_cf_publishing_queue_event_exists(self):
        self.assertEqual(models.CFPublishingQueueEvent.__tablename__, "cf_publishing_queue_event")
        self.assertTrue(hasattr(models.CFPublishingQueueEvent, "queue_item_id"))
        self.assertTrue(hasattr(models.CFPublishingQueueEvent, "publication_id"))
        self.assertTrue(hasattr(models.CFPublishingQueueEvent, "event_type"))
        self.assertTrue(hasattr(models.CFPublishingQueueEvent, "payload"))

    def test_cf_publication_relation_exists(self):
        self.assertEqual(models.CFPublicationRelation.__tablename__, "cf_publication_relation")

    def test_cf_publication_segment_target_exists(self):
        self.assertEqual(models.CFPublicationSegmentTarget.__tablename__, "cf_publication_segment_target")

    def test_cf_external_segment_exists(self):
        self.assertEqual(models.CFExternalSegment.__tablename__, "cf_external_segment")

    def test_cf_segment_snapshot_exists(self):
        self.assertEqual(models.CFSegmentSnapshot.__tablename__, "cf_segment_snapshot")

    def test_cf_metric_snapshot_exists(self):
        self.assertEqual(models.CFMetricSnapshot.__tablename__, "cf_metric_snapshot")

    def test_cf_metric_source_config_exists(self):
        self.assertEqual(models.CFMetricSourceConfig.__tablename__, "cf_metric_source_config")
        self.assertTrue(hasattr(models.CFMetricSourceConfig, "freshness_window_hours"))
        self.assertTrue(hasattr(models.CFMetricSourceConfig, "last_success_at"))

    def test_cf_metric_import_run_exists(self):
        self.assertEqual(models.CFMetricImportRun.__tablename__, "cf_metric_import_run")
        self.assertTrue(hasattr(models.CFMetricImportRun, "skipped_duplicate_count"))
        self.assertTrue(hasattr(models.CFMetricImportRun, "raw_summary"))

    def test_cf_metric_snapshot_provenance_fields_exist(self):
        self.assertTrue(hasattr(models.CFMetricSnapshot, "source_config_id"))
        self.assertTrue(hasattr(models.CFMetricSnapshot, "import_run_id"))
        self.assertTrue(hasattr(models.CFMetricSnapshot, "external_metric_id"))
        self.assertTrue(hasattr(models.CFMetricSnapshot, "dedupe_key"))

    def test_cf_retro_note_exists(self):
        self.assertEqual(models.CFRetroNote.__tablename__, "cf_retro_note")

    def test_cf_guest_story_exists(self):
        self.assertEqual(models.CFGuestStory.__tablename__, "cf_guest_story")
        self.assertTrue(hasattr(models.CFGuestStory, "status"))
        self.assertTrue(hasattr(models.CFGuestStory, "consent_status"))
        self.assertTrue(hasattr(models.CFGuestStory, "allowed_channels"))

    def test_cf_guest_story_event_exists(self):
        self.assertEqual(models.CFGuestStoryEvent.__tablename__, "cf_guest_story_event")
        self.assertTrue(hasattr(models.CFGuestStoryEvent, "guest_story_id"))
        self.assertTrue(hasattr(models.CFGuestStoryEvent, "parent_event_id"))
        self.assertTrue(hasattr(models.CFGuestStoryEvent, "event_type"))
        self.assertTrue(hasattr(models.CFGuestStoryEvent, "body"))
        self.assertTrue(hasattr(models.CFGuestStoryEvent, "payload"))

    def test_relationships_configure(self):
        configure_mappers()
        # Bundle ↔ publications
        self.assertIn("publications", models.CFBundle.__mapper__.relationships)
        # Publication ↔ versions
        self.assertIn("versions", models.CFPublication.__mapper__.relationships)
        # Publication ↔ saved channel variants
        self.assertIn("variants", models.CFPublication.__mapper__.relationships)
        # Publication ↔ publishing queue jobs
        self.assertIn("publishing_queue_items", models.CFPublication.__mapper__.relationships)
        self.assertIn("events", models.CFPublishingQueueItem.__mapper__.relationships)
        # External segment ↔ snapshots
        self.assertIn("snapshots", models.CFExternalSegment.__mapper__.relationships)
        # Guest story ↔ activity events
        self.assertIn("events", models.CFGuestStory.__mapper__.relationships)
        self.assertIn("parent_event", models.CFGuestStoryEvent.__mapper__.relationships)
        self.assertIn("replies", models.CFGuestStoryEvent.__mapper__.relationships)


if __name__ == "__main__":
    unittest.main()
