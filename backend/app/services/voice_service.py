import io
import logging

import openai

from app.config import settings

logger = logging.getLogger(__name__)


class VoiceService:
    """Speech-to-Text via OpenAI Whisper API.

    Whisper is always used via OpenAI regardless of the chosen AI provider,
    as it's a separate STT service.
    """

    def __init__(self):
        self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

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
