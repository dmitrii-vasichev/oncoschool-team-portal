"""GetCourse API integration — async export flow for daily metrics collection."""

import asyncio
import logging
import time
from collections import defaultdict
from collections.abc import Awaitable, Callable
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

# Progress callback type: async fn(stage, detail_dict)
ProgressCallback = Callable[[str, dict[str, Any]], Awaitable[None]]

from app.db.models import DailyMetric, GetCourseCredentials
from app.db.repositories import DailyMetricRepository, GetCourseCredentialsRepository
from app.utils.encryption import decrypt

logger = logging.getLogger(__name__)

# Export poll settings
POLL_INITIAL_WAIT_SECONDS = 300  # wait 5 min before first poll (matching n8n)
POLL_INTERVAL_SECONDS = 60  # check export status every 60s
POLL_MAX_WAIT_SECONDS = 900  # 15 min base timeout
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2
MAX_POLL_HTTP_ERRORS = 5  # consecutive HTTP errors before aborting poll
MAX_EXPORT_RETRIES = 2  # retry export from scratch on timeout

# Rate limit handling
RATE_LIMIT_BASE_DELAY = 30  # initial seconds to wait on rate limit
RATE_LIMIT_MAX_DELAY = 120  # max seconds to wait on rate limit (exponential backoff cap)
MAX_RATE_LIMIT_RETRIES = 30  # max rate-limit waits (separate from error retries)
EXPORT_PAUSE = 300  # seconds between sequential export requests (5 min, matching n8n)

# Scaled timeout for multi-day ranges
POLL_SECONDS_PER_DAY = 300  # 5 min per day in range (was 600)
POLL_MAX_TIMEOUT_CAP = 7200  # absolute cap: 2 hours

