"""Regression tests for GetCourse export fetch behavior.

Replaces old polling tests — since #171, Phase 2 uses _fetch_export (single attempt
with quick retries) instead of _poll_export (long polling loop).
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.getcourse_service import (
    GetCourseService,
    FETCH_MAX_ATTEMPTS,
    FETCH_RETRY_DELAY,
    RATE_LIMIT_BASE_DELAY,
    RATE_LIMIT_MAX_DELAY,
    MAX_RATE_LIMIT_RETRIES,
    EXPORT_PAUSE,
)


def _make_not_ready_response():
    return {"success": False, "error_message": "Файл еще не создан"}


def _make_rate_limit_response():
    return {"success": False, "error_message": "Слишком много запросов"}


def _make_exported_response(items=None):
    return {"success": True, "info": {"status": "exported", "items": items or []}}


def _make_processing_response():
    return {"success": True, "info": {"status": "processing"}}


class TestFetchExportSuccess(unittest.TestCase):
    """_fetch_export should return items on first attempt when data is ready."""

    def setUp(self):
        self.service = GetCourseService()

    def test_immediate_success(self):
        """Export ready on first fetch — no retries needed."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value=_make_exported_response([{"id": 1}]))

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(
                self.service._fetch_export("https://test.getcourse.ru", "key", 12345)
            )

        self.assertEqual(len(result), 1)
        # Only 1 HTTP call — no retries
        self.assertEqual(mock_client.get.await_count, 1)


class TestFetchExportItemsWithoutStatus(unittest.TestCase):
    """GetCourse may return items without a 'status' field (#174)."""

    def setUp(self):
        self.service = GetCourseService()

    def test_items_without_status_field(self):
        """success=true + info has items but no status — should return items."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={
            "success": True, "info": {"items": [{"id": 1}, {"id": 2}]}
        })

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(
                self.service._fetch_export("https://test.getcourse.ru", "key", 12345)
            )

        self.assertEqual(len(result), 2)
        self.assertEqual(mock_client.get.await_count, 1)

    def test_items_with_null_status(self):
        """success=true + items present + status=None — should still return items."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={
            "success": True, "info": {"status": None, "items": [{"id": 1}]}
        })

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(
                self.service._fetch_export("https://test.getcourse.ru", "key", 12345)
            )

        self.assertEqual(len(result), 1)

    def test_empty_items_list_is_valid(self):
        """success=true + items=[] — valid response for a day with no data."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={
            "success": True, "info": {"items": []}
        })

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(
                self.service._fetch_export("https://test.getcourse.ru", "key", 12345)
            )

        self.assertEqual(result, [])


class TestFetchExportNotReady(unittest.TestCase):
    """_fetch_export should retry a few times, then fail — no long polling."""

    def setUp(self):
        self.service = GetCourseService()

    def test_max_attempts_is_3(self):
        self.assertEqual(FETCH_MAX_ATTEMPTS, 3)

    def test_retry_delay_is_30s(self):
        self.assertEqual(FETCH_RETRY_DELAY, 30)

    def test_not_ready_then_success(self):
        """Not ready on first attempt, ready on second."""
        responses = [_make_not_ready_response(), _make_exported_response([{"id": 1}])]
        call_count = [0]

        def json_side_effect():
            result = responses[call_count[0]]
            call_count[0] += 1
            return result

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = json_side_effect

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                result = asyncio.run(
                    self.service._fetch_export("https://test.getcourse.ru", "key", 12345)
                )

        self.assertEqual(len(result), 1)
        self.assertEqual(call_count[0], 2)

    def test_all_not_ready_raises_with_hint(self):
        """If never ready after all attempts, error suggests increasing pause."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value=_make_not_ready_response())

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                with self.assertRaises(RuntimeError) as ctx:
                    asyncio.run(
                        self.service._fetch_export("https://test.getcourse.ru", "key", 12345)
                    )

        self.assertIn("не готовы", str(ctx.exception))
        self.assertIn("увеличить паузу", str(ctx.exception))
        # Exactly FETCH_MAX_ATTEMPTS HTTP calls
        self.assertEqual(mock_client.get.await_count, FETCH_MAX_ATTEMPTS)


class TestFetchExportRateLimit(unittest.TestCase):
    """Rate limit during fetch should retry, not crash."""

    def setUp(self):
        self.service = GetCourseService()

    def test_rate_limit_then_success(self):
        """Rate limited once, then succeeds."""
        responses = [_make_rate_limit_response(), _make_exported_response([{"id": 1}])]
        call_count = [0]

        def json_side_effect():
            result = responses[call_count[0]]
            call_count[0] += 1
            return result

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = json_side_effect

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                result = asyncio.run(
                    self.service._fetch_export("https://test.getcourse.ru", "key", 12345)
                )

        self.assertEqual(len(result), 1)


class TestFetchExportServerError(unittest.TestCase):
    """Server-side error should fail immediately."""

    def setUp(self):
        self.service = GetCourseService()

    def test_server_error_raises(self):
        """status='error' should raise immediately, no retries."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={
            "success": True, "info": {"status": "error"}
        })

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                asyncio.run(
                    self.service._fetch_export("https://test.getcourse.ru", "key", 12345)
                )

        self.assertIn("failed on server side", str(ctx.exception))
        # Only 1 call — no retries on server error
        self.assertEqual(mock_client.get.await_count, 1)


class TestExportPauseConstant(unittest.TestCase):
    """Pause between exports must be 5 min (matching n8n)."""

    def test_export_pause_is_300(self):
        self.assertEqual(EXPORT_PAUSE, 300)


if __name__ == "__main__":
    unittest.main()
