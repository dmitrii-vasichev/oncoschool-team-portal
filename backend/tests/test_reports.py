"""Tests for reports module — Phase R1 + Phase R2."""

import unittest
from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from app.db.models import (
    ContentRole,
    ContentSubSection,
    DailyMetric,
    GetCourseCredentials,
    TelegramNotificationTarget,
)
from app.db.schemas import (
    CollectRequest,
    DailyMetricResponse,
    DailyMetricWithDelta,
    ReportSummaryResponse,
    ReportScheduleResponse,
    GetCourseCredentialsResponse,
    BackfillRequest,
    BackfillResponse,
)
from app.services.getcourse_service import GetCourseService
from app.services.report_scheduler_service import (
    ReportSchedulerService,
    REPORT_SCHEDULE_KEY,
    CLEANUP_RETENTION_DAYS,
)


class TestContentEnums(unittest.TestCase):
    """R1.1 — enum extensions."""

    def test_content_sub_section_has_reports(self) -> None:
        self.assertEqual(ContentSubSection.reports.value, "reports")

    def test_content_sub_section_telegram_analysis_unchanged(self) -> None:
        self.assertEqual(ContentSubSection.telegram_analysis.value, "telegram_analysis")

    def test_content_role_has_viewer(self) -> None:
        self.assertEqual(ContentRole.viewer.value, "viewer")

    def test_content_role_order(self) -> None:
        roles = list(ContentRole)
        names = [r.name for r in roles]
        self.assertEqual(names, ["viewer", "operator", "editor"])


class TestDailyMetricModel(unittest.TestCase):
    """R1.2 — DailyMetric model basic checks."""

    def test_tablename(self) -> None:
        self.assertEqual(DailyMetric.__tablename__, "daily_metrics")

    def test_unique_constraint_exists(self) -> None:
        constraint_names = [
            c.name for c in DailyMetric.__table_args__ if hasattr(c, "name")
        ]
        self.assertIn("uq_daily_metrics_source_date", constraint_names)


class TestGetCourseCredentialsModel(unittest.TestCase):
    """R1.3 — GetCourseCredentials model basic checks."""

    def test_tablename(self) -> None:
        self.assertEqual(GetCourseCredentials.__tablename__, "getcourse_credentials")


class TestTelegramNotificationTargetType(unittest.TestCase):
    """R1.5 — type column on TelegramNotificationTarget."""

    def test_type_column_exists(self) -> None:
        columns = {c.name for c in TelegramNotificationTarget.__table__.columns}
        self.assertIn("type", columns)


class TestGetCourseServiceAggregation(unittest.TestCase):
    """R1.6 — GetCourseService pure aggregation helpers."""

    def test_count_users_returns_row_count(self) -> None:
        """#163: users_count = len(rows), items are arrays."""
        rows = [
            ["a@test.com", "Иванов", "2026-03-15"],
            ["b@test.com", "Петров", "2026-03-15"],
            ["c@test.com", "Сидоров", "2026-03-15"],
        ]
        self.assertEqual(GetCourseService._count_users(rows), 3)

    def test_count_users_empty(self) -> None:
        self.assertEqual(GetCourseService._count_users([]), 0)

    def test_count_users_two_rows(self) -> None:
        rows = [["100"], ["200"]]
        self.assertEqual(GetCourseService._count_users(rows), 2)

    def test_sum_payments_uses_column_index(self) -> None:
        """#163: payments pre-filtered by status=accepted in request.
        Sum from column index 7."""
        from app.services.getcourse_service import PAYMENT_PRICE_INDEX
        row1 = [""] * (PAYMENT_PRICE_INDEX + 1)
        row1[PAYMENT_PRICE_INDEX] = "1000.50"
        row2 = [""] * (PAYMENT_PRICE_INDEX + 1)
        row2[PAYMENT_PRICE_INDEX] = "200"
        count, total = GetCourseService._sum_payments([row1, row2])
        self.assertEqual(count, 2)
        self.assertEqual(total, Decimal("1200.50"))

    def test_sum_payments_empty(self) -> None:
        count, total = GetCourseService._sum_payments([])
        self.assertEqual(count, 0)
        self.assertEqual(total, Decimal("0"))

    def test_sum_orders_positive_cost_only(self) -> None:
        """#163: orders counted where column[10] > 0."""
        from app.services.getcourse_service import ORDER_SUM_INDEX
        row1 = [""] * (ORDER_SUM_INDEX + 1)
        row1[ORDER_SUM_INDEX] = "5000"
        row2 = [""] * (ORDER_SUM_INDEX + 1)
        row2[ORDER_SUM_INDEX] = "0"
        row3 = [""] * (ORDER_SUM_INDEX + 1)
        row3[ORDER_SUM_INDEX] = "3000.75"
        count, total = GetCourseService._sum_orders([row1, row2, row3])
        self.assertEqual(count, 2)
        self.assertEqual(total, Decimal("8000.75"))

    def test_sum_orders_empty(self) -> None:
        count, total = GetCourseService._sum_orders([])
        self.assertEqual(count, 0)
        self.assertEqual(total, Decimal("0"))


