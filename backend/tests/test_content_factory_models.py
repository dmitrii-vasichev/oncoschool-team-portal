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

    def test_cf_retro_note_exists(self):
        self.assertEqual(models.CFRetroNote.__tablename__, "cf_retro_note")

    def test_relationships_configure(self):
        configure_mappers()
        # Bundle ↔ publications
        self.assertIn("publications", models.CFBundle.__mapper__.relationships)
        # Publication ↔ versions
        self.assertIn("versions", models.CFPublication.__mapper__.relationships)
        # External segment ↔ snapshots
        self.assertIn("snapshots", models.CFExternalSegment.__mapper__.relationships)


if __name__ == "__main__":
    unittest.main()
