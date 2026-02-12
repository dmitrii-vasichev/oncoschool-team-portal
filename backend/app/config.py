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

    # Auth
    JWT_SECRET: str = ""  # If empty, derived from BOT_TOKEN

    # General
    TIMEZONE: str = "Europe/Moscow"

    @property
    def jwt_secret_key(self) -> str:
        return self.JWT_SECRET or f"oncoschool-{self.BOT_TOKEN[:16]}"


settings = Settings()
