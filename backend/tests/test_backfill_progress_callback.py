"""Regression tests for backfill intermediate progress reporting.

Issue #151: Backfill shows no intermediate progress — user cannot tell
whether data is actually loading, stuck in rate-limit, or failed silently.
The fix adds a progress_callback that reports stage transitions.

Updated after _poll_export was replaced by _fetch_export:
- _fetch_export has no on_progress/timeout params (only base_url, api_key, export_id, cancel_flag)
- Progress callbacks are tested at _request_and_poll_exports level
- _fetch_export uses FETCH_MAX_ATTEMPTS=3 with FETCH_RETRY_DELAY=30s
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.getcourse_service import (
    GetCourseService,
    FETCH_MAX_ATTEMPTS,
)


def _make_export_response(export_id: int = 1):
    """Return a mock successful export request response."""
    return {"success": True, "info": {"export_id": export_id}}


def _make_exported_response(items: list | None = None):
    """Return a mock 'exported' poll response."""
    return {"success": True, "info": {"status": "exported", "items": items or []}}


def _make_not_ready_response():
    """Return a mock 'not ready' poll response."""
    return {"success": False, "error_message": "Файл еще не создан"}


def _make_rate_limit_response():
    """Return a mock rate-limit poll response."""
    return {"success": False, "error_message": "Слишком много запросов"}


class TestProgressCallback(unittest.IsolatedAsyncioTestCase):
    """Verify that on_progress callback fires during _request_and_poll_exports."""

    def setUp(self):
        self.service = GetCourseService()
        self.progress_events: list[tuple[str, dict]] = []

        async def _track_progress(event: str, detail: dict) -> None:
            self.progress_events.append((event, detail))

        self.on_progress = _track_progress

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_request_and_poll_exports_reports_stages(self, mock_client_cls, mock_sleep):
        """_request_and_poll_exports fires export_started / export_done for each type."""
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # n8n-style: 3 requests first, then 3 fetches
        export_resp = MagicMock()
        export_resp.json.return_value = _make_export_response(10)
        export_resp.raise_for_status = MagicMock()

        fetch_resp = MagicMock()
        fetch_resp.json.return_value = _make_exported_response([{"id": 1}])
        fetch_resp.raise_for_status = MagicMock()

        # Phase 1: 3 requests, Phase 2: 3 fetches = 6 total
        mock_client.get = AsyncMock(side_effect=[
            export_resp, export_resp, export_resp,  # all 3 requests
            fetch_resp, fetch_resp, fetch_resp,     # all 3 fetches
        ])

        users, payments, deals = await self.service._request_and_poll_exports(
            "https://example.com", "key", "2026-03-20", "2026-03-20",
            on_progress=self.on_progress,
        )

        # Check that export_started and export_done events were fired for all 3 types
        started_events = [e for e in self.progress_events if e[0] == "export_started"]
        done_events = [e for e in self.progress_events if e[0] == "export_done"]

        self.assertEqual(len(started_events), 3)
        self.assertEqual(len(done_events), 3)

        types_started = [e[1]["export_type"] for e in started_events]
        self.assertEqual(types_started, ["users", "payments", "deals"])

        types_done = [e[1]["export_type"] for e in done_events]
        self.assertEqual(types_done, ["users", "payments", "deals"])

        # Each done event should have rows_count
        for event in done_events:
            self.assertIn("rows_count", event[1])


class TestFetchExportNotReady(unittest.IsolatedAsyncioTestCase):
    """_fetch_export retries when export is not ready yet (up to FETCH_MAX_ATTEMPTS)."""

    def setUp(self):
        self.service = GetCourseService()

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_fetch_export_retries_on_not_ready(self, mock_client_cls, mock_sleep):
        """When export is not ready, _fetch_export retries and succeeds on next attempt."""
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # First call: not ready, second call: exported
        response1 = MagicMock()
        response1.json.return_value = _make_not_ready_response()
        response1.raise_for_status = MagicMock()

        response2 = MagicMock()
        response2.json.return_value = _make_exported_response([{"id": 1}])
        response2.raise_for_status = MagicMock()

        mock_client.get = AsyncMock(side_effect=[response1, response2])

        items = await self.service._fetch_export(
            "https://example.com", "key", 123,
        )

        self.assertEqual(len(items), 1)
        # Should have slept between retries
        mock_sleep.assert_awaited()

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_fetch_export_not_ready_exhausts_attempts(self, mock_client_cls, mock_sleep):
        """When export is never ready, _fetch_export raises after FETCH_MAX_ATTEMPTS."""
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        not_ready_resp = MagicMock()
        not_ready_resp.json.return_value = _make_not_ready_response()
        not_ready_resp.raise_for_status = MagicMock()

        mock_client.get = AsyncMock(return_value=not_ready_resp)

        with self.assertRaises(RuntimeError) as ctx:
            await self.service._fetch_export(
                "https://example.com", "key", 123,
            )
        self.assertIn("не готовы", str(ctx.exception))

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_fetch_export_rate_limit_retries(self, mock_client_cls, mock_sleep):
        """When rate-limited, _fetch_export retries with backoff."""
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # First call: rate limited, second call: exported
        response1 = MagicMock()
        response1.json.return_value = _make_rate_limit_response()
        response1.raise_for_status = MagicMock()

        response2 = MagicMock()
        response2.json.return_value = _make_exported_response([{"id": 1}])
        response2.raise_for_status = MagicMock()

        mock_client.get = AsyncMock(side_effect=[response1, response2])

        items = await self.service._fetch_export(
            "https://example.com", "key", 456,
        )
        self.assertEqual(len(items), 1)
        mock_sleep.assert_awaited()


class TestFetchHttpRetry(unittest.IsolatedAsyncioTestCase):
    """Transient HTTP errors in _fetch_export should be retried up to FETCH_MAX_ATTEMPTS."""

    def setUp(self):
        self.service = GetCourseService()

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_transient_http_error_is_retried(self, mock_client_cls, mock_sleep):
        """A single HTTP error should be retried, not crash the fetch."""
        import httpx as _httpx

        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # First call: timeout error, second call: exported
        error_response = _httpx.TimeoutException("read timeout")
        ok_response = MagicMock()
        ok_response.json.return_value = _make_exported_response([{"id": 1}])
        ok_response.raise_for_status = MagicMock()

        mock_client.get = AsyncMock(side_effect=[error_response, ok_response])

        items = await self.service._fetch_export(
            "https://example.com", "key", 100,
        )
        self.assertEqual(len(items), 1)

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_too_many_http_errors_raises(self, mock_client_cls, mock_sleep):
        """FETCH_MAX_ATTEMPTS consecutive HTTP errors should raise RuntimeError."""
        import httpx as _httpx

        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_client.get = AsyncMock(
            side_effect=_httpx.TimeoutException("timeout")
        )

        with self.assertRaises(RuntimeError) as ctx:
            await self.service._fetch_export(
                "https://example.com", "key", 200,
            )
        self.assertIn("HTTP error after", str(ctx.exception))


class TestFetchCancellation(unittest.IsolatedAsyncioTestCase):
    """cancel_flag should stop _fetch_export."""

    def setUp(self):
        self.service = GetCourseService()

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_cancel_flag_stops_fetch(self, mock_client_cls, mock_sleep):
        """Setting cancel_flag should raise CancelledError."""
        cancel = asyncio.Event()
        cancel.set()  # already cancelled

        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        with self.assertRaises(asyncio.CancelledError):
            await self.service._fetch_export(
                "https://example.com", "key", 300,
                cancel_flag=cancel,
            )


if __name__ == "__main__":
    unittest.main()
