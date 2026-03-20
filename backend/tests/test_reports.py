"""Tests for Phase R1: reports module — enums, models, GetCourseService aggregation."""

import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from app.db.models import (
    ContentRole,
    ContentSubSection,
    DailyMetric,
    GetCourseCredentials,
    TelegramNotificationTarget,
)
from app.services.getcourse_service import GetCourseService


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

    def test_count_users_unique_by_email(self) -> None:
        rows = [
            {"email": "a@test.com", "id": "1"},
            {"email": "b@test.com", "id": "2"},
            {"email": "a@test.com", "id": "3"},  # duplicate email
        ]
        self.assertEqual(GetCourseService._count_users(rows), 2)

    def test_count_users_empty(self) -> None:
        self.assertEqual(GetCourseService._count_users([]), 0)

    def test_count_users_fallback_to_id(self) -> None:
        rows = [{"id": "100"}, {"id": "200"}]
        self.assertEqual(GetCourseService._count_users(rows), 2)

    def test_sum_payments_filters_by_status(self) -> None:
        rows = [
            {"status": "accepted", "amount": "1000.50"},
            {"status": "rejected", "amount": "500"},
            {"status": "success", "amount": "200"},
        ]
        count, total = GetCourseService._sum_payments(rows)
        self.assertEqual(count, 2)
        self.assertEqual(total, Decimal("1200.50"))

    def test_sum_payments_empty(self) -> None:
        count, total = GetCourseService._sum_payments([])
        self.assertEqual(count, 0)
        self.assertEqual(total, Decimal("0"))

    def test_sum_orders_filters_by_status(self) -> None:
        rows = [
            {"status": "finished", "cost": "5000"},
            {"status": "pending", "cost": "1000"},
            {"status": "paid", "amount": "3000.75"},
        ]
        count, total = GetCourseService._sum_orders(rows)
        self.assertEqual(count, 2)
        self.assertEqual(total, Decimal("8000.75"))

    def test_sum_orders_empty(self) -> None:
        count, total = GetCourseService._sum_orders([])
        self.assertEqual(count, 0)
        self.assertEqual(total, Decimal("0"))


class TestGetCourseServiceCollectMetrics(unittest.IsolatedAsyncioTestCase):
    """R1.6 — collect_metrics with mocked HTTP and DB."""

    async def test_collect_metrics_orchestrates_3_exports(self) -> None:
        service = GetCourseService()

        # Mock credentials
        mock_creds = MagicMock()
        mock_creds.base_url = "https://school.getcourse.io"
        mock_creds.api_key_encrypted = "encrypted_key"
        service._creds_repo = MagicMock()
        service._creds_repo.get = AsyncMock(return_value=mock_creds)

        # Mock metrics repo
        mock_metric = MagicMock(spec=DailyMetric)
        service._metrics_repo = MagicMock()
        service._metrics_repo.upsert = AsyncMock(return_value=mock_metric)

        # Mock decrypt
        with patch("app.services.getcourse_service.decrypt", return_value="plain_api_key"):
            # Mock _request_export and _poll_export
            service._request_export = AsyncMock(side_effect=[101, 102, 103])
            service._poll_export = AsyncMock(
                side_effect=[
                    # users
                    [{"email": "a@test.com"}, {"email": "b@test.com"}],
                    # payments
                    [{"status": "accepted", "amount": "1000"}],
                    # deals
                    [{"status": "finished", "cost": "5000"}],
                ]
            )

            session = AsyncMock()
            result = await service.collect_metrics(session, date(2026, 3, 19))

        # Verify 3 exports requested
        self.assertEqual(service._request_export.await_count, 3)
        # Verify 3 polls
        self.assertEqual(service._poll_export.await_count, 3)
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

        session = AsyncMock()
        with self.assertRaises(RuntimeError, msg="GetCourse credentials not configured"):
            await service.collect_metrics(session, date(2026, 3, 19))


if __name__ == "__main__":
    unittest.main()
