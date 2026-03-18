"""Regression test: stale encryption-key error is cleared when key becomes available.

Bug #32: After adding TELEGRAM_ENCRYPTION_KEY to env, get_status() still returned
the old "TELEGRAM_ENCRYPTION_KEY is not set" error from the DB.
"""

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import asyncio

from app.services.telegram_connection_service import TelegramConnectionService


def _run(coro):
    """Run async coroutine in sync test."""
    return asyncio.run(coro)


class TestStaleEncryptionKeyError(unittest.TestCase):
    """get_status() should clear stale encryption-key errors from DB."""

    def setUp(self):
        self.service = TelegramConnectionService()

    @patch("app.services.telegram_connection_service.is_encryption_configured", return_value=True)
    @patch("app.services.telegram_connection_service._repo")
    def test_stale_encryption_key_error_cleared(self, mock_repo, mock_enc):
        """When key is now configured but DB has old encryption error → reset to disconnected."""
        stale_record = SimpleNamespace(
            status="error",
            error_message="TELEGRAM_ENCRYPTION_KEY is not set. Generate one with: ...",
            connected_at=None,
            phone_number=None,
            api_hash_encrypted=None,
        )
        mock_repo.get = AsyncMock(return_value=stale_record)
        mock_repo.upsert = AsyncMock()

        result = _run(self.service.get_status(AsyncMock()))

        self.assertEqual(result["status"], "disconnected")
        # Should have cleared the error in DB
        mock_repo.upsert.assert_called_once()
        call_kwargs = mock_repo.upsert.call_args
        self.assertEqual(call_kwargs.kwargs.get("status") or call_kwargs[1].get("status"), "disconnected")

    @patch("app.services.telegram_connection_service.is_encryption_configured", return_value=True)
    @patch("app.services.telegram_connection_service._repo")
    def test_stale_encryption_not_configured_error_cleared(self, mock_repo, mock_enc):
        """Also clears the soft-check error message variant."""
        stale_record = SimpleNamespace(
            status="error",
            error_message="Encryption key not configured on the server.",
            connected_at=None,
            phone_number=None,
            api_hash_encrypted=None,
        )
        mock_repo.get = AsyncMock(return_value=stale_record)
        mock_repo.upsert = AsyncMock()

        result = _run(self.service.get_status(AsyncMock()))

        self.assertEqual(result["status"], "disconnected")
        mock_repo.upsert.assert_called_once()

    @patch("app.services.telegram_connection_service.is_encryption_configured", return_value=True)
    @patch("app.services.telegram_connection_service._repo")
    def test_real_connection_error_preserved(self, mock_repo, mock_enc):
        """Non-encryption errors should NOT be cleared."""
        real_error = SimpleNamespace(
            status="error",
            error_message="Connection timeout after 30s",
            connected_at=None,
            phone_number=None,
            api_hash_encrypted=None,
        )
        mock_repo.get = AsyncMock(return_value=real_error)

        result = _run(self.service.get_status(AsyncMock()))

        self.assertEqual(result["status"], "error")
        self.assertEqual(result["error_message"], "Connection timeout after 30s")
        # Should NOT have tried to upsert
        mock_repo.upsert.assert_not_called()

    @patch("app.services.telegram_connection_service.is_encryption_configured", return_value=False)
    @patch("app.services.telegram_connection_service._repo")
    def test_not_configured_when_key_missing(self, mock_repo, mock_enc):
        """When key is not set, return not_configured without hitting DB."""
        result = _run(self.service.get_status(AsyncMock()))

        self.assertEqual(result["status"], "not_configured")
        mock_repo.get.assert_not_called()


if __name__ == "__main__":
    unittest.main()