class TestGetCourseServiceCollectMetrics(unittest.IsolatedAsyncioTestCase):
    """R1.6 — collect_metrics with mocked HTTP and DB."""

    @staticmethod
    def _make_session_maker():
        """Create a mock async session_maker for testing."""
        mock_session = AsyncMock()
        mock_begin = AsyncMock()
        mock_begin.__aenter__ = AsyncMock(return_value=None)
        mock_begin.__aexit__ = AsyncMock(return_value=False)
        mock_session.begin = MagicMock(return_value=mock_begin)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        session_maker = MagicMock(return_value=mock_session)
        return session_maker, mock_session

    async def test_collect_metrics_orchestrates_3_exports(self) -> None:
        service = GetCourseService()

        # Mock _read_creds to bypass credential DB lookup
        service._read_creds = AsyncMock(
            return_value=("https://school.getcourse.io", "plain_api_key")
        )

        # Mock metrics repo
        mock_metric = MagicMock(spec=DailyMetric)
        service._metrics_repo = MagicMock()
        service._metrics_repo.upsert = AsyncMock(return_value=mock_metric)

        # Mock _request_export and _fetch_export (array-based items, #163)
        from app.services.getcourse_service import PAYMENT_PRICE_INDEX, ORDER_SUM_INDEX
        payment_row = [""] * (PAYMENT_PRICE_INDEX + 1)
        payment_row[PAYMENT_PRICE_INDEX] = "1000"
        order_row = [""] * (ORDER_SUM_INDEX + 1)
        order_row[ORDER_SUM_INDEX] = "5000"

        service._request_export = AsyncMock(side_effect=[101, 102, 103])
        service._fetch_export = AsyncMock(
            side_effect=[
                # users (2 rows)
                [["a@test.com", "Иванов"], ["b@test.com", "Петров"]],
                # payments (1 row, pre-filtered by status=accepted)
                [payment_row],
                # deals (1 row with positive cost)
                [order_row],
            ]
        )

        session_maker, _ = self._make_session_maker()

        with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
            result = await service.collect_metrics(session_maker, date(2026, 3, 19))

        # Verify 3 exports requested
        self.assertEqual(service._request_export.await_count, 3)
        # Verify 3 fetches
        self.assertEqual(service._fetch_export.await_count, 3)
        # Verify upsert called with correct aggregated values
        service._metrics_repo.upsert.assert_awaited_once()
        call_kwargs = service._metrics_repo.upsert.await_args
        self.assertEqual(call_kwargs.kwargs["users_count"], 2)
        self.assertEqual(call_kwargs.kwargs["payments_count"], 1)
        self.assertEqual(call_kwargs.kwargs["payments_sum"], Decimal("1000"))
        self.assertEqual(call_kwargs.kwargs["orders_count"], 1)
        self.assertEqual(call_kwargs.kwargs["orders_sum"], Decimal("5000"))
        self.assertIs(result, mock_metric)

    async def test_collect_metrics_no_credentials_raises(self) -> None:
        service = GetCourseService()
        service._creds_repo = MagicMock()
        service._creds_repo.get = AsyncMock(return_value=None)

        session_maker, _ = self._make_session_maker()
        with self.assertRaises(RuntimeError, msg="GetCourse credentials not configured"):
            await service.collect_metrics(session_maker, date(2026, 3, 19))


