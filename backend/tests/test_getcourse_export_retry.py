"""Regression tests for GetCourse n8n-style export flow.

Issue #167: Restructure export flow to match n8n — request all 3 exports first
(with pauses between them), then fetch all results. This gives each export
maximum processing time on GetCourse's side.

Previous issue #165: Increased pauses to 5 min, added configurable pause_minutes.
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.getcourse_service import (
    GetCourseService,
    EXPORT_PAUSE,
)


def _make_export_response(export_id: int):
    """Mock response for export request."""
    return {"success": True, "info": {"export_id": export_id}}


def _make_not_ready_response():
    return {"success": False, "error_message": "Файл еще не создан"}


def _make_exported_response(items=None):
    return {"success": True, "info": {"status": "exported", "items": items or []}}


class TestExportPauseIs5Minutes(unittest.TestCase):
    """Issue #165: Pause between exports must be 5 min (matching n8n)."""

    def test_export_pause_is_300_seconds(self):
        self.assertEqual(EXPORT_PAUSE, 300)


class TestN8nStyleFlow(unittest.TestCase):
    """Issue #167: Request all exports first, then fetch all results."""

    def test_requests_all_3_before_fetching(self):
        """All 3 export requests must happen before any fetch."""
        service = GetCourseService()

        # Track order of operations
        operation_log: list[str] = []
        export_id_counter = [0]

        def request_json():
            export_id_counter[0] += 1
            eid = export_id_counter[0]
            operation_log.append(f"request_{eid}")
            return _make_export_response(eid)

        request_mock = MagicMock()
        request_mock.raise_for_status = MagicMock()
        request_mock.json = request_json

        def poll_json():
            operation_log.append("fetch")
            return _make_exported_response([])

        poll_mock = MagicMock()
        poll_mock.raise_for_status = MagicMock()
        poll_mock.json = poll_json

        def mock_get(url, params=None):
            if "/exports/" in url:
                return poll_mock
            return request_mock

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=mock_get)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                asyncio.run(
                    service._request_and_poll_exports(
                        "https://test.getcourse.ru", "key",
                        "2026-03-21", "2026-03-21",
                        pause_seconds=0,  # skip pauses for speed
                    )
                )

        # All 3 requests should come before any fetch
        self.assertEqual(operation_log[:3], ["request_1", "request_2", "request_3"])
        # Then 3 fetches
        self.assertEqual(operation_log[3:], ["fetch", "fetch", "fetch"])

    def test_pauses_between_requests_not_fetches(self):
        """Pauses should happen between request phases, not between fetches."""
        service = GetCourseService()

        sleep_context: list[str] = []  # track when sleeps happen
        phase = ["requesting"]

        export_id_counter = [0]

        def request_json():
            export_id_counter[0] += 1
            return _make_export_response(export_id_counter[0])

        request_mock = MagicMock()
        request_mock.raise_for_status = MagicMock()
        request_mock.json = request_json

        poll_mock = MagicMock()
        poll_mock.raise_for_status = MagicMock()
        poll_mock.json = MagicMock(return_value=_make_exported_response([]))

        def mock_get(url, params=None):
            if "/exports/" in url:
                phase[0] = "fetching"
                return poll_mock
            return request_mock

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=mock_get)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        async def track_sleep(seconds):
            sleep_context.append(phase[0])

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", side_effect=track_sleep):
                asyncio.run(
                    service._request_and_poll_exports(
                        "https://test.getcourse.ru", "key",
                        "2026-03-21", "2026-03-21",
                        pause_seconds=300,
                    )
                )

        # All sleeps should happen during "requesting" phase (pauses between requests)
        # No sleeps during "fetching" phase (exports should be ready)
        for ctx in sleep_context:
            self.assertEqual(ctx, "requesting",
                             f"Sleep happened during {ctx} phase, should only be during requesting")

    def test_custom_pause_seconds(self):
        """Custom pause_seconds should be used between export requests."""
        service = GetCourseService()

        sleep_durations: list[int] = []
        export_id_counter = [0]

        def request_json():
            export_id_counter[0] += 1
            return _make_export_response(export_id_counter[0])

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

        async def track_sleep(seconds):
            sleep_durations.append(seconds)

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

        # 2 pauses × 600s (in 60s heartbeat chunks) = 1200s total
        total_sleep = sum(sleep_durations)
        self.assertEqual(total_sleep, 2 * custom_pause)


