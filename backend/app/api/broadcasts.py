import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from aiogram.types import BufferedInputFile
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_moderator
from app.db.database import get_session
from app.db.models import TeamMember, TelegramBroadcast, TelegramBroadcastImagePreset
from app.db.repositories import (
    TelegramBroadcastImagePresetRepository,
    TelegramBroadcastRepository,
    TelegramTargetRepository,
)
from app.db.schemas import (
    TelegramBroadcastCreate,
    TelegramBroadcastImagePresetResponse,
    TelegramBroadcastResponse,
    TelegramBroadcastSendResponse,
    TelegramBroadcastSendTargetResult,
    TelegramBroadcastStatusType,
    TelegramBroadcastUpdate,
)
from app.services.broadcast_media import (
    delete_broadcast_image,
    get_broadcast_media_public_url,
    get_broadcast_photo,
    save_broadcast_image,
    validate_broadcast_image_payload,
)

router = APIRouter(prefix="/broadcasts", tags=["broadcasts"])

logger = logging.getLogger(__name__)

broadcast_repo = TelegramBroadcastRepository()
target_repo = TelegramTargetRepository()
preset_repo = TelegramBroadcastImagePresetRepository()

MAX_TELEGRAM_MESSAGE_LEN = 4096
MAX_TELEGRAM_CAPTION_LEN = 1024
MAX_TARGETS_PER_BROADCAST = 50
MAX_PRESET_ALIAS_LEN = 120


def _to_utc_naive(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _normalize_message_html(message_html: str) -> str:
    return (message_html or "").replace("\r\n", "\n").replace("\r", "\n")


def _validate_message_html(message_html: str) -> str:
    message = _normalize_message_html(message_html).strip()
    if not message:
        raise HTTPException(status_code=400, detail="Текст сообщения не может быть пустым")
    if len(message) > MAX_TELEGRAM_MESSAGE_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"Сообщение слишком длинное (максимум {MAX_TELEGRAM_MESSAGE_LEN} символов)",
        )
    return message


def _validate_scheduled_at(scheduled_at: datetime) -> datetime:
    scheduled_utc = _to_utc_naive(scheduled_at)
    if scheduled_utc < datetime.utcnow() - timedelta(minutes=1):
        raise HTTPException(
            status_code=400,
            detail="Время отправки не может быть в прошлом",
        )
    return scheduled_utc


def _parse_target_ids(raw_value: str) -> list[uuid.UUID]:
    try:
        payload = json.loads(raw_value)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Некорректный формат списка групп")

    if not isinstance(payload, list) or not payload:
        raise HTTPException(
            status_code=400,
            detail="Нужно выбрать хотя бы одну Telegram-группу",
        )

    parsed: list[uuid.UUID] = []
    seen: set[uuid.UUID] = set()
    for value in payload:
        try:
            target_id = uuid.UUID(str(value))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Некорректный идентификатор группы")
        if target_id in seen:
            continue
        seen.add(target_id)
        parsed.append(target_id)

    if len(parsed) > MAX_TARGETS_PER_BROADCAST:
        raise HTTPException(
            status_code=400,
            detail=f"Можно отправить максимум в {MAX_TARGETS_PER_BROADCAST} групп за раз",
        )

    return parsed


def _parse_form_datetime(raw_value: str | None) -> datetime | None:
    if not raw_value:
        return None

    value = raw_value.strip()
    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Некорректный формат даты отправки")

    return parsed


def _parse_preset_id(raw_value: str | None) -> uuid.UUID | None:
    if raw_value is None:
        return None

    value = raw_value.strip()
    if not value:
        return None

    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Некорректный идентификатор пресета картинки",
        )


def _validate_preset_alias(raw_alias: str) -> str:
    alias = (raw_alias or "").strip()
    if not alias:
        raise HTTPException(status_code=400, detail="Укажите алиас картинки")
    if len(alias) > MAX_PRESET_ALIAS_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"Алиас слишком длинный (максимум {MAX_PRESET_ALIAS_LEN} символов)",
        )
    return alias


