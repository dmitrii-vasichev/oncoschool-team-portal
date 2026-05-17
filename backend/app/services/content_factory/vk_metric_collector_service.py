from __future__ import annotations

import re
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import CFMetricSourceConfig, CFPlatform, CFPublication
from app.db.schemas import CFMetricSnapshotCreate
from app.services.content_factory.metric_service import MetricService
from app.services.content_factory.metric_source_service import MetricImportRunService

VK_WALL_GET_BY_ID_URL = "https://api.vk.com/method/wall.getById"
VK_WALL_GET_COMMENTS_URL = "https://api.vk.com/method/wall.getComments"
VK_METRIC_WINDOWS = ("3h", "24h", "72h", "7d", "final")
VK_WALL_REF_PATTERN = re.compile(r"(?:wall)?(-?\d+)_(\d+)")
VK_DEFAULT_WINDOWS = ("3h", "24h", "72h", "7d")
VK_METRIC_METHODS = {
    "views": "vk_api.wall.getById",
    "likes": "vk_api.wall.getById",
    "reposts": "vk_api.wall.getById",
    "comments": "vk_api.wall.getComments",
}


class VKMetricCollectorError(ValueError):
    """Raised when VK metric collection cannot proceed safely."""


@dataclass(frozen=True)
class VKPostIdentity:
    owner_id: int
    post_id: int

    @property
    def as_vk_ref(self) -> str:
        return f"{self.owner_id}_{self.post_id}"


@dataclass(frozen=True)
class VKPostMetrics:
    owner_id: int
    post_id: int
    counters: dict[str, int]
    raw_post: dict[str, Any]
    raw_comments: dict[str, Any]


def _coerce_int(value: Any, label: str) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        raise VKMetricCollectorError(f"Invalid VK {label}") from None


def parse_vk_post_identity(
    platform_post_id: str | None,
    platform_post_url: str | None,
    *,
    fallback_owner_id: int | None,
) -> VKPostIdentity:
    for candidate in (platform_post_id, platform_post_url):
        if not candidate:
            continue
        match = VK_WALL_REF_PATTERN.search(str(candidate))
        if match:
            return VKPostIdentity(
                owner_id=_coerce_int(match.group(1), "owner id"),
                post_id=_coerce_int(match.group(2), "post id"),
            )

    if platform_post_id and str(platform_post_id).strip().isdigit():
        if fallback_owner_id is None:
            raise VKMetricCollectorError("VK owner id is required for plain post ids")
        return VKPostIdentity(
            owner_id=fallback_owner_id,
            post_id=_coerce_int(platform_post_id, "post id"),
        )

    raise VKMetricCollectorError("VK post identity is missing or invalid")


def due_metric_windows(
    *,
    published_at: datetime,
    now: datetime,
    configured_windows: list[str] | tuple[str, ...],
    final_after_days: int,
) -> list[str]:
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    age = now - published_at
    thresholds = {
        "3h": timedelta(hours=3),
        "24h": timedelta(hours=24),
        "72h": timedelta(hours=72),
        "7d": timedelta(days=7),
        "final": timedelta(days=final_after_days),
    }
    return [
        window
        for window in configured_windows
        if window in thresholds and age >= thresholds[window]
    ]


class VKMetricsClient:
    def __init__(
        self,
        *,
        access_token: str,
        api_version: str,
        async_client_factory: Callable[[], Any] | None = None,
    ) -> None:
        self.access_token = access_token
        self.api_version = api_version
        self.async_client_factory = async_client_factory or httpx.AsyncClient

    async def fetch_post_metrics(self, *, owner_id: int, post_id: int) -> VKPostMetrics:
        post_data = await self._post(
            VK_WALL_GET_BY_ID_URL,
            {
                "posts": f"{owner_id}_{post_id}",
                "access_token": self.access_token,
                "v": self.api_version,
            },
        )
        post_items = post_data.get("response", {}).get("items", [])
        if not post_items:
            raise VKMetricCollectorError("VK post was not found")
        post = post_items[0]

        comments_data = await self._post(
            VK_WALL_GET_COMMENTS_URL,
            {
                "owner_id": owner_id,
                "post_id": post_id,
                "count": 0,
                "access_token": self.access_token,
                "v": self.api_version,
            },
        )

        counters: dict[str, int] = {}
        for metric_name, path in {
            "views": ("views", "count"),
            "likes": ("likes", "count"),
            "reposts": ("reposts", "count"),
        }.items():
            value = post.get(path[0], {}).get(path[1])
            if isinstance(value, int):
                counters[metric_name] = value

        comments_count = comments_data.get("response", {}).get("count")
        if isinstance(comments_count, int):
            counters["comments"] = comments_count

        return VKPostMetrics(
            owner_id=owner_id,
            post_id=post_id,
            counters=counters,
            raw_post=post,
            raw_comments=comments_data.get("response", {}),
        )

    async def _post(self, url: str, data: dict[str, Any]) -> dict[str, Any]:
        try:
            async with self.async_client_factory() as client:
                response = await client.post(url, data=data, timeout=15)
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            raise VKMetricCollectorError(
                f"VK metrics request failed: {str(exc)[:500]}"
            ) from exc

        if isinstance(payload, dict) and isinstance(payload.get("error"), dict):
            error = payload["error"]
            code = error.get("error_code")
            message = error.get("error_msg") or "unknown VK error"
            raise VKMetricCollectorError(
                f"VK API rejected metrics request: {code} {message}"
            )
        if not isinstance(payload, dict):
            raise VKMetricCollectorError("VK metrics request returned invalid JSON")
        return payload


