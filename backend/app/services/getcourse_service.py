"""GetCourse API integration — async export flow for daily metrics collection."""

import asyncio
import logging
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

# Phase 2: fetch settings
FETCH_MAX_ATTEMPTS = 3  # quick retries if export not ready yet
FETCH_RETRY_DELAY = 30  # seconds between fetch retries
MAX_RETRIES = 3  # retries for export request (Phase 1)
RETRY_BASE_DELAY = 2
MAX_FETCH_HTTP_ERRORS = 3  # HTTP errors before giving up on fetch

# Rate limit handling (used in both Phase 1 and Phase 2)
RATE_LIMIT_BASE_DELAY = 30  # initial seconds to wait on rate limit
RATE_LIMIT_MAX_DELAY = 120  # max seconds to wait on rate limit (exponential backoff cap)
MAX_RATE_LIMIT_RETRIES = 30  # max rate-limit waits in Phase 1 (export request)
EXPORT_PAUSE = 300  # seconds between sequential export requests (5 min, matching n8n)

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

    async def _fetch_export(
        self,
        base_url: str,
        api_key: str,
        export_id: int,
        cancel_flag: asyncio.Event | None = None,
    ) -> list:
        """Fetch export results. Like n8n: single attempt, quick retry if not ready.

        After Phase 1 pauses, the export should be ready. If not — a few quick
        retries (30s apart), then fail. No long polling.
        """
        url = f"{base_url}/pl/api/account/exports/{export_id}"
        params = {"key": api_key}

        for attempt in range(1, FETCH_MAX_ATTEMPTS + 1):
            if cancel_flag and cancel_flag.is_set():
                raise asyncio.CancelledError("Cancelled by user")

            # HTTP request
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    response = await client.get(url, params=params)
                    response.raise_for_status()
                    data = response.json()
            except (httpx.TransportError, httpx.HTTPStatusError) as e:
                if attempt < FETCH_MAX_ATTEMPTS:
                    logger.warning(
                        "Export %d fetch attempt %d/%d: HTTP error (%s), retrying in %ds",
                        export_id, attempt, FETCH_MAX_ATTEMPTS, e, FETCH_RETRY_DELAY,
                    )
                    await asyncio.sleep(FETCH_RETRY_DELAY)
                    continue
                raise RuntimeError(
                    f"GetCourse export {export_id}: HTTP error after {attempt} attempts: {e}"
                ) from e

            # Check response
            if not data.get("success"):
                error_msg = str(data.get("error_message", ""))

                # "Файл еще не создан" — not ready yet
                if "еще не создан" in error_msg.lower():
                    if attempt < FETCH_MAX_ATTEMPTS:
                        logger.info(
                            "Export %d fetch attempt %d/%d: not ready, retrying in %ds",
                            export_id, attempt, FETCH_MAX_ATTEMPTS, FETCH_RETRY_DELAY,
                        )
                        await asyncio.sleep(FETCH_RETRY_DELAY)
                        continue
                    raise RuntimeError(
                        f"GetCourse export {export_id}: данные не готовы после {attempt} попыток. "
                        "Попробуйте увеличить паузу между экспортами."
                    )

                # Rate limited — retry with backoff
                if "слишком много" in error_msg.lower():
                    if attempt < FETCH_MAX_ATTEMPTS:
                        delay = min(RATE_LIMIT_BASE_DELAY * attempt, RATE_LIMIT_MAX_DELAY)
                        logger.warning(
                            "Export %d fetch attempt %d/%d: rate limited, waiting %ds",
                            export_id, attempt, FETCH_MAX_ATTEMPTS, delay,
                        )
                        await asyncio.sleep(delay)
                        continue
                    raise RuntimeError(
                        f"GetCourse export {export_id}: rate limited after {attempt} attempts"
                    )

                # Unknown error
                raise RuntimeError(
                    f"GetCourse export {export_id} fetch failed: {error_msg or data}"
                )

            # Success response
            info = data.get("info", {})
            status = info.get("status")

            logger.debug(
                "Export %d response keys: %s, status=%s",
                export_id, list(info.keys()), status,
            )

            # Primary check: if items are present, the export is ready.
            # GetCourse may omit the "status" field entirely when data is ready.
            if "items" in info:
                items = info["items"]
                logger.info(
                    "Export %d fetched on attempt %d: %d items (status=%s)",
                    export_id, attempt, len(items), status,
                )
                return items

            if status == "exported":
                # Fallback: status says exported but no items key
                logger.warning(
                    "Export %d: status='exported' but no 'items' key, returning empty",
                    export_id,
                )
                return []

            if status == "error":
                raise RuntimeError(f"GetCourse export {export_id} failed on server side")

            # Unknown status (processing, etc.) — retry
            if attempt < FETCH_MAX_ATTEMPTS:
                logger.info(
                    "Export %d fetch attempt %d/%d: status=%s, retrying in %ds",
                    export_id, attempt, FETCH_MAX_ATTEMPTS, status, FETCH_RETRY_DELAY,
                )
                await asyncio.sleep(FETCH_RETRY_DELAY)
                continue

            raise RuntimeError(
                f"GetCourse export {export_id}: status '{status}' after {attempt} attempts. "
                "Попробуйте увеличить паузу между экспортами."
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

    async def _request_and_poll_exports(
        self, base_url: str, api_key: str, date_from: str, date_to: str,
        on_progress: ProgressCallback | None = None,
        cancel_flag: asyncio.Event | None = None,
        pause_seconds: int = EXPORT_PAUSE,
    ) -> tuple[list, list, list]:
        """Request all 3 exports first, then fetch all results (matching n8n flow).

        Phase 1: Request users → pause → request payments → pause → request deals → pause
        Phase 2: Fetch users (had 3×pause) → fetch payments (had 2×pause) → fetch deals (had 1×pause)

        Every export gets at least one full pause to be processed by GetCourse.
        No long polling in Phase 2 — just fetch (with a few quick retries if not ready).
        """
        export_types = ["users", "payments", "deals"]

        logger.info(
            "n8n-style export: range %s..%s, pause=%ds",
            date_from, date_to, pause_seconds,
        )

        # ── Phase 1: Request all 3 exports with pauses between them ──
        export_ids: dict[str, int] = {}

        for idx, export_type in enumerate(export_types):
            step = f"{idx + 1}/{len(export_types)}"

            if on_progress:
                await on_progress("export_started", {
                    "export_type": export_type,
                    "step": step,
                })

            export_id = await self._request_export(
                base_url, api_key, export_type, date_from, date_to
            )
            export_ids[export_type] = export_id

            logger.info(
                "Export %d requested (%s) [%s]",
                export_id, export_type, step,
            )

            # Pause after every request (including the last one) so each
            # export has at least `pause_seconds` to be processed by GetCourse.
            logger.info("Waiting %ds before next step...", pause_seconds)
            await self._sleep_with_heartbeat(
                pause_seconds, on_progress, cancel_flag,
                {"detail": "waiting", "export_type": export_type, "step": step},
            )

        # ── Phase 2: Fetch all results (single attempt each, like n8n) ──
        # By now: each export had at least 1×pause to process
        results: dict[str, list] = {}
        errors: dict[str, str] = {}

        for idx, export_type in enumerate(export_types):
            step = f"{idx + 1}/{len(export_types)}"
            eid = export_ids[export_type]

            if on_progress:
                await on_progress("fetching", {
                    "export_type": export_type,
                    "step": step,
                })

            logger.info("Fetching export %d (%s)...", eid, export_type)

            try:
                rows = await self._fetch_export(
                    base_url, api_key, eid,
                    cancel_flag=cancel_flag,
                )
                results[export_type] = rows

                if on_progress:
                    await on_progress("export_done", {
                        "export_type": export_type,
                        "step": step,
                        "rows_count": len(rows),
                    })

                logger.info(
                    "Export %d (%s) fetched: %d rows", eid, export_type, len(rows),
                )
            except (TimeoutError, RuntimeError) as e:
                errors[export_type] = str(e)
                logger.error(
                    "Export %d (%s) FAILED: %s", eid, export_type, e,
                )
                if on_progress:
                    await on_progress("export_failed", {
                        "export_type": export_type,
                        "step": step,
                        "error": str(e),
                    })

        # ── Phase 3: Validate all exports succeeded ──
        if errors:
            failed = ", ".join(f"{t} ({e})" for t, e in errors.items())
            succeeded = [t for t in export_types if t in results]
            raise RuntimeError(
                f"Не все данные получены. Не удалось: {failed}. "
                f"Успешно: {', '.join(succeeded) if succeeded else 'нет'}. "
                "Данные не сохранены."
            )

        return results["users"], results["payments"], results["deals"]

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