class TestSleepWithHeartbeat(unittest.TestCase):
    """Issue #165: Long sleeps must send heartbeats to prevent stale detection."""

    def test_heartbeat_sent_during_wait(self):
        """_sleep_with_heartbeat should call on_progress periodically."""
        progress_calls = []

        async def mock_progress(event, detail):
            progress_calls.append((event, detail))

        with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
            asyncio.run(
                GetCourseService._sleep_with_heartbeat(
                    180, mock_progress, None,
                    {"detail": "waiting", "poll_count": 0},
                )
            )

        # 180s / 60s = 3 heartbeats
        self.assertEqual(len(progress_calls), 3)
        self.assertEqual(progress_calls[-1][1]["elapsed_seconds"], 180)

    def test_cancel_during_wait(self):
        """_sleep_with_heartbeat should raise CancelledError if cancel_flag is set."""
        cancel = asyncio.Event()
        cancel.set()

        with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
            with self.assertRaises(asyncio.CancelledError):
                asyncio.run(
                    GetCourseService._sleep_with_heartbeat(300, None, cancel)
                )


class TestConfigurablePause(unittest.TestCase):
    """Issue #165: pause_seconds parameter flows through the call chain."""

    def test_pause_default_is_300(self):
        self.assertEqual(EXPORT_PAUSE, 300)


class TestExportValidation(unittest.TestCase):
    """Issue #169: If any export fails, don't save partial data."""

    def test_partial_failure_raises_with_details(self):
        """If one export fails, RuntimeError lists which failed and which succeeded."""
        service = GetCourseService()

        export_id_counter = [0]

        def request_json():
            export_id_counter[0] += 1
            return _make_export_response(export_id_counter[0])

        request_mock = MagicMock()
        request_mock.raise_for_status = MagicMock()
        request_mock.json = request_json

        # Users and payments succeed, deals times out
        fetch_count = [0]

        def poll_json():
            fetch_count[0] += 1
            if fetch_count[0] <= 2:  # users and payments
                return _make_exported_response([{"data": "ok"}])
            return _make_not_ready_response()  # deals — never ready

        poll_mock = MagicMock()
        poll_mock.raise_for_status = MagicMock()
        poll_mock.json = poll_json

        def mock_get(url, params=None):
            if "/exports/" in url:
                return poll_mock
            return request_mock

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=mock_get)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                with self.assertRaises(RuntimeError) as ctx:
                    asyncio.run(
                        service._request_and_poll_exports(
                            "https://test.getcourse.ru", "key",
                            "2026-03-21", "2026-03-21",
                            pause_seconds=0,
                        )
                    )

        error_msg = str(ctx.exception)
        self.assertIn("deals", error_msg)
        self.assertIn("users", error_msg)
        self.assertIn("payments", error_msg)
        self.assertIn("Не все данные получены", error_msg)
        self.assertIn("Данные не сохранены", error_msg)

    def test_all_succeed_returns_data(self):
        """When all 3 exports succeed, returns all data normally."""
        service = GetCourseService()

        export_id_counter = [0]

        def request_json():
            export_id_counter[0] += 1
            return _make_export_response(export_id_counter[0])

        request_mock = MagicMock()
        request_mock.raise_for_status = MagicMock()
        request_mock.json = request_json

        poll_mock = MagicMock()
        poll_mock.raise_for_status = MagicMock()
        poll_mock.json = MagicMock(return_value=_make_exported_response([{"id": 1}]))

        def mock_get(url, params=None):
            if "/exports/" in url:
                return poll_mock
            return request_mock

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=mock_get)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                users, payments, deals = asyncio.run(
                    service._request_and_poll_exports(
                        "https://test.getcourse.ru", "key",
                        "2026-03-21", "2026-03-21",
                        pause_seconds=0,
                    )
                )

        self.assertEqual(len(users), 1)
        self.assertEqual(len(payments), 1)
        self.assertEqual(len(deals), 1)

    def test_progress_reports_export_failed(self):
        """On failure, progress callback should receive 'export_failed' event."""
        service = GetCourseService()
        progress_events = []

        async def on_progress(event, detail):
            progress_events.append((event, detail))

        export_id_counter = [0]

        def request_json():
            export_id_counter[0] += 1
            return _make_export_response(export_id_counter[0])

        request_mock = MagicMock()
        request_mock.raise_for_status = MagicMock()
        request_mock.json = request_json

        # All exports timeout (never ready)
        poll_mock = MagicMock()
        poll_mock.raise_for_status = MagicMock()
        poll_mock.json = MagicMock(return_value=_make_not_ready_response())

        def mock_get(url, params=None):
            if "/exports/" in url:
                return poll_mock
            return request_mock

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=mock_get)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                with self.assertRaises(RuntimeError):
                    asyncio.run(
                        service._request_and_poll_exports(
                            "https://test.getcourse.ru", "key",
                            "2026-03-21", "2026-03-21",
                            pause_seconds=0,
                            on_progress=on_progress,
                        )
                    )

        failed_events = [e for e in progress_events if e[0] == "export_failed"]
        self.assertEqual(len(failed_events), 3)
        failed_types = [e[1]["export_type"] for e in failed_events]
        self.assertEqual(failed_types, ["users", "payments", "deals"])


if __name__ == "__main__":
    unittest.main()
