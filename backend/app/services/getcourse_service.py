"""GetCourse API integration — async export flow for daily metrics collection."""

import asyncio
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models import DailyMetric, GetCourseCredentials
from app.db.repositories import DailyMetricRepository, GetCourseCredentialsRepository
from app.utils.encryption import decrypt

logger = logging.getLogger(__name__)

# Export poll settings
POLL_INTERVAL_SECONDS = 60
POLL_MAX_WAIT_SECONDS = 1200
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2

# Rate limit handling
RATE_LIMIT_BASE_DELAY = 30  # initial seconds to wait on rate limit
RATE_LIMIT_MAX_DELAY = 120  # max seconds to wait on rate limit (exponential backoff cap)
MAX_RATE_LIMIT_RETRIES = 30  # max rate-limit waits (separate from error retries)
EXPORT_PAUSE = 30  # seconds between sequential export requests

# Scaled timeout for multi-day ranges
POLL_SECONDS_PER_DAY = 600  # 10 min per day in range
POLL_MAX_TIMEOUT_CAP = 7200  # absolute cap: 2 hours



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

        # All export types use created_at filter
        params["created_at[from]"] = date_from
        params["created_at[to]"] = date_to

        attempt = 0
        rate_limit_count = 0

        while attempt < MAX_RETRIES:
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    response = await client.get(url, params=params)
                    response.raise_for_status()
                    data = response.json()

                if not data.get("success"):
                    error_msg = str(data.get("error_message", ""))
                    if "слишком много" in error_msg.lower():
                        rate_limit_count += 1
                        if rate_limit_count > MAX_RATE_LIMIT_RETRIES:
                            raise RuntimeError(
                                f"GetCourse export request failed: rate limited {rate_limit_count} times"
                            )
                        delay = min(
                            RATE_LIMIT_BASE_DELAY * (2 ** (rate_limit_count - 1)),
                            RATE_LIMIT_MAX_DELAY,
                        )
                        logger.warning(
                            "Rate limited on export request (%s), attempt %d, waiting %ds...",
                            export_type, rate_limit_count, delay,
                        )
                        await asyncio.sleep(delay)
                        continue  # does NOT increment attempt
                    raise RuntimeError(
                        f"GetCourse export request failed: {error_msg or data}"
                    )

                export_id = data["info"]["export_id"]
                logger.info(
                    "Export requested: type=%s, export_id=%d", export_type, export_id
                )
                return export_id

            except (httpx.HTTPStatusError, httpx.RequestError, KeyError) as e:
                attempt += 1
                if attempt < MAX_RETRIES:
                    delay = RETRY_BASE_DELAY ** attempt
                    logger.warning(
                        "Export request attempt %d failed (%s), retrying in %ds",
                        attempt, e, delay,
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
        """Poll until the export is ready and return the items list.

        Rate-limit delays do NOT count toward the timeout because the export
        continues processing on GetCourse's side while we wait.
        """
        url = f"{base_url}/pl/api/account/exports/{export_id}"
        params = {"key": api_key}
        elapsed = 0
        rate_limit_count = 0

        while elapsed < timeout:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

            if not data.get("success"):
                error_msg = str(data.get("error_message", ""))
                # "Файл еще не создан" = file not yet created — normal intermediate state
                if "еще не создан" in error_msg.lower():
                    logger.debug("Export %d not ready yet, retrying...", export_id)
                    await asyncio.sleep(POLL_INTERVAL_SECONDS)
                    elapsed += POLL_INTERVAL_SECONDS
                    continue
                # "Слишком много запросов" = rate limited — wait with backoff
                # NOT counted toward timeout: export keeps processing server-side
                if "слишком много" in error_msg.lower():
                    rate_limit_count += 1
                    if rate_limit_count > MAX_RATE_LIMIT_RETRIES:
                        raise RuntimeError(
                            f"GetCourse export {export_id} poll: rate limited {rate_limit_count} times"
                        )
                    delay = min(
                        RATE_LIMIT_BASE_DELAY * (2 ** (rate_limit_count - 1)),
                        RATE_LIMIT_MAX_DELAY,
                    )
                    logger.warning(
                        "Rate limited polling export %d, attempt %d, waiting %ds...",
                        export_id, rate_limit_count, delay,
                    )
                    await asyncio.sleep(delay)
                    # elapsed NOT incremented — export still processing
                    continue
                raise RuntimeError(
                    f"GetCourse export poll failed: {error_msg or data}"
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
    # Date extraction for grouping
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_date(row: dict, date_fields: tuple[str, ...]) -> date | None:
        """Extract a date from a row, trying multiple field names."""
        for field in date_fields:
            val = row.get(field)
            if not val:
                continue
            try:
                return datetime.fromisoformat(str(val).replace(" ", "T")).date()
            except (ValueError, TypeError):
                try:
                    return datetime.strptime(str(val)[:10], "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    continue
        return None

    @staticmethod
    def _group_by_date(
        rows: list[dict], date_fields: tuple[str, ...]
    ) -> dict[date, list[dict]]:
        """Group export rows by date."""
        grouped: dict[date, list[dict]] = defaultdict(list)
        for row in rows:
            d = GetCourseService._extract_date(row, date_fields)
            if d:
                grouped[d].append(row)
        return grouped

    # ------------------------------------------------------------------
    # Main orchestration
    # ------------------------------------------------------------------

    async def _get_creds(self, session: AsyncSession) -> tuple[str, str]:
        """Return (base_url, api_key) or raise."""
        creds = await self._get_credentials(session)
        if not creds:
            raise RuntimeError("GetCourse credentials not configured")
        return creds.base_url.rstrip("/"), decrypt(creds.api_key_encrypted)

    async def _read_creds(self, session_maker: async_sessionmaker) -> tuple[str, str]:
        """Read credentials using a short-lived session (no long holds)."""
        async with session_maker() as session:
            return await self._get_creds(session)

    async def _request_and_poll_export(
        self, base_url: str, api_key: str, export_type: str,
        date_from: str, date_to: str,
        timeout: int = POLL_MAX_WAIT_SECONDS,
    ) -> list[dict]:
        """Request a single export and poll until ready before returning."""
        export_id = await self._request_export(
            base_url, api_key, export_type, date_from, date_to
        )
        return await self._poll_export(base_url, api_key, export_id, timeout=timeout)

    @staticmethod
    def _scaled_timeout(date_from: str, date_to: str) -> int:
        """Calculate poll timeout scaled to the date range size.

        Single-day exports keep the default 1200s (20 min).
        Multi-day ranges get 600s (10 min) per day, capped at 7200s (2h).
        """
        try:
            d_from = date.fromisoformat(date_from)
            d_to = date.fromisoformat(date_to)
            days = max((d_to - d_from).days + 1, 1)
        except (ValueError, TypeError):
            days = 1
        return min(max(POLL_MAX_WAIT_SECONDS, days * POLL_SECONDS_PER_DAY), POLL_MAX_TIMEOUT_CAP)

    async def _request_and_poll_exports(
        self, base_url: str, api_key: str, date_from: str, date_to: str
    ) -> tuple[list[dict], list[dict], list[dict]]:
        """Request and poll 3 exports sequentially with pauses between them."""
        timeout = self._scaled_timeout(date_from, date_to)
        logger.info(
            "Export timeout for range %s..%s: %ds", date_from, date_to, timeout
        )

        user_rows = await self._request_and_poll_export(
            base_url, api_key, "users", date_from, date_to, timeout=timeout
        )
        logger.info("Pausing %ds before next export request...", EXPORT_PAUSE)
        await asyncio.sleep(EXPORT_PAUSE)

        payment_rows = await self._request_and_poll_export(
            base_url, api_key, "payments", date_from, date_to, timeout=timeout
        )
        logger.info("Pausing %ds before next export request...", EXPORT_PAUSE)
        await asyncio.sleep(EXPORT_PAUSE)

        deal_rows = await self._request_and_poll_export(
            base_url, api_key, "deals", date_from, date_to, timeout=timeout
        )
        return user_rows, payment_rows, deal_rows

    async def collect_metrics(
        self,
        session_maker: async_sessionmaker,
        target_date: date,
        collected_by_id=None,
    ) -> DailyMetric:
        """Run 3 exports (users, payments, deals), aggregate, and upsert into daily_metrics.

        Uses separate DB sessions for reading credentials and writing results,
        so the connection is NOT held during long HTTP polling.
        """
        # Phase 1: Read credentials (short-lived session)
        base_url, api_key = await self._read_creds(session_maker)
        date_str = target_date.isoformat()

        # Phase 2: HTTP polling — no DB connection held
        user_rows, payment_rows, deal_rows = await self._request_and_poll_exports(
            base_url, api_key, date_str, date_str
        )

        # Phase 3: Aggregate (pure computation)
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

        # Phase 4: Save to DB (short-lived session)
        async with session_maker() as session:
            async with session.begin():
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

    async def collect_metrics_range(
        self,
        session_maker: async_sessionmaker,
        range_from: date,
        range_to: date,
        collected_by_id=None,
    ) -> dict[str, int]:
        """Collect metrics for an entire date range with just 3 API requests.

        Uses separate DB sessions for reading credentials and writing results,
        so the connection is NOT held during long HTTP polling.

        Returns dict with collected/skipped/failed counts.
        """
        # Phase 1: Read credentials (short-lived session)
        base_url, api_key = await self._read_creds(session_maker)

        logger.info(
            "Range collection: requesting exports for %s to %s", range_from, range_to
        )

        # Phase 2: HTTP polling — no DB connection held
        user_rows, payment_rows, deal_rows = await self._request_and_poll_exports(
            base_url, api_key, range_from.isoformat(), range_to.isoformat()
        )

        # Phase 3: Aggregate (pure computation)
        user_date_fields = ("created_at", "addDate", "registration_date", "exported_at")
        payment_date_fields = ("created_at", "payDate")
        deal_date_fields = ("created_at", "dealDate")

        users_by_date = self._group_by_date(user_rows, user_date_fields)
        payments_by_date = self._group_by_date(payment_rows, payment_date_fields)
        deals_by_date = self._group_by_date(deal_rows, deal_date_fields)

        logger.info(
            "Range collection: got %d user rows, %d payment rows, %d deal rows",
            len(user_rows), len(payment_rows), len(deal_rows),
        )

        # Phase 4: Save to DB (short-lived session)
        collected = 0
        total_days = (range_to - range_from).days + 1

        async with session_maker() as session:
            async with session.begin():
                for i in range(total_days):
                    current_date = range_from + timedelta(days=i)
                    day_users = users_by_date.get(current_date, [])
                    day_payments = payments_by_date.get(current_date, [])
                    day_deals = deals_by_date.get(current_date, [])

                    users_count = self._count_users(day_users)
                    payments_count, payments_sum = self._sum_payments(day_payments)
                    orders_count, orders_sum = self._sum_orders(day_deals)

                    await self._metrics_repo.upsert(
                        session,
                        source="getcourse",
                        metric_date=current_date,
                        users_count=users_count,
                        payments_count=payments_count,
                        payments_sum=payments_sum,
                        orders_count=orders_count,
                        orders_sum=orders_sum,
                        collected_at=datetime.utcnow(),
                        collected_by_id=collected_by_id,
                    )
                    collected += 1

        logger.info("Range collection completed: %d days upserted", collected)
        return {"collected": collected, "total_days": total_days}
