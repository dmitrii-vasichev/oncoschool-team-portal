"""Regression tests for backfill intermediate progress reporting.

Issue #151: Backfill shows no intermediate progress — user cannot tell
whether data is actually loading, stuck in rate-limit, or failed silently.
The fix adds a progress_callback that reports stage transitions.
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.getcourse_service import GetCourseService


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
    """Verify that on_progress callback fires during export polling."""

    def setUp(self):
        self.service = GetCourseService()
        self.progress_events: list[tuple[str, dict]] = []

        async def _track_progress(event: str, detail: dict) -> None:
            self.progress_events.append((event, detail))

        self.on_progress = _track_progress

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_poll_export_calls_progress_on_not_ready(self, mock_client_cls, mock_sleep):
        """When export is not ready yet, progress callback fires with 'polling' + 'waiting'."""
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

        items = await self.service._poll_export(
            "https://example.com", "key", 123, timeout=300,
            on_progress=self.on_progress,
        )

        self.assertEqual(len(items), 1)
        # Should have fired at least one 'polling' event with detail='waiting'
        polling_events = [e for e in self.progress_events if e[0] == "polling"]
        self.assertGreaterEqual(len(polling_events), 1)
        self.assertEqual(polling_events[0][1]["detail"], "waiting")

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_poll_export_calls_progress_on_rate_limit(self, mock_client_cls, mock_sleep):
        """When rate-limited, progress callback fires with 'rate_limited' event."""
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # First call: rate limited, second call: exported
        response1 = MagicMock()
        response1.json.return_value = _make_rate_limit_response()
        response1.raise_for_status = MagicMock()

        response2 = MagicMock()
        response2.json.return_value = _make_exported_response()
        response2.raise_for_status = MagicMock()

        mock_client.get = AsyncMock(side_effect=[response1, response2])

        await self.service._poll_export(
            "https://example.com", "key", 456, timeout=300,
            on_progress=self.on_progress,
        )

        # Should have fired 'rate_limited' event with rate_limit_count
        rl_events = [e for e in self.progress_events if e[0] == "rate_limited"]
        self.assertGreaterEqual(len(rl_events), 1)
        self.assertEqual(rl_events[0][1]["rate_limit_count"], 1)
        self.assertIn("wait_seconds", rl_events[0][1])

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_request_and_poll_exports_reports_stages(self, mock_client_cls, mock_sleep):
        """_request_and_poll_exports fires export_started / export_done for each type."""
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # n8n-style: 3 requests first, then 3 polls
        export_resp = MagicMock()
        export_resp.json.return_value = _make_export_response(10)
        export_resp.raise_for_status = MagicMock()

        poll_resp = MagicMock()
        poll_resp.json.return_value = _make_exported_response([{"id": 1}])
        poll_resp.raise_for_status = MagicMock()

        # Phase 1: 3 requests, Phase 2: 3 polls = 6 total
        mock_client.get = AsyncMock(side_effect=[
            export_resp, export_resp, export_resp,  # all 3 requests
            poll_resp, poll_resp, poll_resp,         # all 3 fetches
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

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_no_progress_callback_still_works(self, mock_client_cls, mock_sleep):
        """Without on_progress, everything works as before (no errors)."""
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        response = MagicMock()
        response.json.return_value = _make_exported_response([{"id": 1}])
        response.raise_for_status = MagicMock()

        mock_client.get = AsyncMock(return_value=response)

        items = await self.service._poll_export(
            "https://example.com", "key", 789, timeout=300,
            on_progress=None,
        )
        self.assertEqual(len(items), 1)


class TestPollHttpRetry(unittest.IsolatedAsyncioTestCase):
    """Regression #159: transient HTTP errors in _poll_export should be retried."""

    def setUp(self):
        self.service = GetCourseService()

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_transient_http_error_is_retried(self, mock_client_cls, mock_sleep):
        """A single HTTP error should be retried, not crash the poll."""
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

        items = await self.service._poll_export(
            "https://example.com", "key", 100, timeout=300,
        )
        self.assertEqual(len(items), 1)

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_too_many_http_errors_raises(self, mock_client_cls, mock_sleep):
        """MAX_POLL_HTTP_ERRORS consecutive HTTP errors should raise RuntimeError."""
        import httpx as _httpx
        from app.services.getcourse_service import MAX_POLL_HTTP_ERRORS

        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_client.get = AsyncMock(
            side_effect=_httpx.TimeoutException("timeout")
        )

        with self.assertRaises(RuntimeError) as ctx:
            await self.service._poll_export(
                "https://example.com", "key", 200, timeout=9999,
            )
        self.assertIn("HTTP errors", str(ctx.exception))


class TestPollCancellation(unittest.IsolatedAsyncioTestCase):
    """Regression #159: cancel_flag should stop polling."""

    def setUp(self):
        self.service = GetCourseService()

    @patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.getcourse_service.httpx.AsyncClient")
    async def test_cancel_flag_stops_poll(self, mock_client_cls, mock_sleep):
        """Setting cancel_flag should raise CancelledError."""
        cancel = asyncio.Event()
        cancel.set()  # already cancelled

        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        with self.assertRaises(asyncio.CancelledError):
            await self.service._poll_export(
                "https://example.com", "key", 300, timeout=300,
                cancel_flag=cancel,
            )


if __name__ == "__main__":
    unittest.main()