def _settings_owner_id() -> int | None:
    raw_owner_id = str(settings.VK_OWNER_ID).strip()
    if not raw_owner_id:
        return None
    return _coerce_int(raw_owner_id, "owner id")


def _source_config_dict(source_config: CFMetricSourceConfig) -> dict[str, Any]:
    config = getattr(source_config, "config", None)
    return config if isinstance(config, dict) else {}


def _source_owner_id(
    source_config: CFMetricSourceConfig,
    default_owner_id: int | None,
) -> int | None:
    config = _source_config_dict(source_config)
    raw_owner_id = config.get("owner_id")
    if raw_owner_id not in (None, ""):
        return _coerce_int(raw_owner_id, "owner id")
    return default_owner_id


def _source_api_version(
    source_config: CFMetricSourceConfig,
    default_api_version: str,
) -> str:
    config = _source_config_dict(source_config)
    return str(config.get("api_version") or default_api_version).strip() or default_api_version


def _source_windows(source_config: CFMetricSourceConfig) -> list[str]:
    config = _source_config_dict(source_config)
    raw_windows = config.get("windows")
    if not isinstance(raw_windows, list):
        return list(VK_DEFAULT_WINDOWS)
    windows = [str(window) for window in raw_windows if str(window) in VK_METRIC_WINDOWS]
    return windows or list(VK_DEFAULT_WINDOWS)


def _source_final_after_days(source_config: CFMetricSourceConfig) -> int:
    config = _source_config_dict(source_config)
    try:
        return max(1, int(config.get("final_after_days", 30)))
    except (TypeError, ValueError):
        return 30


def _source_publication_limit(source_config: CFMetricSourceConfig) -> int:
    config = _source_config_dict(source_config)
    try:
        return min(500, max(1, int(config.get("publication_limit", 100))))
    except (TypeError, ValueError):
        return 100


def _publication_published_at(publication: CFPublication) -> datetime | None:
    return getattr(publication, "actual_published_at", None) or getattr(
        publication, "published_at", None
    )


def _compact_raw_payload(
    *,
    identity: VKPostIdentity,
    metric_name: str,
    metric_value: int,
    metrics: VKPostMetrics,
) -> dict[str, Any]:
    method = VK_METRIC_METHODS[metric_name]
    payload: dict[str, Any] = {
        "provider": "vk_api",
        "method": method,
        "owner_id": identity.owner_id,
        "post_id": identity.post_id,
        "metric_name": metric_name,
        "metric_value": metric_value,
    }
    if metric_name == "comments":
        payload["response"] = {"count": metrics.raw_comments.get("count")}
    else:
        payload["response"] = {
            "id": metrics.raw_post.get("id"),
            "owner_id": metrics.raw_post.get("owner_id"),
            metric_name: metrics.raw_post.get(metric_name),
        }
    return payload