# ===========================================================================
# Phase R2 tests
# ===========================================================================


class TestPydanticSchemas(unittest.TestCase):
    """R2.1 — Pydantic schemas for reports API."""

    def test_daily_metric_response_from_attributes(self) -> None:
        self.assertTrue(DailyMetricResponse.model_config.get("from_attributes"))

    def test_daily_metric_with_delta_inherits(self) -> None:
        self.assertTrue(issubclass(DailyMetricWithDelta, DailyMetricResponse))

    def test_report_summary_response_fields(self) -> None:
        fields = set(ReportSummaryResponse.model_fields.keys())
        expected = {
            "days", "date_from", "date_to",
            "total_users", "total_payments_count", "total_payments_sum",
            "total_orders_count", "total_orders_sum",
            "avg_users_per_day", "avg_payments_sum_per_day", "avg_orders_sum_per_day",
            "metrics",
        }
        self.assertTrue(expected.issubset(fields))

    def test_collect_request_has_date(self) -> None:
        req = CollectRequest(date=date(2026, 3, 19))
        self.assertEqual(req.date, date(2026, 3, 19))

    def test_report_schedule_response_fields(self) -> None:
        r = ReportScheduleResponse(
            collection_time="05:45", send_time="06:30",
            timezone="Europe/Moscow", enabled=True,
        )
        self.assertEqual(r.collection_time, "05:45")
        self.assertEqual(r.send_time, "06:30")
        self.assertTrue(r.enabled)

    def test_getcourse_credentials_response_no_key(self) -> None:
        r = GetCourseCredentialsResponse(configured=True, base_url="https://example.com")
        # Ensure no api_key field in response
        self.assertNotIn("api_key", GetCourseCredentialsResponse.model_fields)

    def test_backfill_request_fields(self) -> None:
        req = BackfillRequest(date_from=date(2026, 1, 1), date_to=date(2026, 3, 19))
        self.assertEqual(req.date_from, date(2026, 1, 1))


