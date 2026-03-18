"""Service for managing Pyrofork Telegram userbot connection.

Handles: encrypted credential storage, auth flow (code + 2FA),
session persistence via StringSession in DB, client lifecycle.
"""

import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories import TelegramSessionRepository
from app.utils.encryption import decrypt, encrypt, is_encryption_configured

logger = logging.getLogger(__name__)

_repo = TelegramSessionRepository()

# In-memory Pyrofork client singleton (lazy init)
_client = None
_client_connected = False


def _mask_phone(phone: str) -> str:
    """Mask phone number for display: +7•••••1234"""
    if not phone or len(phone) < 6:
        return phone or ""
    return phone[:2] + "•" * (len(phone) - 6) + phone[-4:]


def _mask_hash(api_hash: str) -> str:
    """Mask api_hash for display: ••••••ab3f"""
    if not api_hash or len(api_hash) < 4:
        return "••••••"
    return "••••••" + api_hash[-4:]


class TelegramConnectionService:
    """Manages Pyrofork client lifecycle and encrypted session storage."""

    def __init__(self):
        self._pending_client = None  # Client awaiting code verification
        self._pending_api_id = None
        self._pending_api_hash = None
        self._pending_phone = None
        self._pending_phone_code_hash = None

    async def get_status(self, session: AsyncSession) -> dict:
        """Get current connection status with masked credentials."""
        if not is_encryption_configured():
            return {"status": "not_configured"}

        ts = await _repo.get(session)
        if not ts:
            return {"status": "disconnected"}

        # Clear stale encryption-key errors now that the key is configured
        if ts.status == "error" and ts.error_message and (
            "TELEGRAM_ENCRYPTION_KEY" in ts.error_message
            or "Encryption key not configured" in ts.error_message
        ):
            await _repo.upsert(
                session,
                status="disconnected",
                error_message=None,
            )
            return {"status": "disconnected"}

        result = {
            "status": ts.status,
            "error_message": ts.error_message,
            "connected_at": ts.connected_at.isoformat() if ts.connected_at else None,
        }

        if ts.phone_number:
            result["phone"] = ts.phone_number  # Already stored masked
        if ts.api_hash_encrypted:
            try:
                api_hash = decrypt(ts.api_hash_encrypted)
                result["api_hash_masked"] = _mask_hash(api_hash)
            except Exception:
                result["api_hash_masked"] = "••••••"

        return result

    async def initiate_connection(
        self,
        session: AsyncSession,
        api_id: str,
        api_hash: str,
        phone: str,
    ) -> dict:
        """Start Telegram authorization: send code to phone.

        Returns: {"status": "code_required"} or {"status": "error", "error_message": "..."}
        """
        if not is_encryption_configured():
            return {
                "status": "error",
                "error_message": "Encryption key not configured on the server.",
            }

        try:
            from pyrogram import Client
        except ImportError:
            return {"status": "error", "error_message": "Pyrofork not installed"}

        global _client, _client_connected

        # Disconnect existing client if any
        if _client and _client_connected:
            try:
                await _client.stop()
            except Exception:
                pass
            _client = None
            _client_connected = False

        try:
            client = Client(
                name="oncoschool_userbot",
                api_id=int(api_id),
                api_hash=api_hash,
                in_memory=True,
            )

            # Establish TCP connection first
            await client.connect()

            # Send verification code to the phone
            sent_code = await client.send_code(phone)
            logger.info("Telegram verification code sent to %s", _mask_phone(phone))

            # Store pending state including phone_code_hash for sign_in
            self._pending_client = client
            self._pending_api_id = api_id
            self._pending_api_hash = api_hash
            self._pending_phone = phone
            self._pending_phone_code_hash = sent_code.phone_code_hash

            # Save pending status to DB
            await _repo.upsert(
                session,
                api_id_encrypted=encrypt(api_id),
                api_hash_encrypted=encrypt(api_hash),
                phone_number=_mask_phone(phone),
                status="code_required",
                error_message=None,
            )

            return {"status": "code_required"}

        except Exception as e:
            logger.error("Failed to initiate Telegram connection: %s", e)
            await _repo.upsert(
                session,
                status="error",
                error_message=str(e)[:500],
            )
            return {"status": "error", "error_message": str(e)[:500]}

    async def verify_code(
        self,
        session: AsyncSession,
        code: str,
        password: str | None = None,
    ) -> dict:
        """Complete Telegram authorization with code (and optional 2FA password).

        Returns: {"status": "connected"} or {"status": "password_required"}
        or {"status": "code_required", "error_message": "..."} (code resent)
        or {"status": "error", "error_message": "..."}
        """
        global _client, _client_connected

        if not self._pending_client:
            return {"status": "error", "error_message": "No pending connection. Initiate connection first."}

        client = self._pending_client
        phone = self._pending_phone

        try:
            try:
                logger.info(
                    "Attempting sign_in for %s (hash=%s…)",
                    _mask_phone(phone),
                    (self._pending_phone_code_hash or "")[:8],
                )
                signed_in = await client.sign_in(
                    phone_number=phone,
                    phone_code_hash=self._pending_phone_code_hash,
                    phone_code=code,
                )
            except Exception as e:
                error_name = type(e).__name__
                error_str = str(e)

                # Handle 2FA
                if "SessionPasswordNeeded" in error_name or "password" in error_str.lower():
                    if password:
                        signed_in = await client.check_password(password)
                    else:
                        return {"status": "password_required"}

                # Handle expired code — resend automatically
                elif "PHONE_CODE_EXPIRED" in error_str:
                    logger.warning("Code expired, resending for %s", _mask_phone(phone))
                    try:
                        sent_code = await client.send_code(phone)
                        self._pending_phone_code_hash = sent_code.phone_code_hash
                        logger.info("New code sent, hash=%s…", sent_code.phone_code_hash[:8])
                        return {
                            "status": "code_required",
                            "error_message": "Код истёк. Новый код отправлен — введите его.",
                        }
                    except Exception as resend_err:
                        logger.error("Failed to resend code: %s", resend_err)
                        raise e  # raise original error
                else:
                    raise

            # Successfully signed in
            _client = client
            _client_connected = True

            session_string = await client.export_session_string()
            await _repo.upsert(
                session,
                session_string_encrypted=encrypt(session_string),
                status="connected",
                error_message=None,
                connected_at=datetime.utcnow(),
            )

            self._pending_client = None
            self._pending_api_id = None
            self._pending_api_hash = None
            self._pending_phone = None
            self._pending_phone_code_hash = None

            return {"status": "connected"}

        except Exception as e:
            logger.error("Failed to verify Telegram code: %s", e)
            await _repo.upsert(
                session,
                status="error",
                error_message=str(e)[:500],
            )
            return {"status": "error", "error_message": str(e)[:500]}

    async def disconnect(self, session: AsyncSession) -> None:
        """Terminate Telegram session and clear DB."""
        global _client, _client_connected

        if _client:
            try:
                if _client_connected:
                    await _client.stop()
            except Exception:
                pass
            _client = None
            _client_connected = False

        self._pending_client = None
        self._pending_phone_code_hash = None

        await _repo.upsert(
            session,
            api_id_encrypted=None,
            api_hash_encrypted=None,
            phone_number=None,
            session_string_encrypted=None,
            status="disconnected",
            error_message=None,
            connected_at=None,
        )

    async def get_client(self, session: AsyncSession):
        """Get a connected Pyrofork client, restoring from DB session if needed.

        Returns Client or None if not connected.
        """
        global _client, _client_connected

        if _client and _client_connected:
            return _client

        # Try to restore from DB
        ts = await _repo.get(session)
        if not ts or not ts.session_string_encrypted or ts.status != "connected":
            return None

        try:
            from pyrogram import Client

            api_id = decrypt(ts.api_id_encrypted)
            api_hash = decrypt(ts.api_hash_encrypted)
            session_string = decrypt(ts.session_string_encrypted)

            client = Client(
                name="oncoschool_userbot",
                api_id=int(api_id),
                api_hash=api_hash,
                session_string=session_string,
                in_memory=True,
            )
            await client.start()
            _client = client
            _client_connected = True
            logger.info("Telegram userbot client restored from DB session")
            return client

        except Exception as e:
            logger.error("Failed to restore Telegram client from DB session: %s", e)
            await _repo.upsert(
                session,
                status="error",
                error_message=f"Failed to restore session: {str(e)[:400]}",
            )
            return None

    async def ensure_connected(self, session: AsyncSession) -> bool:
        """Try to connect if session exists. Returns True if connected."""
        client = await self.get_client(session)
        return client is not None
