"""Service for downloading Telegram channel content via Pyrofork.

Handles: per-channel locking, rate limiting, deduplication, progress callbacks.

Channels vs comments:
- Channel POSTS are fetched via `get_chat_history(channel_username)`.
- Channel COMMENTS live in a linked discussion group and are fetched via
  `get_discussion_replies(channel_username, post_message_id)` for each post.

IMPORTANT: DB sessions are opened/closed for each DB operation to avoid
holding connections idle during long Telegram API calls (Supabase PgBouncer
drops idle connections after ~60s).
"""

import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Coroutine

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import async_session
from app.db.models import ContentType
from app.db.repositories import TelegramChannelRepository, TelegramContentRepository
from app.services.telegram_connection_service import TelegramConnectionService

logger = logging.getLogger(__name__)

# Rate limiting
BATCH_SIZE = 100
BATCH_DELAY_SEC = 1.0
COMMENTS_DELAY_SEC = 1.5  # delay between fetching comments for each post

# Max retries after FloodWait
MAX_FLOOD_RETRIES = 2

# Offset for comment IDs to avoid collision with channel post IDs.
# Channel posts and discussion group replies have independent ID spaces,
# so a post ID=5 and a reply ID=5 would collide in our unique constraint
# (channel_id, telegram_message_id). We store replies as original_id + offset.
COMMENT_ID_OFFSET = 2_000_000_000

ProgressCallback = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]

# Per-channel download locks (prevent parallel downloads of the same channel)
_channel_locks: dict[uuid.UUID, asyncio.Lock] = {}


def _get_channel_lock(channel_id: uuid.UUID) -> asyncio.Lock:
    if channel_id not in _channel_locks:
        _channel_locks[channel_id] = asyncio.Lock()
    return _channel_locks[channel_id]