class TestReportSchedulerService(unittest.IsolatedAsyncioTestCase):
    """R2.2 — ReportSchedulerService tests."""

    def _make_service(self) -> ReportSchedulerService:
        bot = MagicMock()
        session_maker = MagicMock()
        return ReportSchedulerService(bot=bot, session_maker=session_maker)

    async def test_check_and_collect_skips_when_disabled(self) -> None:
        service = self._make_service()
        service._get_schedule = AsyncMock(return_value={
            "collection_time": "05:45", "send_time": "06:30",
            "timezone": "Europe/Moscow", "enabled": False,
        })
        service._getcourse_service.collect_metrics = AsyncMock()

        await service._check_and_collect()

        service._getcourse_service.collect_metrics.assert_not_awaited()

    async def test_check_and_collect_no_double_run(self) -> None:
        service = self._make_service()
        service._collected_today = date.today()
        service._get_schedule = AsyncMock(return_value={
            "collection_time": "05:45", "send_time": "06:30",
            "timezone": "Europe/Moscow", "enabled": True,
        })
        service._getcourse_service.collect_metrics = AsyncMock()

        await service._check_and_collect()

        service._getcourse_service.collect_metrics.assert_not_awaited()

    async def test_check_and_send_skips_before_send_time(self) -> None:
        service = self._make_service()
        service._get_schedule = AsyncMock(return_value={
            "collection_time": "05:45", "send_time": "23:59",
            "timezone": "Europe/Moscow", "enabled": True,
        })
        service._send_report_notification = AsyncMock()

        await service._check_and_send()

        service._send_report_notification.assert_not_awaited()

    async def test_check_and_send_waits_for_collection(self) -> None:
        service = self._make_service()
        service._collected_today = None  # not collected yet
        service._get_schedule = AsyncMock(return_value={
            "collection_time": "05:45", "send_time": "00:00",
            "timezone": "Europe/Moscow", "enabled": True,
        })
        service._send_report_notification = AsyncMock()

        await service._check_and_send()

        # Should not send because collection hasn't finished
        service._send_report_notification.assert_not_awaited()

    async def test_check_and_send_no_double_send(self) -> None:
        service = self._make_service()
        service._sent_today = date.today()
        service._get_schedule = AsyncMock(return_value={
            "collection_time": "05:45", "send_time": "00:00",
            "timezone": "Europe/Moscow", "enabled": True,
        })
        service._send_report_notification = AsyncMock()

        await service._check_and_send()

        service._send_report_notification.assert_not_awaited()

    async def test_legacy_schedule_migration(self) -> None:
        """Old schedule with single 'time' field should be migrated."""
        service = self._make_service()
        mock_setting = MagicMock()
        mock_setting.value = {"time": "05:45", "timezone": "Europe/Moscow", "enabled": True}

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        service.session_maker = MagicMock(return_value=mock_session)
        service._app_settings_repo.get = AsyncMock(return_value=mock_setting)

        schedule = await service._get_schedule()

        self.assertEqual(schedule["collection_time"], "05:45")
        self.assertEqual(schedule["send_time"], "06:30")
        self.assertTrue(schedule["enabled"])

    async def test_cleanup_old_metrics_calls_delete(self) -> None:
        service = self._make_service()
        mock_session = AsyncMock()
        mock_begin = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_begin.__aenter__ = AsyncMock(return_value=None)
        mock_begin.__aexit__ = AsyncMock(return_value=False)
        mock_session.begin = MagicMock(return_value=mock_begin)

        service.session_maker = MagicMock(return_value=mock_session)
        service._metrics_repo.delete_older_than = AsyncMock(return_value=5)

        await service._cleanup_old_metrics()

        service._metrics_repo.delete_older_than.assert_awaited_once()
        call_args = service._metrics_repo.delete_older_than.await_args
        self.assertEqual(call_args.args[1], "getcourse")
        # Cutoff should be ~180 days ago
        cutoff = call_args.args[2]
        expected = date.today() - timedelta(days=CLEANUP_RETENTION_DAYS)
        self.assertEqual(cutoff, expected)


class TestReportMessageFormatting(unittest.TestCase):
    """R2.4 — Telegram notification message formatting."""

    def _make_metric(self, **kwargs) -> MagicMock:
        metric = MagicMock()
        metric.users_count = kwargs.get("users_count", 100)
        metric.payments_count = kwargs.get("payments_count", 10)
        metric.payments_sum = kwargs.get("payments_sum", Decimal("50000"))
        metric.orders_count = kwargs.get("orders_count", 5)
        metric.orders_sum = kwargs.get("orders_sum", Decimal("30000"))
        metric.metric_date = kwargs.get("metric_date", date(2026, 3, 19))
        return metric

    def test_format_with_deltas(self) -> None:
        metric = self._make_metric(users_count=120, payments_sum=Decimal("60000"))
        prev = self._make_metric(users_count=100, payments_sum=Decimal("50000"))

        text = ReportSchedulerService._format_report_message(
            metric, prev, date(2026, 3, 19)
        )

        self.assertIn("19.03.2026", text)
        self.assertIn("120", text)
        self.assertIn("\u2191", text)  # up arrow for users

    def test_format_no_previous_no_deltas(self) -> None:
        metric = self._make_metric()

        text = ReportSchedulerService._format_report_message(
            metric, None, date(2026, 3, 19)
        )

        self.assertIn("19.03.2026", text)
        self.assertIn("100", text)
        self.assertNotIn("\u2191", text)
        self.assertNotIn("\u2193", text)

    def test_format_negative_delta_shows_down_arrow(self) -> None:
        metric = self._make_metric(users_count=80)
        prev = self._make_metric(users_count=100)

        text = ReportSchedulerService._format_report_message(
            metric, prev, date(2026, 3, 19)
        )

        self.assertIn("\u2193", text)  # down arrow

    def test_format_zero_delta_shows_right_arrow(self) -> None:
        metric = self._make_metric(users_count=100)
        prev = self._make_metric(users_count=100)

        text = ReportSchedulerService._format_report_message(
            metric, prev, date(2026, 3, 19)
        )

        self.assertIn("\u2192", text)  # right arrow