class VKMetricCollectorService:
    """Imports VK post counters into Content Factory metric snapshots."""

    def __init__(
        self,
        *,
        client_factory: Callable[[str, str], Any] | None = None,
        import_run_service=MetricImportRunService,
        metric_service=MetricService,
        access_token: str | None = None,
        default_owner_id: int | None = None,
        default_api_version: str | None = None,
        now_provider: Callable[[], datetime] | None = None,
    ) -> None:
        self.client_factory = client_factory or (
            lambda access_token, api_version: VKMetricsClient(
                access_token=access_token,
                api_version=api_version,
            )
        )
        self.import_run_service = import_run_service
        self.metric_service = metric_service
        self.access_token = settings.VK_API_ACCESS_TOKEN if access_token is None else access_token
        self.default_owner_id = (
            default_owner_id if default_owner_id is not None else _settings_owner_id()
        )
        self.default_api_version = default_api_version or settings.VK_API_VERSION
        self.now_provider = now_provider or (lambda: datetime.now(timezone.utc))

    async def collect_for_source(
        self,
        session: AsyncSession,
        source_config: CFMetricSourceConfig,
        *,
        triggered_by: str = "manual",
        requested_by_id: uuid.UUID | None = None,
        publication_id: uuid.UUID | None = None,
    ):
        if getattr(source_config, "source", None) != "vk_api":
            raise VKMetricCollectorError("VK metric collector supports only vk_api sources")
        if not self.access_token:
            raise VKMetricCollectorError("VK API token is not configured")

        run = await self.import_run_service.start_run(
            session,
            source_config,
            triggered_by=triggered_by,
            requested_by_id=requested_by_id,
        )
        found_count = 0
        created_count = 0
        skipped_duplicate_count = 0
        error_count = 0
        errors: list[dict[str, Any]] = []
        processed_publications = 0

        owner_id = _source_owner_id(source_config, self.default_owner_id)
        api_version = _source_api_version(source_config, self.default_api_version)
        client = self.client_factory(self.access_token, api_version)
        publications = await self._load_publications(
            session,
            source_config,
            publication_id=publication_id,
        )
        now = self.now_provider()
        windows = _source_windows(source_config)
        final_after_days = _source_final_after_days(source_config)

        for publication in publications:
            try:
                publication_result = await self._collect_for_publication(
                    session,
                    source_config,
                    run_id=run.id,
                    publication=publication,
                    client=client,
                    owner_id=owner_id,
                    windows=windows,
                    final_after_days=final_after_days,
                    now=now,
                )
                found_count += publication_result["found_count"]
                created_count += publication_result["created_count"]
                skipped_duplicate_count += publication_result["skipped_duplicate_count"]
                if publication_result["found_count"]:
                    processed_publications += 1
            except VKMetricCollectorError as exc:
                error_count += 1
                errors.append(
                    {
                        "publication_id": str(getattr(publication, "id", "")),
                        "error": str(exc),
                    }
                )

        if error_count and not created_count and not skipped_duplicate_count:
            status = "failed"
        elif error_count:
            status = "partial"
        else:
            status = "succeeded"

        error_message = None
        if error_count:
            error_message = f"VK metric collection failed for {error_count} publication(s)"

        return await self.import_run_service.finish_run(
            session,
            run,
            status=status,
            found_count=found_count,
            created_count=created_count,
            skipped_duplicate_count=skipped_duplicate_count,
            error_count=error_count,
            error_message=error_message,
            raw_summary={
                "provider": "vk_api",
                "publication_count": len(publications),
                "processed_publication_count": processed_publications,
                "errors": errors,
            },
        )

    async def _load_publications(
        self,
        session: AsyncSession,
        source_config: CFMetricSourceConfig,
        *,
        publication_id: uuid.UUID | None,
    ) -> list[CFPublication]:
        stmt = (
            select(CFPublication)
            .join(CFPlatform, CFPublication.platform_id == CFPlatform.id)
            .where(
                CFPlatform.code == "vk",
                CFPublication.status == "published",
                CFPublication.actual_published_at.is_not(None),
                or_(
                    CFPublication.platform_post_id.is_not(None),
                    CFPublication.platform_post_url.is_not(None),
                ),
            )
            .order_by(CFPublication.actual_published_at.desc())
            .limit(_source_publication_limit(source_config))
        )
        if publication_id is not None:
            stmt = stmt.where(CFPublication.id == publication_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def _collect_for_publication(
        self,
        session: AsyncSession,
        source_config: CFMetricSourceConfig,
        *,
        run_id: uuid.UUID,
        publication: CFPublication,
        client: Any,
        owner_id: int | None,
        windows: list[str],
        final_after_days: int,
        now: datetime,
    ) -> dict[str, int]:
        published_at = _publication_published_at(publication)
        if published_at is None:
            raise VKMetricCollectorError("Publication does not have a publish timestamp")
        due_windows = due_metric_windows(
            published_at=published_at,
            now=now,
            configured_windows=windows,
            final_after_days=final_after_days,
        )
        if not due_windows:
            return {"found_count": 0, "created_count": 0, "skipped_duplicate_count": 0}

        identity = parse_vk_post_identity(
            getattr(publication, "platform_post_id", None),
            getattr(publication, "platform_post_url", None),
            fallback_owner_id=owner_id,
        )
        metrics = await client.fetch_post_metrics(
            owner_id=identity.owner_id,
            post_id=identity.post_id,
        )

        found_count = 0
        created_count = 0
        skipped_duplicate_count = 0
        for window in due_windows:
            for metric_name, metric_value in metrics.counters.items():
                found_count += 1
                result = await self.metric_service.record_deduped(
                    session,
                    CFMetricSnapshotCreate(
                        publication_id=publication.id,
                        window=window,
                        metric_name=metric_name,
                        metric_value=Decimal(metric_value),
                        source="vk_api",
                        source_method=VK_METRIC_METHODS[metric_name],
                        confidence=getattr(source_config, "default_confidence", "medium"),
                        raw_payload=_compact_raw_payload(
                            identity=identity,
                            metric_name=metric_name,
                            metric_value=metric_value,
                            metrics=metrics,
                        ),
                        source_config_id=source_config.id,
                        import_run_id=run_id,
                        external_metric_id=f"{identity.as_vk_ref}:{metric_name}",
                        dedupe_key=(
                            f"vk_api:{source_config.id}:{publication.id}:"
                            f"{identity.as_vk_ref}:{window}:{metric_name}"
                        ),
                    ),
                )
                if result.created:
                    created_count += 1
                else:
                    skipped_duplicate_count += 1
        return {
            "found_count": found_count,
            "created_count": created_count,
            "skipped_duplicate_count": skipped_duplicate_count,
        }
