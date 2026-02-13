from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Telegram
    BOT_TOKEN: str
    ADMIN_TELEGRAM_IDS: list[int] = []
    ALLOWED_CHAT_IDS: list[int] = []

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

    # General
    DEBUG: bool = False
    TIMEZONE: str = "Europe/Moscow"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3002", "http://127.0.0.1:3002"]

    # Frontend URL (for bot inline buttons linking to web UI)
    NEXT_PUBLIC_FRONTEND_URL: str = "http://localhost:3000"

    # Telegram Mini App
    MINI_APP_URL: str = ""

    @property
    def database_url_async(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def zoom_configured(self) -> bool:
        return all([self.ZOOM_ACCOUNT_ID, self.ZOOM_CLIENT_ID, self.ZOOM_CLIENT_SECRET])

    @property
    def jwt_secret_key(self) -> str:
        return self.JWT_SECRET or f"oncoschool-{self.BOT_TOKEN[:16]}"


settings = Settings()