class TestBackfillLogic(unittest.IsolatedAsyncioTestCase):
    """R2.5 — Backfill tests."""

    async def test_backfill_calls_collect_metrics_range(self) -> None:
        bot = MagicMock()
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_begin = AsyncMock()
        mock_begin.__aenter__ = AsyncMock(return_value=None)
        mock_begin.__aexit__ = AsyncMock(return_value=False)
        mock_session.begin = MagicMock(return_value=mock_begin)

        session_maker = MagicMock(return_value=mock_session)

        service = ReportSchedulerService(bot=bot, session_maker=session_maker)

        service._getcourse_service.collect_metrics_range = AsyncMock(
            return_value={"collected": 3, "total_days": 3}
        )
        service._app_settings_repo.set = AsyncMock()

        await service.run_backfill(
            date(2026, 3, 17), date(2026, 3, 19)
        )

        service._getcourse_service.collect_metrics_range.assert_awaited_once()

    async def test_backfill_handles_errors(self) -> None:
        bot = MagicMock()
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_begin = AsyncMock()
        mock_begin.__aenter__ = AsyncMock(return_value=None)
        mock_begin.__aexit__ = AsyncMock(return_value=False)
        mock_session.begin = MagicMock(return_value=mock_begin)

        session_maker = MagicMock(return_value=mock_session)

        service = ReportSchedulerService(bot=bot, session_maker=session_maker)

        # collect_metrics_range fails
        service._getcourse_service.collect_metrics_range = AsyncMock(
            side_effect=RuntimeError("API error")
        )
        service._app_settings_repo.set = AsyncMock()

        # Should not raise — handles errors gracefully
        await service.run_backfill(date(2026, 3, 19), date(2026, 3, 19))


class TestRequestExportHTTPMethod(unittest.IsolatedAsyncioTestCase):
    """Regression: _request_export must use GET with query params (not POST body)."""

    async def test_request_export_uses_get_with_query_params(self) -> None:
        """GetCourse API requires GET with filters as query parameters."""
        service = GetCourseService()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={
            "success": True,
            "info": {"export_id": 42},
        })

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            export_id = await service._request_export(
                "https://school.getcourse.ru", "secret", "users", "2026-03-13", "2026-03-19"
            )

        self.assertEqual(export_id, 42)
        mock_client.get.assert_awaited_once()
        # Must NOT call post
        mock_client.post.assert_not_awaited()

        call_kwargs = mock_client.get.await_args
        sent_params = call_kwargs.kwargs.get("params") or call_kwargs.args[1] if len(call_kwargs.args) > 1 else call_kwargs.kwargs.get("params")
        self.assertIn("created_at[from]", sent_params)
        self.assertIn("created_at[to]", sent_params)
        # exported_at must NOT be used
        self.assertNotIn("exported_at[from]", sent_params)

    async def test_request_export_uses_created_at_for_all_types(self) -> None:
        """All export types (users, payments, deals) must use created_at filter."""
        service = GetCourseService()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={
            "success": True,
            "info": {"export_id": 1},
        })

        for export_type in ("users", "payments", "deals"):
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)

            with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
                await service._request_export(
                    "https://school.getcourse.ru", "secret", export_type, "2026-03-01", "2026-03-19"
                )

            call_kwargs = mock_client.get.await_args
            sent_params = call_kwargs.kwargs.get("params")
            self.assertIn("created_at[from]", sent_params, f"{export_type} must use created_at[from]")
            self.assertIn("created_at[to]", sent_params, f"{export_type} must use created_at[to]")


