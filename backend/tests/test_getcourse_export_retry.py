"""Regression tests for GetCourse export retry-on-timeout and configurable pause.

Issue #165: Export times out after 900s because initial wait (3 min) is too short
compared to n8n's 5 min. Also adds retry logic — if poll times out, request a new
export_id and try again (up to MAX_EXPORT_RETRIES).
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch, call

from app.services.getcourse_service import (
    GetCourseService,
    POLL_INITIAL_WAIT_SECONDS,
    POLL_INTERVAL_SECONDS,
    EXPORT_PAUSE,
    MAX_EXPORT_RETRIES,
)


def _make_export_response(export_id: int):
    """Mock response for export request."""
    return {"success": True, "info": {"export_id": export_id}}


def _make_not_ready_response():
    return {"success": False, "error_message": "Файл еще не создан"}


def _make_exported_response(items=None):
    return {"success": True, "info": {"status": "exported", "items": items or []}}


class TestInitialWaitIs5Minutes(unittest.TestCase):
    """Issue #165: Initial wait before polling must be 5 min (matching n8n)."""

    def test_initial_wait_is_300_seconds(self):
        self.assertEqual(POLL_INITIAL_WAIT_SECONDS, 300)

    def test_export_pause_is_300_seconds(self):
        self.assertEqual(EXPORT_PAUSE, 300)


class TestRetryOnTimeout(unittest.TestCase):
    """Issue #165: On poll timeout, retry with a new export_id."""

    def setUp(self):
        self.service = GetCourseService()

    def test_max_export_retries_is_2(self):
        self.assertEqual(MAX_EXPORT_RETRIES, 2)

    def test_retry_succeeds_on_second_attempt(self):
        """If first poll times out, second attempt with new export should succeed."""
        # First request_export returns id=100, second returns id=200
        request_responses = [
            _make_export_response(100),
            _make_export_response(200),
        ]
        request_call_count = 0

        def request_json():
            nonlocal request_call_count
            result = request_responses[request_call_count]
            request_call_count += 1
            return result

        request_mock_response = MagicMock()
        request_mock_response.raise_for_status = MagicMock()
        request_mock_response.json = request_json

        # First poll: timeout (always "not ready")
        # Second poll: success
        poll_responses = {}
        poll_responses[100] = _make_not_ready_response  # always not ready
        poll_responses[200] = None  # will be overridden below

        poll_call_count = 0
        current_export_id = [None]

        def poll_json():
            nonlocal poll_call_count
            poll_call_count += 1
            eid = current_export_id[0]
            if eid == 100:
                return _make_not_ready_response()
            return _make_exported_response([{"data": "ok"}])

        poll_mock_response = MagicMock()
        poll_mock_response.raise_for_status = MagicMock()
        poll_mock_response.json = poll_json

        def mock_get(url, params=None):
            if "/exports/" in url:
                # Extract export_id from URL
                eid = int(url.split("/exports/")[1])
                current_export_id[0] = eid
                return poll_mock_response
            return request_mock_response

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=mock_get)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                result = asyncio.run(
                    self.service._request_and_poll_export(
                        "https://test.getcourse.ru", "key", "users",
                        "2026-03-21", "2026-03-21",
                        timeout=10, initial_wait=0,
                    )
                )

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["data"], "ok")
        # Two export requests were made
        self.assertEqual(request_call_count, 2)

    def test_all_retries_exhausted_raises_timeout(self):
        """If all retry attempts time out, TimeoutError is raised."""
        request_mock_response = MagicMock()
        request_mock_response.raise_for_status = MagicMock()
        export_id_counter = [0]

        def request_json():
            export_id_counter[0] += 1
            return _make_export_response(export_id_counter[0])

        request_mock_response.json = request_json

        poll_mock_response = MagicMock()
        poll_mock_response.raise_for_status = MagicMock()
        poll_mock_response.json = MagicMock(return_value=_make_not_ready_response())

        def mock_get(url, params=None):
            if "/exports/" in url:
                return poll_mock_response
            return request_mock_response

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=mock_get)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                with self.assertRaises(TimeoutError):
                    asyncio.run(
                        self.service._request_and_poll_export(
                            "https://test.getcourse.ru", "key", "users",
                            "2026-03-21", "2026-03-21",
                            timeout=10, initial_wait=0,
                        )
                    )

        # Should have requested MAX_EXPORT_RETRIES exports
        self.assertEqual(export_id_counter[0], MAX_EXPORT_RETRIES)


class TestSleepWithHeartbeat(unittest.TestCase):
    """Issue #165: Long sleeps must send heartbeats to prevent stale detection."""

    def test_heartbeat_sent_during_wait(self):
        """_sleep_with_heartbeat should call on_progress periodically."""
        service = GetCourseService
        progress_calls = []

        async def mock_progress(event, detail):
            progress_calls.append((event, detail))

        with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
            asyncio.run(
                service._sleep_with_heartbeat(
                    180, mock_progress, None,
                    {"detail": "initial_wait", "poll_count": 0},
                )
            )

        # 180s / 60s = 3 heartbeats
        self.assertEqual(len(progress_calls), 3)
        # Last heartbeat should report elapsed = 180
        self.assertEqual(progress_calls[-1][1]["elapsed_seconds"], 180)

    def test_cancel_during_wait(self):
        """_sleep_with_heartbeat should raise CancelledError if cancel_flag is set."""
        service = GetCourseService
        cancel = asyncio.Event()
        cancel.set()

        with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
            with self.assertRaises(asyncio.CancelledError):
                asyncio.run(
                    service._sleep_with_heartbeat(300, None, cancel)
                )


class TestConfigurablePause(unittest.TestCase):
    """Issue #165: pause_seconds parameter flows through the call chain."""

    def test_request_and_poll_exports_uses_custom_pause(self):
        """Custom pause_seconds should be passed to initial_wait and inter-export sleep."""
        service = GetCourseService()

        sleep_durations = []

        async def track_sleep(seconds):
            sleep_durations.append(seconds)

        # Mock all 3 exports to succeed immediately
        export_counter = [0]
        def request_json():
            export_counter[0] += 1
            return _make_export_response(export_counter[0])

        request_mock = MagicMock()
        request_mock.raise_for_status = MagicMock()
        request_mock.json = request_json

        poll_mock = MagicMock()
        poll_mock.raise_for_status = MagicMock()
        poll_mock.json = MagicMock(return_value=_make_exported_response([]))

        def mock_get(url, params=None):
            if "/exports/" in url:
                return poll_mock
            return request_mock

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=mock_get)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        custom_pause = 600  # 10 minutes

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", side_effect=track_sleep):
                asyncio.run(
                    service._request_and_poll_exports(
                        "https://test.getcourse.ru", "key",
                        "2026-03-21", "2026-03-21",
                        pause_seconds=custom_pause,
                    )
                )

        # Should have 3 initial waits of 60s chunks (custom_pause=600, chunks=60s each = 10 chunks per wait)
        # Plus 2 inter-export pauses (also 600s in 60s chunks)
        # Total sleep calls: 10 + 10 + 10 + 10 + 10 = 50 (3 initial waits + 2 inter-export pauses)
        # But we just verify the total sleep time equals expected
        total_sleep = sum(sleep_durations)
        # 3 exports × 600s initial_wait + 2 inter-export × 600s = 3000s
        self.assertEqual(total_sleep, custom_pause * 5)  # 3 initial + 2 pauses


if __name__ == "__main__":
    unittest.main()