async def _read_image_upload(
    image: UploadFile | None,
) -> tuple[bytes | None, str | None]:
    if image is None:
        return None, None

    payload = await image.read()
    try:
        content_type, _ = validate_broadcast_image_payload(image.content_type, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return payload, content_type


def _serialize_image_preset(
    request: Request,
    preset: TelegramBroadcastImagePreset,
) -> TelegramBroadcastImagePresetResponse:
    storage_service = getattr(request.app.state, "storage_service", None)
    preview_url = get_broadcast_media_public_url(
        media_path=preset.image_path,
        storage_service=storage_service,
        base_url=str(request.base_url),
    )
    return TelegramBroadcastImagePresetResponse(
        id=preset.id,
        alias=preset.alias,
        image_path=preset.image_path,
        preview_url=preview_url,
        is_active=preset.is_active,
        sort_order=preset.sort_order,
        created_by_id=preset.created_by_id,
        created_at=preset.created_at,
        updated_at=preset.updated_at,
    )


async def _get_ordered_targets(
    session: AsyncSession,
    target_ids: list[uuid.UUID],
):
    active_targets = await target_repo.get_all_active(session)
    targets_by_id = {target.id: target for target in active_targets}

    missing = [target_id for target_id in target_ids if target_id not in targets_by_id]
    if missing:
        raise HTTPException(status_code=404, detail="Одна или несколько Telegram-групп не найдены")

    return [targets_by_id[target_id] for target_id in target_ids]


async def _send_to_chat(
    *,
    bot,
    chat_id: int,
    thread_id: int | None,
    message_html: str,
    image_payload: bytes | None = None,
    image_filename: str = "broadcast-image",
    image_path: str | None = None,
    storage_service=None,
) -> tuple[bool, str | None]:
    normalized_message = _normalize_message_html(message_html)
    try:
        if image_payload is not None:
            if len(normalized_message) > MAX_TELEGRAM_CAPTION_LEN:
                return (
                    False,
                    "С картинкой Telegram ограничивает подпись 1024 символами",
                )
            kwargs = {
                "chat_id": int(chat_id),
                "photo": BufferedInputFile(image_payload, filename=image_filename),
                "caption": normalized_message,
                "parse_mode": "HTML",
            }
            if thread_id:
                kwargs["message_thread_id"] = int(thread_id)
            await bot.send_photo(**kwargs)
            return True, None

        if image_path:
            if len(normalized_message) > MAX_TELEGRAM_CAPTION_LEN:
                return (
                    False,
                    "С картинкой Telegram ограничивает подпись 1024 символами",
                )
            photo = get_broadcast_photo(media_path=image_path, storage_service=storage_service)
            kwargs = {
                "chat_id": int(chat_id),
                "photo": photo,
                "caption": normalized_message,
                "parse_mode": "HTML",
            }
            if thread_id:
                kwargs["message_thread_id"] = int(thread_id)
            await bot.send_photo(**kwargs)
            return True, None

        kwargs = {
            "chat_id": int(chat_id),
            "text": normalized_message,
            "parse_mode": "HTML",
        }
        if thread_id:
            kwargs["message_thread_id"] = int(thread_id)
        await bot.send_message(**kwargs)
        return True, None
    except FileNotFoundError:
        return False, "Картинка для рассылки не найдена"
    except Exception as e:
        return False, str(e)[:1000]


async def _delete_image_path_if_unused(
    request: Request,
    session: AsyncSession,
    *,
    image_path: str,
    exclude_broadcast_id: uuid.UUID | None = None,
    exclude_preset_id: uuid.UUID | None = None,
) -> None:
    still_scheduled = await broadcast_repo.count_scheduled_with_image_path(
        session,
        image_path=image_path,
        exclude_broadcast_id=exclude_broadcast_id,
    )
    if still_scheduled > 0:
        return

    still_referenced_by_presets = await preset_repo.count_with_image_path(
        session,
        image_path=image_path,
        exclude_preset_id=exclude_preset_id,
    )
    if still_referenced_by_presets > 0:
        return

    storage_service = getattr(request.app.state, "storage_service", None)
    try:
        await delete_broadcast_image(media_path=image_path, storage_service=storage_service)
    except Exception:
        logger.warning(
            "Failed to delete broadcast image path=%s", image_path, exc_info=True
        )


async def _cleanup_image_path(
    *,
    media_path: str,
    storage_service,
) -> None:
    try:
        await delete_broadcast_image(media_path=media_path, storage_service=storage_service)
    except Exception:
        logger.warning(
            "Failed to cleanup image path=%s", media_path, exc_info=True
        )


async def _clear_broadcast_image_if_unused(
    request: Request,
    session: AsyncSession,
    broadcast: TelegramBroadcast,
) -> None:
    image_path = (broadcast.image_path or "").strip()
    if not image_path:
        return

    broadcast.image_path = None
    await session.flush()

    await _delete_image_path_if_unused(
        request,
        session,
        image_path=image_path,
        exclude_broadcast_id=broadcast.id,
    )


async def _send_broadcast_now(
    request: Request,
    broadcast: TelegramBroadcast,
) -> tuple[bool, str | None]:
    bot = getattr(request.app.state, "bot", None)
    if not bot:
        return False, "Telegram-бот недоступен"

    storage_service = getattr(request.app.state, "storage_service", None)
    return await _send_to_chat(
        bot=bot,
        chat_id=broadcast.chat_id,
        thread_id=broadcast.thread_id,
        message_html=broadcast.message_html,
        image_path=broadcast.image_path,
        storage_service=storage_service,
    )


@router.get("", response_model=list[TelegramBroadcastResponse])
async def get_broadcasts(
    status_filter: TelegramBroadcastStatusType | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=200),
    _: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """List scheduled/sent/failed broadcasts (moderator+)."""
    return await broadcast_repo.get_all(session, status=status_filter, limit=limit)


@router.get("/image-presets", response_model=list[TelegramBroadcastImagePresetResponse])
async def get_image_presets(
    request: Request,
    include_inactive: bool = Query(default=True),
    _: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    presets = await preset_repo.get_all(session, include_inactive=include_inactive)
    return [_serialize_image_preset(request, preset) for preset in presets]


@router.post(
    "/image-presets",
    response_model=TelegramBroadcastImagePresetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_image_preset(
    request: Request,
    alias: str = Form(...),
    sort_order: int = Form(default=0),
    is_active: bool = Form(default=True),
    image: UploadFile = File(...),
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    normalized_alias = _validate_preset_alias(alias)

    duplicate = await preset_repo.get_by_alias_ci(session, alias=normalized_alias)
    if duplicate:
        raise HTTPException(status_code=409, detail="Алиас уже используется")

    image_payload, image_content_type = await _read_image_upload(image)
    if image_payload is None or image_content_type is None:
        raise HTTPException(status_code=400, detail="Выберите изображение")

    storage_service = getattr(request.app.state, "storage_service", None)
    saved_image_path: str | None = None

    try:
        saved_image_path = await save_broadcast_image(
            payload=image_payload,
            content_type=image_content_type,
            storage_service=storage_service,
        )
        preset = await preset_repo.create(
            session,
            alias=normalized_alias,
            image_path=saved_image_path,
            is_active=is_active,
            sort_order=sort_order,
            created_by_id=member.id,
        )
        await session.commit()
    except IntegrityError:
        await session.rollback()
        if saved_image_path:
            await _cleanup_image_path(
                media_path=saved_image_path,
                storage_service=storage_service,
            )
        raise HTTPException(status_code=409, detail="Алиас уже используется")
    except HTTPException:
        await session.rollback()
        if saved_image_path:
            await _cleanup_image_path(
                media_path=saved_image_path,
                storage_service=storage_service,
            )
        raise
    except Exception:
        await session.rollback()
        if saved_image_path:
            try:
                await delete_broadcast_image(
                    media_path=saved_image_path,
                    storage_service=storage_service,
                )
            except Exception:
                logger.warning(
                    "Failed to cleanup image path=%s after preset create failure",
                    saved_image_path,
                    exc_info=True,
                )
        logger.exception("Failed to create broadcast image preset")
        raise HTTPException(status_code=500, detail="Не удалось создать пресет картинки")

    return _serialize_image_preset(request, preset)


@router.patch(
    "/image-presets/{preset_id}",
    response_model=TelegramBroadcastImagePresetResponse,
)
async def update_image_preset(
    preset_id: uuid.UUID,
    request: Request,
    alias: str | None = Form(default=None),
    sort_order: int | None = Form(default=None),
    is_active: bool | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    _: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    preset = await preset_repo.get_by_id(session, preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Пресет картинки не найден")

    update_data: dict = {}
    if alias is not None:
        normalized_alias = _validate_preset_alias(alias)
        duplicate = await preset_repo.get_by_alias_ci(
            session,
            alias=normalized_alias,
            exclude_preset_id=preset_id,
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Алиас уже используется")
        update_data["alias"] = normalized_alias
    if sort_order is not None:
        update_data["sort_order"] = sort_order
    if is_active is not None:
        update_data["is_active"] = is_active

    storage_service = getattr(request.app.state, "storage_service", None)
    old_image_path: str | None = None
    new_image_path: str | None = None
    if image is not None:
        image_payload, image_content_type = await _read_image_upload(image)
        if image_payload is None or image_content_type is None:
            raise HTTPException(status_code=400, detail="Выберите изображение")
        try:
            new_image_path = await save_broadcast_image(
                payload=image_payload,
                content_type=image_content_type,
                storage_service=storage_service,
            )
        except Exception:
            logger.exception("Failed to save preset image")
            raise HTTPException(status_code=500, detail="Не удалось сохранить картинку")
        old_image_path = preset.image_path
        update_data["image_path"] = new_image_path

    if not update_data:
        return _serialize_image_preset(request, preset)

    try:
        updated = await preset_repo.update(session, preset_id, **update_data)
        if not updated:
            raise HTTPException(status_code=404, detail="Пресет картинки не найден")
        await session.commit()
    except IntegrityError:
        await session.rollback()
        if new_image_path is not None:
            await _cleanup_image_path(
                media_path=new_image_path,
                storage_service=storage_service,
            )
        raise HTTPException(status_code=409, detail="Алиас уже используется")
    except HTTPException:
        await session.rollback()
        if new_image_path is not None:
            await _cleanup_image_path(
                media_path=new_image_path,
                storage_service=storage_service,
            )
        raise
    except Exception:
        await session.rollback()
        if new_image_path is not None:
            try:
                await delete_broadcast_image(
                    media_path=new_image_path,
                    storage_service=storage_service,
                )
            except Exception:
                logger.warning(
                    "Failed to cleanup image path=%s after preset update failure",
                    new_image_path,
                    exc_info=True,
                )
        logger.exception("Failed to update broadcast image preset")
        raise HTTPException(status_code=500, detail="Не удалось обновить пресет картинки")

    if old_image_path and new_image_path and old_image_path != new_image_path:
        await _delete_image_path_if_unused(
            request,
            session,
            image_path=old_image_path,
            exclude_preset_id=preset_id,
        )

    return _serialize_image_preset(request, updated)


@router.delete("/image-presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image_preset(
    preset_id: uuid.UUID,
    request: Request,
    _: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    preset = await preset_repo.get_by_id(session, preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Пресет картинки не найден")

    image_path = preset.image_path
    deleted = await preset_repo.delete(session, preset_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Пресет картинки не найден")

    await session.commit()
    await _delete_image_path_if_unused(
        request,
        session,
        image_path=image_path,
        exclude_preset_id=preset_id,
    )


@router.post("", response_model=TelegramBroadcastResponse, status_code=status.HTTP_201_CREATED)
async def create_broadcast(
    data: TelegramBroadcastCreate,
    request: Request,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Create a scheduled broadcast or send immediately (single target)."""
    target = await target_repo.get_by_id(session, data.target_id)
    if not target or not target.is_active:
        raise HTTPException(status_code=404, detail="Telegram-группа не найдена")

    if data.send_now:
        scheduled_at = datetime.utcnow()
    else:
        if data.scheduled_at is None:
            raise HTTPException(status_code=400, detail="Укажите дату и время отправки")
        scheduled_at = _validate_scheduled_at(data.scheduled_at)

    broadcast = await broadcast_repo.create(
        session,
        target_id=target.id,
        chat_id=target.chat_id,
        thread_id=target.thread_id,
        target_label=target.label,
        message_html=_validate_message_html(data.message_html),
        image_path=None,
        scheduled_at=scheduled_at,
        status="scheduled",
        created_by_id=member.id,
    )

    if data.send_now:
        sent, error = await _send_broadcast_now(request, broadcast)
        if sent:
            broadcast.status = "sent"
            broadcast.sent_at = datetime.utcnow()
            broadcast.error_message = None
        else:
            broadcast.status = "failed"
            broadcast.error_message = error or "Неизвестная ошибка отправки"

    await session.commit()
    return broadcast


@router.post("/batch", response_model=list[TelegramBroadcastResponse], status_code=status.HTTP_201_CREATED)
async def create_broadcast_batch(
    request: Request,
    target_ids: str = Form(...),
    message_html: str = Form(...),
    scheduled_at: str | None = Form(default=None),
    send_now: bool = Form(default=False),
    image_preset_id: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Create/send broadcasts to multiple groups with optional image."""
    message = _validate_message_html(message_html)
    parsed_target_ids = _parse_target_ids(target_ids)
    ordered_targets = await _get_ordered_targets(session, parsed_target_ids)

    parsed_preset_id = _parse_preset_id(image_preset_id)
    image_payload, image_content_type = await _read_image_upload(image)
    if parsed_preset_id is not None and image_payload is not None:
        raise HTTPException(
            status_code=400,
            detail="Выберите либо загруженную картинку, либо пресет по умолчанию",
        )

    selected_preset: TelegramBroadcastImagePreset | None = None
    if parsed_preset_id is not None:
        selected_preset = await preset_repo.get_active_by_id(session, parsed_preset_id)
        if not selected_preset:
            raise HTTPException(status_code=404, detail="Пресет картинки не найден или выключен")

    selected_preset_image_path = selected_preset.image_path if selected_preset else None
    has_image_attachment = image_payload is not None or selected_preset_image_path is not None

    if has_image_attachment and len(message) > MAX_TELEGRAM_CAPTION_LEN:
        raise HTTPException(
            status_code=400,
            detail=(
                "С картинкой Telegram ограничивает подпись 1024 символами. "
                "Сократите текст или отправьте без картинки."
            ),
        )

    if send_now:
        scheduled_at_utc = datetime.utcnow()
    else:
        parsed_scheduled_at = _parse_form_datetime(scheduled_at)
        if parsed_scheduled_at is None:
            raise HTTPException(status_code=400, detail="Укажите дату и время отправки")
        scheduled_at_utc = _validate_scheduled_at(parsed_scheduled_at)

    storage_service = getattr(request.app.state, "storage_service", None)
    image_path: str | None = None

    if not send_now and image_payload is not None and image_content_type is not None:
        try:
            image_path = await save_broadcast_image(
                payload=image_payload,
                content_type=image_content_type,
                storage_service=storage_service,
            )
        except HTTPException:
            raise
        except Exception:
            logger.exception("Failed to save broadcast image")
            raise HTTPException(status_code=500, detail="Не удалось сохранить картинку")

    if image_path is None and selected_preset_image_path:
        image_path = selected_preset_image_path

    bot = getattr(request.app.state, "bot", None)
    if send_now and not bot:
        raise HTTPException(status_code=503, detail="Telegram-бот недоступен")

    broadcasts: list[TelegramBroadcast] = []
    for target in ordered_targets:
        broadcast = await broadcast_repo.create(
            session,
            target_id=target.id,
            chat_id=target.chat_id,
            thread_id=target.thread_id,
            target_label=target.label,
            message_html=message,
            image_path=image_path if (not send_now or selected_preset_image_path) else None,
            scheduled_at=scheduled_at_utc,
            status="scheduled",
            created_by_id=member.id,
        )
        broadcasts.append(broadcast)

    if send_now:
        for broadcast in broadcasts:
            sent, error = await _send_to_chat(
                bot=bot,
                chat_id=broadcast.chat_id,
                thread_id=broadcast.thread_id,
                message_html=broadcast.message_html,
                image_payload=image_payload,
                image_filename=image.filename if image and image.filename else "broadcast-image",
                image_path=selected_preset_image_path,
                storage_service=storage_service,
            )
            if sent:
                broadcast.status = "sent"
                broadcast.sent_at = datetime.utcnow()
                broadcast.error_message = None
            else:
                broadcast.status = "failed"
                broadcast.error_message = error or "Неизвестная ошибка отправки"

    await session.commit()
    return broadcasts


@router.post("/send", response_model=TelegramBroadcastSendResponse)
async def send_instant_broadcast(
    request: Request,
    target_ids: str = Form(...),
    message_html: str = Form(...),
    image_preset_id: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    _: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Send a one-time broadcast to multiple groups without persisting history."""
    message = _validate_message_html(message_html)
    target_id_list = _parse_target_ids(target_ids)
    ordered_targets = await _get_ordered_targets(session, target_id_list)

    parsed_preset_id = _parse_preset_id(image_preset_id)
    image_payload, _ = await _read_image_upload(image)
    if parsed_preset_id is not None and image_payload is not None:
        raise HTTPException(
            status_code=400,
            detail="Выберите либо загруженную картинку, либо пресет по умолчанию",
        )

    selected_preset: TelegramBroadcastImagePreset | None = None
    if parsed_preset_id is not None:
        selected_preset = await preset_repo.get_active_by_id(session, parsed_preset_id)
        if not selected_preset:
            raise HTTPException(status_code=404, detail="Пресет картинки не найден или выключен")

    selected_preset_image_path = selected_preset.image_path if selected_preset else None
    has_image_attachment = image_payload is not None or selected_preset_image_path is not None
    if has_image_attachment and len(message) > MAX_TELEGRAM_CAPTION_LEN:
        raise HTTPException(
            status_code=400,
            detail=(
                "С картинкой Telegram ограничивает подпись 1024 символами. "
                "Сократите текст или отправьте без картинки."
            ),
        )

    bot = getattr(request.app.state, "bot", None)
    if not bot:
        raise HTTPException(status_code=503, detail="Telegram-бот недоступен")

    storage_service = getattr(request.app.state, "storage_service", None)
    results: list[TelegramBroadcastSendTargetResult] = []
    for target in ordered_targets:
        sent, error = await _send_to_chat(
            bot=bot,
            chat_id=target.chat_id,
            thread_id=target.thread_id,
            message_html=message,
            image_payload=image_payload,
            image_filename=image.filename if image and image.filename else "broadcast-image",
            image_path=selected_preset_image_path,
            storage_service=storage_service,
        )

        results.append(
            TelegramBroadcastSendTargetResult(
                target_id=target.id,
                chat_id=target.chat_id,
                thread_id=target.thread_id,
                target_label=target.label,
                ok=sent,
                error_message=error,
            )
        )

    sent_count = sum(1 for result in results if result.ok)
    failed_count = len(results) - sent_count

    return TelegramBroadcastSendResponse(
        sent_count=sent_count,
        failed_count=failed_count,
        results=results,
    )


@router.patch("/{broadcast_id}", response_model=TelegramBroadcastResponse)
async def update_broadcast(
    broadcast_id: uuid.UUID,
    data: TelegramBroadcastUpdate,
    _: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Update a scheduled broadcast (moderator+)."""
    broadcast = await broadcast_repo.get_by_id(session, broadcast_id)
    if not broadcast:
        raise HTTPException(status_code=404, detail="Рассылка не найдена")

    if broadcast.status != "scheduled":
        raise HTTPException(
            status_code=409,
            detail="Можно редактировать только рассылки со статусом 'scheduled'",
        )

    update_data: dict = {}

    if data.target_id is not None:
        target = await target_repo.get_by_id(session, data.target_id)
        if not target or not target.is_active:
            raise HTTPException(status_code=404, detail="Telegram-группа не найдена")
        update_data.update(
            {
                "target_id": target.id,
                "chat_id": target.chat_id,
                "thread_id": target.thread_id,
                "target_label": target.label,
            }
        )

    if data.message_html is not None:
        update_data["message_html"] = _validate_message_html(data.message_html)

    if data.scheduled_at is not None:
        update_data["scheduled_at"] = _validate_scheduled_at(data.scheduled_at)

    if update_data:
        updated = await broadcast_repo.update(session, broadcast_id, **update_data)
        if not updated:
            raise HTTPException(status_code=404, detail="Рассылка не найдена")
        broadcast = updated
        await session.commit()

    return broadcast


@router.post("/{broadcast_id}/send-now", response_model=TelegramBroadcastResponse)
async def send_broadcast_now(
    broadcast_id: uuid.UUID,
    request: Request,
    _: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Send an existing scheduled broadcast immediately (moderator+)."""
    broadcast = await broadcast_repo.get_by_id(session, broadcast_id)
    if not broadcast:
        raise HTTPException(status_code=404, detail="Рассылка не найдена")

    if broadcast.status != "scheduled":
        raise HTTPException(
            status_code=409,
            detail="Можно отправить немедленно только рассылки со статусом 'scheduled'",
        )

    sent, error = await _send_broadcast_now(request, broadcast)
    if sent:
        broadcast.status = "sent"
        broadcast.sent_at = datetime.utcnow()
        broadcast.error_message = None
    else:
        broadcast.status = "failed"
        broadcast.error_message = error or "Неизвестная ошибка отправки"

    await _clear_broadcast_image_if_unused(request, session, broadcast)
    await session.commit()
    return broadcast


@router.delete("/{broadcast_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_broadcast(
    broadcast_id: uuid.UUID,
    request: Request,
    _: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Cancel a scheduled broadcast (moderator+)."""
    broadcast = await broadcast_repo.get_by_id(session, broadcast_id)
    if not broadcast:
        raise HTTPException(status_code=404, detail="Рассылка не найдена")

    if broadcast.status != "scheduled":
        raise HTTPException(
            status_code=409,
            detail="Можно отменить только рассылки со статусом 'scheduled'",
        )

    broadcast.status = "cancelled"
    await _clear_broadcast_image_if_unused(request, session, broadcast)
    await session.commit()