class TestFetchExportNotReady(unittest.IsolatedAsyncioTestCase):
    """Regression: _fetch_export must retry when file is not yet created."""

    async def test_fetch_continues_on_file_not_ready(self) -> None:
        """'Файл еще не создан' is a normal intermediate state — retried up to FETCH_MAX_ATTEMPTS."""
        service = GetCourseService()

        not_ready = MagicMock()
        not_ready.status_code = 200
        not_ready.raise_for_status = MagicMock()
        not_ready.json = MagicMock(return_value={
            "success": False,
            "error_message": "Файл еще не создан",
        })

        ready = MagicMock()
        ready.status_code = 200
        ready.raise_for_status = MagicMock()
        ready.json = MagicMock(return_value={
            "success": True,
            "info": {"status": "exported", "items": [{"email": "a@test.com"}]},
        })

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=[not_ready, ready])
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                items = await service._fetch_export(
                    "https://school.getcourse.ru", "secret", 42
                )

        self.assertEqual(len(items), 1)
        self.assertEqual(mock_client.get.await_count, 2)

    async def test_fetch_raises_on_real_error(self) -> None:
        """Genuine API errors should still raise immediately."""
        service = GetCourseService()

        error_resp = MagicMock()
        error_resp.status_code = 200
        error_resp.raise_for_status = MagicMock()
        error_resp.json = MagicMock(return_value={
            "success": False,
            "error_message": "Неверный ключ API",
        })

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=error_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with self.assertRaises(RuntimeError, msg="Неверный ключ API"):
                await service._fetch_export(
                    "https://school.getcourse.ru", "secret", 42
                )


class TestRateLimitRetry(unittest.IsolatedAsyncioTestCase):
    """Regression #126: rate limit responses must be retried, not raised."""

    async def test_fetch_retries_on_rate_limit(self) -> None:
        """'Слишком много запросов' during fetch should wait and retry."""
        service = GetCourseService()

        rate_limited = MagicMock()
        rate_limited.status_code = 200
        rate_limited.raise_for_status = MagicMock()
        rate_limited.json = MagicMock(return_value={
            "success": False,
            "error_message": "Слишком много запросов",
        })

        ready = MagicMock()
        ready.status_code = 200
        ready.raise_for_status = MagicMock()
        ready.json = MagicMock(return_value={
            "success": True,
            "info": {"status": "exported", "items": [{"email": "a@test.com"}]},
        })

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=[rate_limited, ready])
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                items = await service._fetch_export(
                    "https://school.getcourse.ru", "secret", 42
                )

        self.assertEqual(len(items), 1)
        self.assertEqual(mock_client.get.await_count, 2)
        # Should have waited with rate limit backoff (30s base * attempt 1)
        mock_sleep.assert_any_await(30)

    async def test_request_retries_on_rate_limit(self) -> None:
        """'Слишком много запросов' during export request should wait and retry."""
        service = GetCourseService()

        rate_limited = MagicMock()
        rate_limited.status_code = 200
        rate_limited.raise_for_status = MagicMock()
        rate_limited.json = MagicMock(return_value={
            "success": False,
            "error_message": "Слишком много запросов",
        })

        success = MagicMock()
        success.status_code = 200
        success.raise_for_status = MagicMock()
        success.json = MagicMock(return_value={
            "success": True,
            "info": {"export_id": 99},
        })

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=[rate_limited, success])
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                export_id = await service._request_export(
                    "https://school.getcourse.ru", "secret", "users", "2026-03-13", "2026-03-19"
                )

        self.assertEqual(export_id, 99)
        self.assertEqual(mock_client.get.await_count, 2)
        mock_sleep.assert_any_await(30)

    async def test_request_rate_limit_does_not_consume_error_retries(self) -> None:
        """Rate limit retries must NOT consume error retry attempts (#128)."""
        service = GetCourseService()

        rate_limited = MagicMock()
        rate_limited.status_code = 200
        rate_limited.raise_for_status = MagicMock()
        rate_limited.json = MagicMock(return_value={
            "success": False,
            "error_message": "Слишком много запросов",
        })

        success = MagicMock()
        success.status_code = 200
        success.raise_for_status = MagicMock()
        success.json = MagicMock(return_value={
            "success": True,
            "info": {"export_id": 77},
        })

        # 4 rate limits then success — would fail with old code (MAX_RETRIES=3)
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(
            side_effect=[rate_limited, rate_limited, rate_limited, rate_limited, success]
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock):
                export_id = await service._request_export(
                    "https://school.getcourse.ru", "secret", "users", "2026-03-14", "2026-03-20"
                )

        self.assertEqual(export_id, 77)
        # 5 calls total: 4 rate-limited + 1 success
        self.assertEqual(mock_client.get.await_count, 5)

    async def test_exports_have_pauses_between_them(self) -> None:
        """n8n-style flow (#167): pauses happen between export requests.

        Phase 1: request users → pause → request payments → pause → request deals
        Phase 2: fetch all 3 (no pauses needed, exports already processed)
        """
        service = GetCourseService()

        # Mock _request_export and _fetch_export directly
        service._request_export = AsyncMock(side_effect=[1, 2, 3])
        service._fetch_export = AsyncMock(side_effect=[
            [{"email": "a@test.com"}],
            [{"status": "accepted", "amount": "100"}],
            [{"status": "finished", "cost": "500"}],
        ])

        with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await service._request_and_poll_exports(
                "https://school.getcourse.ru", "secret", "2026-03-13", "2026-03-19"
            )

        # Two inter-request pauses (in 60s heartbeat chunks)
        from app.services.getcourse_service import EXPORT_PAUSE
        sleep_calls = [c.args[0] for c in mock_sleep.await_args_list]
        total_sleep = sum(sleep_calls)
        self.assertEqual(total_sleep, 2 * EXPORT_PAUSE)


