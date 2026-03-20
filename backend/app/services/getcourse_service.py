"""GetCourse API integration — async export flow for daily metrics collection."""

import asyncio
import logging
from datetime import date, datetime
from decimal import Decimal

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DailyMetric, GetCourseCredentials
from app.db.repositories import DailyMetricRepository, GetCourseCredentialsRepository
from app.utils.encryption import decrypt

logger = logging.getLogger(__name__)

# Export poll settings
POLL_INTERVAL_SECONDS = 3
POLL_MAX_WAIT_SECONDS = 600
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2


class GetCourseService:
    """Collects daily metrics from GetCourse via the async export API."""

    def __init__(self) -> None:
        self._creds_repo = GetCourseCredentialsRepository()
        self._metrics_repo = DailyMetricRepository()

    # ------------------------------------------------------------------
    # Credentials
    # ------------------------------------------------------------------

    async def _get_credentials(
        self, session: AsyncSession
    ) -> GetCourseCredentials | None:
        return await self._creds_repo.get(session)

    # ------------------------------------------------------------------
    # GetCourse export API helpers
    # ------------------------------------------------------------------

    async def _request_export(
        self,
        base_url: str,
        api_key: str,
        export_type: str,
        date_from: str,
        date_to: str,
    ) -> int:
        """Request an export and return the export_id.

        export_type: 'users' | 'payments' | 'deals'
        """
        url = f"{base_url}/pl/api/account/{export_type}"
        params: dict = {"key": api_key}

        if export_type == "users":
            params["exported_at[from]"] = date_from
            params["exported_at[to]"] = date_to
        else:
            # payments and deals use created_at
            params["created_at[from]"] = date_from
            params["created_at[to]"] = date_to

        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    response = await client.post(url, params=params)
                    response.raise_for_status()
                    data = response.json()

                if not data.get("success"):
                    raise RuntimeError(
                        f"GetCourse export request failed: {data.get('error_message', data)}"
                    )

                export_id = data["info"]["export_id"]
                logger.info(
                    "Export requested: type=%s, export_id=%d", export_type, export_id
                )
                return export_id

            except (httpx.HTTPStatusError, httpx.RequestError, KeyError) as e:
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_BASE_DELAY ** (attempt + 1)
                    logger.warning(
                        "Export request attempt %d failed (%s), retrying in %ds",
                        attempt + 1,
                        e,
                        delay,
                    )
                    await asyncio.sleep(delay)
                else:
                    raise

        raise RuntimeError("Unreachable")  # pragma: no cover

    async def _poll_export(
        self,
        base_url: str,
        api_key: str,
        export_id: int,
        timeout: int = POLL_MAX_WAIT_SECONDS,
    ) -> list[dict]:
        """Poll until the export is ready and return the items list."""
        url = f"{base_url}/pl/api/account/exports/{export_id}"
        params = {"key": api_key}
        elapsed = 0

        while elapsed < timeout:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

            if not data.get("success"):
                raise RuntimeError(
                    f"GetCourse export poll failed: {data.get('error_message', data)}"
                )

            info = data.get("info", {})
            status = info.get("status")

            if status == "exported":
                items = info.get("items", [])
                logger.info(
                    "Export %d ready: %d items", export_id, len(items)
                )
                return items

            if status == "error":
                raise RuntimeError(f"GetCourse export {export_id} failed on server side")

            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            elapsed += POLL_INTERVAL_SECONDS

        raise TimeoutError(
            f"GetCourse export {export_id} did not complete within {timeout}s"
        )

    # ------------------------------------------------------------------
    # Aggregation helpers (pure logic, no HTTP)
    # ------------------------------------------------------------------

    @staticmethod
    def _count_users(rows: list[dict]) -> int:
        """Count unique users from export rows."""
        emails = set()
        for row in rows:
            email = row.get("email") or row.get("id")
            if email:
                emails.add(email)
        return len(emails)

    @staticmethod
    def _sum_payments(rows: list[dict]) -> tuple[int, Decimal]:
        """Count payments and sum amounts. Returns (count, total_sum)."""
        count = 0
        total = Decimal("0")
        for row in rows:
            status = row.get("status", "")
            if status in ("accepted", "approved", "success"):
                count += 1
                amount = row.get("amount") or row.get("cost") or 0
                total += Decimal(str(amount))
        return count, total

    @staticmethod
    def _sum_orders(rows: list[dict]) -> tuple[int, Decimal]:
        """Count completed orders and sum amounts. Returns (count, total_sum)."""
        count = 0
        total = Decimal("0")
        for row in rows:
            status = row.get("status", "")
            if status in ("finished", "completed", "paid"):
                count += 1
                cost = row.get("cost") or row.get("amount") or 0
                total += Decimal(str(cost))
        return count, total

    # ------------------------------------------------------------------
    # Main orchestration
    # ------------------------------------------------------------------

    async def collect_metrics(
        self,
        session: AsyncSession,
        target_date: date,
        collected_by_id=None,
    ) -> DailyMetric:
        """Run 3 exports (users, payments, deals), aggregate, and upsert into daily_metrics."""
        creds = await self._get_credentials(session)
        if not creds:
            raise RuntimeError("GetCourse credentials not configured")

        base_url = creds.base_url.rstrip("/")
        api_key = decrypt(creds.api_key_encrypted)

        date_from = target_date.isoformat()
        date_to = target_date.isoformat()

        # Request all 3 exports in parallel
        user_export_id, payment_export_id, deals_export_id = await asyncio.gather(
            self._request_export(base_url, api_key, "users", date_from, date_to),
            self._request_export(base_url, api_key, "payments", date_from, date_to),
            self._request_export(base_url, api_key, "deals", date_from, date_to),
        )

        # Poll all 3 exports in parallel
        user_rows, payment_rows, deal_rows = await asyncio.gather(
            self._poll_export(base_url, api_key, user_export_id),
            self._poll_export(base_url, api_key, payment_export_id),
            self._poll_export(base_url, api_key, deals_export_id),
        )

        # Aggregate
        users_count = self._count_users(user_rows)
        payments_count, payments_sum = self._sum_payments(payment_rows)
        orders_count, orders_sum = self._sum_orders(deal_rows)

        logger.info(
            "Metrics for %s: users=%d, payments=%d/%.2f, orders=%d/%.2f",
            target_date,
            users_count,
            payments_count,
            payments_sum,
            orders_count,
            orders_sum,
        )

        # Upsert
        metric = await self._metrics_repo.upsert(
            session,
            source="getcourse",
            metric_date=target_date,
            users_count=users_count,
            payments_count=payments_count,
            payments_sum=payments_sum,
            orders_count=orders_count,
            orders_sum=orders_sum,
            collected_at=datetime.utcnow(),
            collected_by_id=collected_by_id,
        )

        return metric
