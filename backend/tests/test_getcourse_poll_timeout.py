"""Regression tests for GetCourse export polling timeout behavior.

Issue #139: Rate-limit delays were counted toward export timeout budget,
causing premature TimeoutError even though the export was still processing.
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.getcourse_service import (
    GetCourseService,
    POLL_INTERVAL_SECONDS,
    POLL_MAX_WAIT_SECONDS,
    RATE_LIMIT_BASE_DELAY,
    RATE_LIMIT_MAX_DELAY,
    MAX_RATE_LIMIT_RETRIES,
)


def _make_rate_limit_response():
    """Return a mock response with rate-limit error."""
    return {"success": False, "error_message": "Слишком много запросов"}


def _make_not_ready_response():
    """Return a mock response for 'file not yet created'."""
    return {"success": False, "error_message": "Файл еще не создан"}


def _make_exported_response(items=None):
    """Return a mock response for a completed export."""
    return {"success": True, "info": {"status": "exported", "items": items or []}}


def _make_processing_response():
    """Return a mock response for an in-progress export."""
    return {"success": True, "info": {"status": "processing"}}


class TestPollExportRateLimitNotCountedInTimeout(unittest.TestCase):
    """Rate-limit delays must NOT count toward the export timeout."""

    def setUp(self):
        self.service = GetCourseService()

    def test_rate_limits_do_not_consume_timeout_budget(self):
        """Even with many rate-limit pauses, the export should succeed
        if the actual processing time is within the timeout."""
        responses = []
        # Simulate 5 rate-limit responses followed by success
        for _ in range(5):
            responses.append(_make_rate_limit_response())
        responses.append(_make_exported_response([{"id": 1}]))

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        call_count = 0

        def json_side_effect():
            nonlocal call_count
            result = responses[call_count]
            call_count += 1
            return result

        mock_response.json = json_side_effect

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                result = asyncio.run(
                    self.service._poll_export("https://test.getcourse.ru", "key", 12345, timeout=10)
                )

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], 1)
        # All 6 calls made (5 rate-limit + 1 success)
        self.assertEqual(call_count, 6)

    def test_timeout_fires_on_actual_processing_time(self):
        """Timeout should fire based on non-rate-limit elapsed time only."""
        # Return "not ready" responses indefinitely (simulating long processing)
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value=_make_not_ready_response())

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                with self.assertRaises(TimeoutError) as ctx:
                    asyncio.run(
                        self.service._poll_export("https://test.getcourse.ru", "key", 99999, timeout=10)
                    )

        self.assertIn("did not complete within 10s", str(ctx.exception))


class TestPollExportRateLimitBackoff(unittest.TestCase):
    """Rate-limit delays should use exponential backoff."""

    def setUp(self):
        self.service = GetCourseService()

    def test_exponential_backoff_on_rate_limit(self):
        """Rate-limit delays should increase exponentially up to the cap."""
        responses = []
        # 4 rate-limit responses, then success
        for _ in range(4):
            responses.append(_make_rate_limit_response())
        responses.append(_make_exported_response())

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        call_count = 0

        def json_side_effect():
            nonlocal call_count
            result = responses[call_count]
            call_count += 1
            return result

        mock_response.json = json_side_effect

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        sleep_delays = []

        async def mock_sleep(seconds):
            sleep_delays.append(seconds)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", side_effect=mock_sleep):
                asyncio.run(
                    self.service._poll_export("https://test.getcourse.ru", "key", 12345, timeout=10)
                )

        # Verify exponential backoff: 30, 60, 120, 120 (capped)
        expected_delays = [
            min(RATE_LIMIT_BASE_DELAY * (2 ** i), RATE_LIMIT_MAX_DELAY)
            for i in range(4)
        ]
        self.assertEqual(sleep_delays, expected_delays)

    def test_max_rate_limit_retries_raises(self):
        """After MAX_RATE_LIMIT_RETRIES rate-limit responses, raise RuntimeError."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value=_make_rate_limit_response())

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                with self.assertRaises(RuntimeError) as ctx:
                    asyncio.run(
                        self.service._poll_export("https://test.getcourse.ru", "key", 12345, timeout=9999)
                    )

        self.assertIn("rate limited", str(ctx.exception))


class TestPollMaxWaitConstant(unittest.TestCase):
    """Verify the timeout constant was increased."""

    def test_poll_max_wait_is_1200(self):
        self.assertEqual(POLL_MAX_WAIT_SECONDS, 1200)


if __name__ == "__main__":
    unittest.main()