class TestRateLimitExponentialBackoff(unittest.IsolatedAsyncioTestCase):
    """Regression #130: rate limit retries must use exponential backoff."""

    async def test_request_export_uses_exponential_backoff(self) -> None:
        """Rate limit delays should increase: 30s, 60s, 120s (capped)."""
        service = GetCourseService()

        rate_limited = MagicMock()
        rate_limited.status_code = 200
        rate_limited.raise_for_status = MagicMock()
        rate_limited.json = MagicMock(return_value={
            "success": False,
            "error_message": "Слишком много запросов",
        })

        success = MagicMock()
        success.status_code = 200
        success.raise_for_status = MagicMock()
        success.json = MagicMock(return_value={
            "success": True,
            "info": {"export_id": 55},
        })

        # 3 rate limits then success
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(
            side_effect=[rate_limited, rate_limited, rate_limited, success]
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                export_id = await service._request_export(
                    "https://school.getcourse.ru", "secret", "users", "2026-03-14", "2026-03-20"
                )

        self.assertEqual(export_id, 55)
        # Delays: 30s (30*2^0), 60s (30*2^1), 120s (30*2^2)
        sleep_calls = [c.args[0] for c in mock_sleep.await_args_list]
        self.assertEqual(sleep_calls, [30, 60, 120])

    async def test_backoff_caps_at_max_delay(self) -> None:
        """Exponential backoff should cap at RATE_LIMIT_MAX_DELAY (120s)."""
        service = GetCourseService()

        rate_limited = MagicMock()
        rate_limited.status_code = 200
        rate_limited.raise_for_status = MagicMock()
        rate_limited.json = MagicMock(return_value={
            "success": False,
            "error_message": "Слишком много запросов",
        })

        success = MagicMock()
        success.status_code = 200
        success.raise_for_status = MagicMock()
        success.json = MagicMock(return_value={
            "success": True,
            "info": {"export_id": 66},
        })

        # 5 rate limits then success — delays: 30, 60, 120, 120, 120
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(
            side_effect=[rate_limited] * 5 + [success]
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.getcourse_service.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.getcourse_service.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                export_id = await service._request_export(
                    "https://school.getcourse.ru", "secret", "users", "2026-03-14", "2026-03-20"
                )

        self.assertEqual(export_id, 66)
        sleep_calls = [c.args[0] for c in mock_sleep.await_args_list]
        # 30, 60, 120, 120, 120 — capped at 120
        self.assertEqual(sleep_calls, [30, 60, 120, 120, 120])


if __name__ == "__main__":
    unittest.main()
