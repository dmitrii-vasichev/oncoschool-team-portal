"""Regression test for content access grant (issue #42).

The bug: SQLAlchemy model used native_enum=True (default) for Enum columns,
but the migration created VARCHAR columns. PostgreSQL raises
'type "content_sub_section_enum" does not exist' on INSERT/SELECT.
Fix: use native_enum=False in all Content module Enum columns.
"""

import unittest

from sqlalchemy import Enum as SAEnum
from app.db.models import (
    ContentAccess,
    ContentRole,
    ContentSubSection,
    TelegramContent,
    ContentType,
    AnalysisRun,
    AnalysisContentType,
    AnalysisStatus,
)


class TestContentModuleEnumColumns(unittest.TestCase):
    """All Content module Enum columns must use native_enum=False (VARCHAR storage)."""

    def _get_sa_enum(self, model, column_name: str) -> SAEnum:
        col = model.__table__.columns[column_name]
        self.assertIsInstance(col.type, SAEnum, f"{model.__name__}.{column_name} is not Enum")
        return col.type

    def test_content_access_sub_section_not_native(self):
        enum_type = self._get_sa_enum(ContentAccess, "sub_section")
        self.assertFalse(enum_type.native_enum, "ContentAccess.sub_section must use native_enum=False")

    def test_content_access_role_not_native(self):
        enum_type = self._get_sa_enum(ContentAccess, "role")
        self.assertFalse(enum_type.native_enum, "ContentAccess.role must use native_enum=False")

    def test_telegram_content_content_type_not_native(self):
        enum_type = self._get_sa_enum(TelegramContent, "content_type")
        self.assertFalse(enum_type.native_enum, "TelegramContent.content_type must use native_enum=False")

    def test_analysis_run_content_type_not_native(self):
        enum_type = self._get_sa_enum(AnalysisRun, "content_type")
        self.assertFalse(enum_type.native_enum, "AnalysisRun.content_type must use native_enum=False")

    def test_analysis_run_status_not_native(self):
        enum_type = self._get_sa_enum(AnalysisRun, "status")
        self.assertFalse(enum_type.native_enum, "AnalysisRun.status must use native_enum=False")


if __name__ == "__main__":
    unittest.main()
