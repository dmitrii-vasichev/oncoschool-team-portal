import logging
import secrets
import sys

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Telegram
    BOT_TOKEN: str
    ADMIN_TELEGRAM_IDS: list[int] = []
    BOT_UI_VERSION: int = 0  # 0 = auto-compute from bot UI schema

    # Database
    DATABASE_URL: str

    # AI providers (at least one required, OPENAI required for Whisper)
    ANTHROPIC_API_KEY: str | None = None
    OPENAI_API_KEY: str  # Required for Whisper STT
    GOOGLE_API_KEY: str | None = None

    # Zoom Server-to-Server OAuth
    ZOOM_ACCOUNT_ID: str | None = None
    ZOOM_CLIENT_ID: str | None = None
    ZOOM_CLIENT_SECRET: str | None = None

    # Telegram notification targets (default chat IDs, comma-separated)
    NOTIFICATION_CHAT_IDS: list[int] = []

    # Auth
    JWT_SECRET: str = ""  # If empty, derived from BOT_TOKEN
    TELEGRAM_BOT_USERNAME: str = ""

    # Supabase Storage (for avatar uploads)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # General
    DEBUG: bool = False
    TIMEZONE: str = "Europe/Moscow"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS from comma-separated string or JSON array."""
        import json
        raw = self.CORS_ORIGINS.strip()
        if raw.startswith("["):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                pass
        return [o.strip() for o in raw.split(",") if o.strip()]

    # Frontend URL (for bot inline buttons linking to web UI)
    NEXT_PUBLIC_FRONTEND_URL: str = "http://localhost:3000"

    @property
    def database_url_async(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def supabase_storage_configured(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_SERVICE_KEY)

    @property
    def zoom_configured(self) -> bool:
        return all([self.ZOOM_ACCOUNT_ID, self.ZOOM_CLIENT_ID, self.ZOOM_CLIENT_SECRET])

    @property
    def jwt_secret_key(self) -> str:
        if self.JWT_SECRET:
            return self.JWT_SECRET
        if not self.DEBUG:
            logger.critical(
                "JWT_SECRET is not set! This is required in production. "
                "Set JWT_SECRET environment variable to a strong random string (32+ chars)."
            )
            sys.exit(1)
        # In DEBUG mode, derive from BOT_TOKEN (development only)
        logger.warning("JWT_SECRET not set — using derived key (DEBUG mode only)")
        return f"dev-only-{self.BOT_TOKEN}"


settings = Settings()
