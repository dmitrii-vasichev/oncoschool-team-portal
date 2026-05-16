from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import (
    CFPlatform,
    CFPublication,
    CFPublicationVariant,
    CFPublishingQueueItem,
)
from app.services.content_factory.publisher_errors import ContentFactoryPublisherError


VK_CHANNEL = "vk"
VK_WALL_POST_URL = "https://api.vk.com/method/wall.post"
PUBLISHABLE_STATUSES = {"approved", "scheduled"}


@dataclass(frozen=True)
class VKPublisherConfig:
    access_token: str
    owner_id: int | None
    api_version: str
    from_group: bool = True

    @classmethod
    def from_settings(cls) -> "VKPublisherConfig":
        raw_owner_id = str(settings.VK_OWNER_ID).strip()
        return cls(
            access_token=settings.VK_API_ACCESS_TOKEN,
            owner_id=int(raw_owner_id) if raw_owner_id else None,
            api_version=settings.VK_API_VERSION,
            from_group=settings.VK_FROM_GROUP,
        )


def build_vk_message(
    publication: CFPublication,
    variant: CFPublicationVariant | None,
) -> str:
    source = variant or publication
    title = (getattr(source, "title", None) or "").strip()
    body = (getattr(source, "body_text", None) or "").strip()
    parts: list[str] = []
    if title:
        parts.append(title)
    if body:
        parts.append(body)
    return "\n\n".join(parts)


def build_vk_post_url(owner_id: int, post_id: int | str) -> str:
    return f"https://vk.com/wall{owner_id}_{post_id}"


class VKPublisherService:
    def __init__(self, config: VKPublisherConfig | None = None):
        self.config = config or VKPublisherConfig.from_settings()

    async def load_current_variant(
        self,
        session: AsyncSession,
        publication: CFPublication,
    ) -> CFPublicationVariant | None:
        result = await session.execute(
            select(CFPublicationVariant)
            .where(
                CFPublicationVariant.publication_id == publication.id,
                CFPublicationVariant.channel == VK_CHANNEL,
                CFPublicationVariant.source_version_number
                == publication.version_number,
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def publish_loaded(
        self,
        *,
        session: AsyncSession,
        publication: CFPublication,
        platform: CFPlatform,
        item: CFPublishingQueueItem,
    ) -> dict[str, Any]:
        self._validate_config()
        self._validate_publication(publication, platform)
        variant = await self.load_current_variant(session, publication)
        message = build_vk_message(publication, variant)
        if not message.strip():
            raise ContentFactoryPublisherError(
                "No text is available for VK publishing",
                platform=VK_CHANNEL,
            )

        payload = {
            "owner_id": self.config.owner_id,
            "from_group": 1 if self.config.from_group else 0,
            "message": message,
            "access_token": self.config.access_token,
            "v": self.config.api_version,
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    VK_WALL_POST_URL,
                    data=payload,
                    timeout=15,
                )
                response.raise_for_status()
                data = response.json()
        except ContentFactoryPublisherError:
            raise
        except Exception as exc:
            raise ContentFactoryPublisherError(
                f"VK API request failed: {str(exc)[:500]}",
                platform=VK_CHANNEL,
            ) from exc

        if isinstance(data, dict) and isinstance(data.get("error"), dict):
            error = data["error"]
            code = error.get("error_code")
            error_message = error.get("error_msg") or "unknown VK error"
            raise ContentFactoryPublisherError(
                f"VK API rejected the post: {code} {error_message}",
                platform=VK_CHANNEL,
            )

        response_data = data.get("response") if isinstance(data, dict) else None
        post_id = response_data.get("post_id") if isinstance(response_data, dict) else None
        if post_id is None:
            raise ContentFactoryPublisherError(
                "VK API returned an unexpected response",
                platform=VK_CHANNEL,
            )

        post_id_text = str(post_id)
        owner_id = int(self.config.owner_id)
        return {
            "platform": VK_CHANNEL,
            "owner_id": owner_id,
            "from_group": self.config.from_group,
            "post_id": post_id_text,
            "post_url": build_vk_post_url(owner_id, post_id_text),
            "response": {"post_id": post_id},
        }

    def _validate_config(self) -> None:
        if not self.config.access_token:
            raise ContentFactoryPublisherError(
                "VK API token is not configured",
                platform=VK_CHANNEL,
            )
        if self.config.owner_id is None:
            raise ContentFactoryPublisherError(
                "VK owner id is not configured",
                platform=VK_CHANNEL,
            )

    def _validate_publication(
        self,
        publication: CFPublication,
        platform: CFPlatform,
    ) -> None:
        if platform.code != VK_CHANNEL:
            raise ContentFactoryPublisherError(
                "VK publisher supports only VK publications",
                platform=VK_CHANNEL,
            )
        if publication.status not in PUBLISHABLE_STATUSES:
            raise ContentFactoryPublisherError(
                "Публикация больше не находится в статусе Одобрено или Запланировано",
                platform=VK_CHANNEL,
            )
        if publication.media_refs:
            raise ContentFactoryPublisherError(
                "VK auto publishing currently supports only text publications without media",
                platform=VK_CHANNEL,
            )
