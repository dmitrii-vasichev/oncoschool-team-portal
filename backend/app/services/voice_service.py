import io
import logging
import os

import openai

from app.config import settings

logger = logging.getLogger(__name__)

DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"
OPENAI_TRANSCRIPTION_MAX_BYTES = 25 * 1024 * 1024


class VoiceService:
    """Speech-to-Text via OpenAI Whisper API.

    Whisper is always used via OpenAI regardless of the chosen AI provider,
    as it's a separate STT service.
    """

    def __init__(self):
        self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def transcribe_file(
        self,
        file_path: str,
        *,
        model: str = DEFAULT_TRANSCRIPTION_MODEL,
        language: str = "ru",
    ) -> str:
        size = os.path.getsize(file_path)
        if size > OPENAI_TRANSCRIPTION_MAX_BYTES:
            raise ValueError("Аудиофайл больше 25 МБ. Для этой записи пока нужна ручная обработка или сжатие.")
        with open(file_path, "rb") as audio_file:
            transcript = await self.client.audio.transcriptions.create(
                model=model,
                file=audio_file,
                language=language,
                response_format="text",
            )
        return transcript if isinstance(transcript, str) else transcript.text

    async def transcribe(self, audio_bytes: bytes, filename: str = "voice.ogg") -> str:
        """Send audio to Whisper API, return transcribed text."""
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename
        transcript = await self.client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="ru",
        )
        return transcript.text