class TelegramDownloadService:
    """Downloads Telegram content (posts/comments) and stores in DB."""

    def __init__(self, telegram_service: TelegramConnectionService):
        self._telegram = telegram_service
        self._channel_repo = TelegramChannelRepository()
        self._content_repo = TelegramContentRepository()

    async def prepare_analysis(
        self,
        session: AsyncSession,
        channel_ids: list[uuid.UUID],
        date_from: date,
        date_to: date,
        content_type: str = "all",
    ) -> dict:
        """Calculate existing vs missing content for given channels and date range.

        Returns preparation summary with per-channel breakdown.
        """
        dt_from = datetime.combine(date_from, datetime.min.time())
        dt_to = datetime.combine(date_to, datetime.max.time())

        channels_summary = []
        total_existing = 0

        logger.info(
            "Preparing analysis: %d channels, range=%s..%s, type=%s",
            len(channel_ids), date_from, date_to, content_type,
        )

        for ch_id in channel_ids:
            channel = await self._channel_repo.get_by_id(session, ch_id)
            if not channel:
                logger.warning("Channel %s not found in DB, skipping", ch_id)
                continue

            ct_filter = None if content_type == "all" else content_type
            existing = await self._content_repo.count_by_channel_and_date_range(
                session, ch_id, dt_from, dt_to, ct_filter
            )
            total_existing += existing

            logger.info(
                "Channel '%s' (id=%s, @%s): %d existing messages in range",
                channel.display_name, ch_id, channel.username, existing,
            )

            channels_summary.append({
                "channel_id": ch_id,
                "channel_name": channel.display_name,
                "existing_count": existing,
                "estimated_missing": None,  # Can't estimate without Telegram API
            })

        # Check if Telegram is connected
        client = await self._telegram.get_client(session)
        telegram_connected = client is not None

        return {
            "channels": channels_summary,
            "total_existing": total_existing,
            "total_estimated_missing": None,
            "telegram_connected": telegram_connected,
        }

    async def download_missing(
        self,
        channel_ids: list[uuid.UUID],
        date_from: date,
        date_to: date,
        content_type: str = "all",
        progress_callback: ProgressCallback | None = None,
    ) -> dict:
        """Download missing content from Telegram channels.

        Acquires per-channel locks (raises if locked).
        Returns download results per channel.

        Uses short-lived DB sessions to avoid idle connection timeouts.
        """
        # Get Telegram client (short DB session)
        async with async_session() as session:
            client = await self._telegram.get_client(session)
        if not client:
            raise ValueError("Telegram not connected. Connect via Settings first.")

        dt_from = datetime.combine(date_from, datetime.min.time())
        dt_to = datetime.combine(date_to, datetime.max.time())

        # Load channel metadata (short DB session)
        channels = []
        async with async_session() as session:
            for ch_id in channel_ids:
                channel = await self._channel_repo.get_by_id(session, ch_id)
                if channel:
                    channels.append((ch_id, channel.username, channel.display_name, channel.id))

        results = {}
        total_downloaded = 0

        logger.info(
            "Starting download for %d channels, range=%s..%s, type=%s",
            len(channels), dt_from.date(), dt_to.date(), content_type,
        )

        for ch_id, username, display_name, db_id in channels:
            lock = _get_channel_lock(ch_id)
            if lock.locked():
                raise ChannelLockError(
                    f"Channel '{display_name}' is currently being downloaded"
                )

            async with lock:
                count = await self._download_channel(
                    client=client,
                    channel_db_id=db_id,
                    username=username,
                    display_name=display_name,
                    dt_from=dt_from,
                    dt_to=dt_to,
                    content_type=content_type,
                    progress_callback=progress_callback,
                )
                results[str(ch_id)] = count
                total_downloaded += count

        logger.info(
            "Download complete: %d total messages from %d channels",
            total_downloaded, len(channels),
        )
        return {"total_downloaded": total_downloaded, "per_channel": results}

    @staticmethod
    def _make_naive(dt: datetime | None) -> datetime | None:
        """Strip timezone info from datetime (convert to UTC if tz-aware)."""
        if dt is None:
            return None
        if dt.tzinfo is not None:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt

    async def _download_channel(
        self,
        client,
        channel_db_id: uuid.UUID,
        username: str,
        display_name: str,
        dt_from: datetime,
        dt_to: datetime,
        content_type: str,
        progress_callback: ProgressCallback | None,
    ) -> int:
        """Download posts and/or comments from a single channel.

        - Posts are fetched via get_chat_history(channel).
        - Comments are fetched via get_discussion_replies(channel, post_id)
          for each post in the date range.

        Uses short-lived DB sessions for each DB operation.
        """
        # Get existing message IDs to skip duplicates (short session)
        async with async_session() as session:
            existing_ids = await self._content_repo.get_existing_message_ids(
                session, channel_db_id, dt_from, dt_to
            )

        if progress_callback:
            await progress_callback({
                "phase": "downloading",
                "channel": display_name,
                "progress": 0,
                "detail": f"Starting download from @{username}",
            })

        clean_username = username.lstrip("@")
        downloaded_posts = 0
        downloaded_comments = 0

        # Phase 1: Download posts (needed for both "posts" and "comments" modes,
        # because we need post IDs to fetch their discussion replies)
        need_posts = content_type in ("all", "posts")
        need_comments = content_type in ("all", "comments")

        posts_in_range = await self._download_posts(
            client=client,
            channel_db_id=channel_db_id,
            username=clean_username,
            display_name=display_name,
            dt_from=dt_from,
            dt_to=dt_to,
            existing_ids=existing_ids,
            save_posts=need_posts,
            progress_callback=progress_callback,
        )
        if need_posts:
            downloaded_posts = posts_in_range["saved"]

        # Phase 2: Download comments for each post
        if need_comments and posts_in_range["post_ids"]:
            if progress_callback:
                await progress_callback({
                    "phase": "downloading",
                    "channel": display_name,
                    "progress": downloaded_posts,
                    "detail": f"Fetching comments for {len(posts_in_range['post_ids'])} posts...",
                })

            downloaded_comments = await self._download_comments(
                client=client,
                channel_db_id=channel_db_id,
                username=clean_username,
                display_name=display_name,
                post_ids=posts_in_range["post_ids"],
                existing_ids=existing_ids,
                progress_callback=progress_callback,
                base_count=downloaded_posts,
            )

        total = downloaded_posts + downloaded_comments

        if progress_callback:
            parts = []
            if need_posts:
                parts.append(f"{downloaded_posts} posts")
            if need_comments:
                parts.append(f"{downloaded_comments} comments")
            parts.append(f"{posts_in_range['scanned']} scanned")
            await progress_callback({
                "phase": "downloading",
                "channel": display_name,
                "progress": total,
                "detail": f"Completed: {', '.join(parts)}",
            })

        logger.info(
            "Downloaded %d from @%s (posts=%d, comments=%d, scanned=%d)",
            total, username, downloaded_posts, downloaded_comments,
            posts_in_range["scanned"],
        )
        return total

    async def _download_posts(
        self,
        client,
        channel_db_id: uuid.UUID,
        username: str,
        display_name: str,
        dt_from: datetime,
        dt_to: datetime,
        existing_ids: set[int],
        save_posts: bool,
        progress_callback: ProgressCallback | None,
    ) -> dict:
        """Download channel posts. Returns {saved, scanned, post_ids}.

        post_ids is a list of (message_id, has_text) tuples for posts in range —
        needed for fetching comments even when save_posts=False.
        """
        messages_batch: list[dict] = []
        saved = 0
        scanned = 0
        skipped_no_text = 0
        post_ids: list[int] = []

        offset_date = dt_to + timedelta(days=1)
        flood_retries = 0

        while True:
            try:
                async for message in client.get_chat_history(
                    username, offset_date=offset_date
                ):
                    scanned += 1
                    msg_date = self._make_naive(message.date)

                    if msg_date and msg_date < dt_from:
                        break
                    if msg_date and msg_date > dt_to:
                        continue

                    # Remember post ID for comment fetching
                    post_ids.append(message.id)

                    if not save_posts:
                        continue

                    if not message.text and not message.caption:
                        skipped_no_text += 1
                        continue

                    if message.id in existing_ids:
                        continue

                    text = message.text or message.caption or ""
                    messages_batch.append({
                        "channel_id": channel_db_id,
                        "telegram_message_id": message.id,
                        "content_type": ContentType.post,
                        "text": text,
                        "message_date": msg_date,
                    })

                    if len(messages_batch) >= BATCH_SIZE:
                        async with async_session() as session:
                            inserted = await self._content_repo.bulk_insert(session, messages_batch)
                            await session.commit()
                        saved += inserted
                        messages_batch.clear()

                        if progress_callback:
                            await progress_callback({
                                "phase": "downloading",
                                "channel": display_name,
                                "progress": saved,
                                "detail": f"Downloaded {saved} posts...",
                            })
                        await asyncio.sleep(BATCH_DELAY_SEC)

                # Flush remaining
                if messages_batch:
                    async with async_session() as session:
                        inserted = await self._content_repo.bulk_insert(session, messages_batch)
                        await session.commit()
                    saved += inserted
                    messages_batch.clear()
                break

            except Exception as e:
                error_name = type(e).__name__
                if "FloodWait" in error_name and flood_retries < MAX_FLOOD_RETRIES:
                    flood_retries += 1
                    wait_time = getattr(e, "value", 60)
                    logger.warning(
                        "FloodWait fetching posts from @%s (attempt %d/%d): %ds",
                        username, flood_retries, MAX_FLOOD_RETRIES, wait_time,
                    )
                    if progress_callback:
                        await progress_callback({
                            "phase": "downloading",
                            "channel": display_name,
                            "progress": saved,
                            "detail": f"Rate limited — waiting {wait_time}s",
                        })
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    logger.error("Error downloading posts from @%s: %s", username, e)
                    raise

        logger.info(
            "Posts from @%s: saved=%d, scanned=%d, no_text=%d, posts_in_range=%d",
            username, saved, scanned, skipped_no_text, len(post_ids),
        )
        return {"saved": saved, "scanned": scanned, "post_ids": post_ids}

    async def _download_comments(
        self,
        client,
        channel_db_id: uuid.UUID,
        username: str,
        display_name: str,
        post_ids: list[int],
        existing_ids: set[int],
        progress_callback: ProgressCallback | None,
        base_count: int = 0,
    ) -> int:
        """Download discussion replies (comments) for each post in the channel.

        Uses get_discussion_replies() to fetch comments from the linked group.
        Comment IDs are stored with COMMENT_ID_OFFSET to avoid collision with post IDs.
        """
        messages_batch: list[dict] = []
        total_saved = 0
        posts_with_comments = 0
        posts_without_discussion = 0

        for idx, post_id in enumerate(post_ids):
            try:
                comment_count = 0
                async for reply in client.get_discussion_replies(username, post_id):
                    # Skip non-text replies
                    if not reply.text and not reply.caption:
                        continue

                    msg_date = self._make_naive(reply.date)

                    # Use offset ID to avoid collision with channel post IDs
                    stored_id = reply.id + COMMENT_ID_OFFSET
                    if stored_id in existing_ids:
                        continue

                    text = reply.text or reply.caption or ""
                    messages_batch.append({
                        "channel_id": channel_db_id,
                        "telegram_message_id": stored_id,
                        "content_type": ContentType.comment,
                        "text": text,
                        "message_date": msg_date,
                    })
                    comment_count += 1

                if comment_count > 0:
                    posts_with_comments += 1

                # Flush batch
                if len(messages_batch) >= BATCH_SIZE:
                    async with async_session() as session:
                        inserted = await self._content_repo.bulk_insert(session, messages_batch)
                        await session.commit()
                    total_saved += inserted
                    messages_batch.clear()

                    if progress_callback:
                        await progress_callback({
                            "phase": "downloading",
                            "channel": display_name,
                            "progress": base_count + total_saved,
                            "detail": f"Comments: {total_saved} from {idx + 1}/{len(post_ids)} posts",
                        })

                # Rate limiting between posts
                if (idx + 1) % 5 == 0:
                    await asyncio.sleep(COMMENTS_DELAY_SEC)

            except Exception as e:
                error_name = type(e).__name__
                if "FloodWait" in error_name:
                    wait_time = getattr(e, "value", 60)
                    logger.warning(
                        "FloodWait fetching comments for post %d in @%s: %ds",
                        post_id, username, wait_time,
                    )
                    if progress_callback:
                        await progress_callback({
                            "phase": "downloading",
                            "channel": display_name,
                            "progress": base_count + total_saved,
                            "detail": f"Rate limited — waiting {wait_time}s",
                        })
                    await asyncio.sleep(wait_time)
                    # Continue to next post instead of retrying
                elif "MsgIdInvalid" in error_name or "DISCUSSION" in str(e).upper():
                    # Post has no discussion thread / comments disabled
                    posts_without_discussion += 1
                    continue
                else:
                    # Log and continue — don't fail entire download for one post
                    logger.warning(
                        "Error fetching comments for post %d in @%s: %s (%s)",
                        post_id, username, e, error_name,
                    )
                    continue

        # Flush remaining
        if messages_batch:
            async with async_session() as session:
                inserted = await self._content_repo.bulk_insert(session, messages_batch)
                await session.commit()
            total_saved += inserted

        logger.info(
            "Comments from @%s: saved=%d, posts_checked=%d, "
            "posts_with_comments=%d, posts_without_discussion=%d",
            username, total_saved, len(post_ids),
            posts_with_comments, posts_without_discussion,
        )
        return total_saved


class ChannelLockError(Exception):
    """Raised when a channel is already being downloaded."""