# Column indices in GetCourse export items (stable per account, matches n8n)
PAYMENT_PRICE_INDEX = 7   # payment amount column
ORDER_SUM_INDEX = 10      # order cost ("Стоимость, RUB") column



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

        # Payments: only accepted (matching n8n flow)
        if export_type == "payments":
            params["status"] = "accepted"

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
                    "Export requested: type=%s, id=%d, range=%s..%s",
                    export_type, export_id, date_from, date_to,
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
        on_progress: ProgressCallback | None = None,
        cancel_flag: asyncio.Event | None = None,
    ) -> list:
        """Poll until the export is ready and return the items list.

        Rate-limit delays do NOT count toward the timeout because the export
        continues processing on GetCourse's side while we wait.
        Transient HTTP errors are retried up to MAX_POLL_HTTP_ERRORS times.
        If cancel_flag is set, raises CancelledError.
        """
        url = f"{base_url}/pl/api/account/exports/{export_id}"
        params = {"key": api_key}
        elapsed = 0
        rate_limit_count = 0
        http_error_count = 0
        wall_start = time.monotonic()

        poll_count = 0
        while elapsed < timeout:
            # Check cancellation
            if cancel_flag and cancel_flag.is_set():
                raise asyncio.CancelledError("Backfill cancelled by user")

            poll_count += 1
            wall_elapsed = int(time.monotonic() - wall_start)

            # HTTP request with retry on transient errors
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    response = await client.get(url, params=params)
                    response.raise_for_status()
                    data = response.json()
                http_error_count = 0  # reset on success
            except (httpx.TransportError, httpx.HTTPStatusError) as e:
                http_error_count += 1
                logger.warning(
                    "Export %d poll #%d: HTTP error (%s), attempt %d/%d",
                    export_id, poll_count, e, http_error_count, MAX_POLL_HTTP_ERRORS,
                )
                if http_error_count >= MAX_POLL_HTTP_ERRORS:
                    raise RuntimeError(
                        f"GetCourse export {export_id} poll: {http_error_count} consecutive HTTP errors: {e}"
                    ) from e
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
                elapsed += POLL_INTERVAL_SECONDS
                continue

            if not data.get("success"):
                error_msg = str(data.get("error_message", ""))
                # "Файл еще не создан" = file not yet created — normal intermediate state
                if "еще не создан" in error_msg.lower():
                    logger.info(
                        "Export %d poll #%d: not ready yet (elapsed %ds/%ds)",
                        export_id, poll_count, wall_elapsed, timeout,
                    )
                    if on_progress:
                        await on_progress("polling", {
                            "detail": "waiting",
                            "poll_count": poll_count,
                            "elapsed_seconds": wall_elapsed,
                        })
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
                        "Export %d poll #%d: RATE LIMITED (attempt %d, waiting %ds, elapsed %ds)",
                        export_id, poll_count, rate_limit_count, delay, wall_elapsed,
                    )
                    if on_progress:
                        await on_progress("rate_limited", {
                            "detail": "rate_limited",
                            "rate_limit_count": rate_limit_count,
                            "wait_seconds": delay,
                            "elapsed_seconds": wall_elapsed,
                        })
                    await asyncio.sleep(delay)
                    # elapsed NOT incremented — export still processing
                    continue
                logger.error(
                    "Export %d poll #%d: UNEXPECTED ERROR — %s (full response: %s)",
                    export_id, poll_count, error_msg, data,
                )
                raise RuntimeError(
                    f"GetCourse export poll failed: {error_msg or data}"
                )

            info = data.get("info", {})
            status = info.get("status")

            if status == "exported":
                items = info.get("items", [])
                logger.info(
                    "Export %d ready after %d polls (%ds): %d items",
                    export_id, poll_count, wall_elapsed, len(items),
                )
                return items

            if status == "error":
                logger.error(
                    "Export %d poll #%d: server-side error (info: %s)",
                    export_id, poll_count, info,
                )
                raise RuntimeError(f"GetCourse export {export_id} failed on server side")

            logger.info(
                "Export %d poll #%d: status=%s (elapsed %ds/%ds)",
                export_id, poll_count, status, wall_elapsed, timeout,
            )
            if on_progress:
                await on_progress("polling", {
                    "detail": "processing",
                    "poll_count": poll_count,
                    "elapsed_seconds": wall_elapsed,
                })
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            elapsed += POLL_INTERVAL_SECONDS

        raise TimeoutError(
            f"GetCourse export {export_id} did not complete within {timeout}s "
            f"({poll_count} polls, wall time {int(time.monotonic() - wall_start)}s)"
        )

    # ------------------------------------------------------------------
    # Aggregation helpers (pure logic, no HTTP)
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_decimal(raw: Any) -> Decimal:
        """Parse a numeric value from a GetCourse export cell.

        Handles whitespace separators (including non-breaking spaces) and
        comma as decimal separator — common in Russian-locale exports.
        """
        if not raw:
            return Decimal("0")
        clean = str(raw).replace("\xa0", "").replace(" ", "").replace(",", ".")
        try:
            return Decimal(clean)
        except Exception:
            return Decimal("0")

    @staticmethod
    def _count_users(rows: list) -> int:
        """Count users — each row is one user."""
        return len(rows)

    @staticmethod
    def _sum_payments(rows: list) -> tuple[int, Decimal]:
        """Count payments and sum amounts.

        Payments are pre-filtered by status=accepted in the API request.
        Amount is at column PAYMENT_PRICE_INDEX (index 7).
        """
        count = len(rows)
        total = Decimal("0")
        for row in rows:
            if not isinstance(row, list) or PAYMENT_PRICE_INDEX >= len(row):
                continue
            total += GetCourseService._parse_decimal(row[PAYMENT_PRICE_INDEX])
        return count, total

    @staticmethod
    def _sum_orders(rows: list) -> tuple[int, Decimal]:
        """Count orders with positive cost and sum amounts.

        Cost is at column ORDER_SUM_INDEX (index 10).
        Only rows where cost > 0 are counted (matching n8n logic).
        """
        count = 0
        total = Decimal("0")
        for row in rows:
            if not isinstance(row, list) or ORDER_SUM_INDEX >= len(row):
                continue
            val = GetCourseService._parse_decimal(row[ORDER_SUM_INDEX])
            if val > 0:
                count += 1
                total += val
        return count, total

    # ------------------------------------------------------------------
    # Date extraction for grouping (array-based rows)
    # ------------------------------------------------------------------

    @staticmethod
    def _try_parse_date(val: Any) -> date | None:
        """Try to parse a value as a date."""
        if not val:
            return None
        s = str(val).strip()
        if len(s) < 10:
            return None
        try:
            return datetime.fromisoformat(s.replace(" ", "T")).date()
        except (ValueError, TypeError):
            pass
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass
        return None

    @staticmethod
    def _extract_date_from_row(
        row: list, date_range: tuple[date, date] | None = None
    ) -> date | None:
        """Extract a date from an array row by scanning all columns.

        If date_range is given, only dates within [from, to] are accepted.
        This avoids picking up unrelated date-like strings.
        """
        for val in row:
            d = GetCourseService._try_parse_date(val)
            if d is None:
                continue
            if date_range and not (date_range[0] <= d <= date_range[1]):
                continue
            return d
        return None

    @staticmethod
    def _group_rows_by_date(
        rows: list, date_range: tuple[date, date] | None = None
    ) -> dict[date, list]:
        """Group export rows (arrays) by date."""
        grouped: dict[date, list] = defaultdict(list)
        for row in rows:
            if not isinstance(row, list):
                continue
            d = GetCourseService._extract_date_from_row(row, date_range)
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

    @staticmethod
    async def _sleep_with_heartbeat(
        seconds: int,
        on_progress: ProgressCallback | None,
        cancel_flag: asyncio.Event | None,
        heartbeat_detail: dict[str, Any] | None = None,
    ) -> None:
        """Sleep for `seconds`, sending heartbeat every 60s to prevent stale detection."""
        heartbeat_interval = 60
        waited = 0
        while waited < seconds:
            if cancel_flag and cancel_flag.is_set():
                raise asyncio.CancelledError("Cancelled by user")
            chunk = min(heartbeat_interval, seconds - waited)
            await asyncio.sleep(chunk)
            waited += chunk
            if on_progress and heartbeat_detail:
                await on_progress("polling", {
                    **heartbeat_detail,
                    "elapsed_seconds": waited,
                })

    async def _request_and_poll_export(
        self, base_url: str, api_key: str, export_type: str,
        date_from: str, date_to: str,
        timeout: int = POLL_MAX_WAIT_SECONDS,
        initial_wait: int = POLL_INITIAL_WAIT_SECONDS,
        on_progress: ProgressCallback | None = None,
        cancel_flag: asyncio.Event | None = None,
    ) -> list:
        """Request a single export, wait for it to process, then poll until ready.

        On timeout, retries with a new export_id (up to MAX_EXPORT_RETRIES times).
        """
        last_error: Exception | None = None

        for attempt in range(1, MAX_EXPORT_RETRIES + 1):
            export_id = await self._request_export(
                base_url, api_key, export_type, date_from, date_to
            )

            logger.info(
                "Export %d requested (attempt %d/%d), waiting %ds before polling...",
                export_id, attempt, MAX_EXPORT_RETRIES, initial_wait,
            )
            if on_progress:
                await on_progress("polling", {
                    "detail": "initial_wait",
                    "poll_count": 0,
                    "elapsed_seconds": 0,
                    "attempt": attempt,
                })
            await self._sleep_with_heartbeat(
                initial_wait, on_progress, cancel_flag,
                {"detail": "initial_wait", "poll_count": 0, "attempt": attempt},
            )

            try:
                return await self._poll_export(
                    base_url, api_key, export_id, timeout=timeout,
                    on_progress=on_progress, cancel_flag=cancel_flag,
                )
            except TimeoutError as e:
                last_error = e
                if attempt < MAX_EXPORT_RETRIES:
                    logger.warning(
                        "Export %d timed out (attempt %d/%d), retrying with new export...",
                        export_id, attempt, MAX_EXPORT_RETRIES,
                    )
                    if on_progress:
                        await on_progress("retry", {
                            "detail": "timeout_retry",
                            "attempt": attempt,
                            "max_attempts": MAX_EXPORT_RETRIES,
                        })
                else:
                    logger.error(
                        "Export %d timed out (attempt %d/%d), no more retries",
                        export_id, attempt, MAX_EXPORT_RETRIES,
                    )

        raise last_error  # type: ignore[misc]

    @staticmethod
    def _scaled_timeout(date_from: str, date_to: str) -> int:
        """Calculate poll timeout scaled to the date range size.

        Single-day: 300s (5 min). Multi-day: 300s per day, capped at 7200s (2h).
        """
        try:
            d_from = date.fromisoformat(date_from)
            d_to = date.fromisoformat(date_to)
            days = max((d_to - d_from).days + 1, 1)
        except (ValueError, TypeError):
            days = 1
        return min(max(POLL_MAX_WAIT_SECONDS, days * POLL_SECONDS_PER_DAY), POLL_MAX_TIMEOUT_CAP)

    async def _request_and_poll_exports(
        self, base_url: str, api_key: str, date_from: str, date_to: str,
        on_progress: ProgressCallback | None = None,
        cancel_flag: asyncio.Event | None = None,
        pause_seconds: int = EXPORT_PAUSE,
    ) -> tuple[list, list, list]:
        """Request and poll 3 exports sequentially with pauses between them."""
        timeout = self._scaled_timeout(date_from, date_to)
        logger.info(
            "Export timeout for range %s..%s: %ds, pause=%ds",
            date_from, date_to, timeout, pause_seconds,
        )

        export_types = ["users", "payments", "deals"]
        results: list[list] = []

        for idx, export_type in enumerate(export_types):
            step = f"{idx + 1}/{len(export_types)}"

            async def _stage_progress(event: str, detail: dict[str, Any]) -> None:
                if on_progress:
                    await on_progress(event, {
                        **detail,
                        "export_type": export_type,
                        "step": step,
                    })

            if on_progress:
                await on_progress("export_started", {
                    "export_type": export_type,
                    "step": step,
                })

            rows = await self._request_and_poll_export(
                base_url, api_key, export_type, date_from, date_to,
                timeout=timeout, initial_wait=pause_seconds,
                on_progress=_stage_progress,
                cancel_flag=cancel_flag,
            )

            if on_progress:
                await on_progress("export_done", {
                    "export_type": export_type,
                    "step": step,
                    "rows_count": len(rows),
                })

            results.append(rows)

            if idx < len(export_types) - 1:
                logger.info("Pausing %ds before next export request...", pause_seconds)
                await self._sleep_with_heartbeat(
                    pause_seconds, on_progress, cancel_flag,
                    {"detail": "export_pause", "export_type": export_type, "step": step},
                )

        return results[0], results[1], results[2]

    async def collect_metrics(
        self,
        session_maker: async_sessionmaker,
        target_date: date,
        collected_by_id=None,
        pause_seconds: int = EXPORT_PAUSE,
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
            base_url, api_key, date_str, date_str,
            pause_seconds=pause_seconds,
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
        on_progress: ProgressCallback | None = None,
        cancel_flag: asyncio.Event | None = None,
        pause_seconds: int = EXPORT_PAUSE,
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
            base_url, api_key, range_from.isoformat(), range_to.isoformat(),
            on_progress=on_progress, cancel_flag=cancel_flag,
            pause_seconds=pause_seconds,
        )

        # Phase 3: Aggregate (pure computation)
        date_range = (range_from, range_to)
        users_by_date = self._group_rows_by_date(user_rows, date_range)
        payments_by_date = self._group_rows_by_date(payment_rows, date_range)
        deals_by_date = self._group_rows_by_date(deal_rows, date_range)

        logger.info(
            "Range collection: got %d user rows, %d payment rows, %d deal rows",
            len(user_rows), len(payment_rows), len(deal_rows),
        )

        if on_progress:
            await on_progress("saving", {
                "users_count": len(user_rows),
                "payments_count": len(payment_rows),
                "deals_count": len(deal_rows),
            })

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
