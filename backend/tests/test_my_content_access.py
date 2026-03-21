"""Regression test for issue #136: Editor role not detected on frontend.

The bug: useContentAccess hook hardcoded role="operator" for all non-admin users,
hiding editor-only UI (add/edit/delete channels). The fix adds GET /api/content/my-access
which returns the user's resolved roles via ContentAccessService.has_access().

This test verifies the service layer returns the correct role (editor vs operator)
and that the MyAccessEntry response model correctly represents it.
"""

import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.db.models import ContentRole, ContentSubSection
from app.services.content_access_service import ContentAccessService
from app.api.content import MyAccessEntry


class TestMyAccessEntry(unittest.TestCase):
    """Verify the response model for /my-access endpoint."""

    def test_editor_role_preserved(self):
        entry = MyAccessEntry(sub_section="telegram_analysis", role="editor")
        self.assertEqual(entry.role, "editor")

    def test_operator_role_preserved(self):
        entry = MyAccessEntry(sub_section="telegram_analysis", role="operator")
        self.assertEqual(entry.role, "operator")


class TestContentAccessServiceRoleResolution(unittest.TestCase):
    """Verify ContentAccessService.has_access returns correct role, not always operator."""

    def _make_member(self, role="member", department_id=None):
        member = SimpleNamespace(
            id=uuid.uuid4(),
            role=role,
            department_id=department_id,
            extra_department_ids=[],
        )
        return member

    def _make_grant(self, role: ContentRole):
        return SimpleNamespace(role=role)

    @patch("app.services.content_access_service._repo")
    def test_admin_gets_implicit_editor(self, mock_repo):
        """Admin should always get editor role without DB query."""
        import asyncio
        member = self._make_member(role="admin")
        result = asyncio.run(
            ContentAccessService.has_access(
                AsyncMock(), member, ContentSubSection.telegram_analysis
            )
        )
        self.assertEqual(result, ContentRole.editor)
        mock_repo.get_access_for_member.assert_not_called()

    @patch("app.services.content_access_service._repo")
    def test_editor_grant_returns_editor(self, mock_repo):
        """User with editor grant should get ContentRole.editor, not operator."""
        import asyncio
        member = self._make_member()
        mock_repo.get_access_for_member = AsyncMock(
            return_value=[self._make_grant(ContentRole.editor)]
        )
        result = asyncio.run(
            ContentAccessService.has_access(
                AsyncMock(), member, ContentSubSection.telegram_analysis
            )
        )
        self.assertEqual(result, ContentRole.editor)

    @patch("app.services.content_access_service._repo")
    def test_operator_grant_returns_operator(self, mock_repo):
        """User with only operator grant should get ContentRole.operator."""
        import asyncio
        member = self._make_member()
        mock_repo.get_access_for_member = AsyncMock(
            return_value=[self._make_grant(ContentRole.operator)]
        )
        result = asyncio.run(
            ContentAccessService.has_access(
                AsyncMock(), member, ContentSubSection.telegram_analysis
            )
        )
        self.assertEqual(result, ContentRole.operator)

    @patch("app.services.content_access_service._repo")
    def test_mixed_grants_returns_highest_role(self, mock_repo):
        """When user has both operator and editor grants, editor wins."""
        import asyncio
        member = self._make_member()
        mock_repo.get_access_for_member = AsyncMock(
            return_value=[
                self._make_grant(ContentRole.operator),
                self._make_grant(ContentRole.editor),
            ]
        )
        result = asyncio.run(
            ContentAccessService.has_access(
                AsyncMock(), member, ContentSubSection.telegram_analysis
            )
        )
        self.assertEqual(result, ContentRole.editor)

    @patch("app.services.content_access_service._repo")
    def test_no_grants_returns_none(self, mock_repo):
        """User with no grants should get None."""
        import asyncio
        member = self._make_member()
        mock_repo.get_access_for_member = AsyncMock(return_value=[])
        result = asyncio.run(
            ContentAccessService.has_access(
                AsyncMock(), member, ContentSubSection.telegram_analysis
            )
        )
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
