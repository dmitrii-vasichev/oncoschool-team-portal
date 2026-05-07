import asyncio
import os
import shutil
import tempfile
from dataclasses import dataclass

from app.services.voice_service import OPENAI_TRANSCRIPTION_SAFE_CHUNK_BYTES


@dataclass
class PreparedAudioChunks:
    source_path: str
    chunk_dir: str
    chunk_paths: list[str]
    duration_seconds: int | None
    source_bytes: int
    total_bytes: int


class AudioPreparationService:
    """Prepare long meeting recordings as OpenAI-safe temporary audio chunks."""

    safe_chunk_bytes = OPENAI_TRANSCRIPTION_SAFE_CHUNK_BYTES
    default_chunk_seconds = 10 * 60

    async def prepare_chunks(self, source_path: str) -> PreparedAudioChunks:
        source_bytes = os.path.getsize(source_path)
        duration_seconds = await self._probe_duration_seconds(source_path)
        chunk_dir = tempfile.mkdtemp(prefix="meeting-audio-chunks-")

        attempts = [
            {"bitrate": "32k", "segment_seconds": self.default_chunk_seconds},
            {"bitrate": "24k", "segment_seconds": 8 * 60},
        ]

        try:
            for attempt in attempts:
                self._clear_chunk_dir(chunk_dir)
                await self._segment_audio(
                    source_path=source_path,
                    chunk_dir=chunk_dir,
                    bitrate=attempt["bitrate"],
                    segment_seconds=attempt["segment_seconds"],
                )
                chunk_paths = self._list_chunk_paths(chunk_dir)
                if not chunk_paths:
                    raise ValueError("Не удалось подготовить аудио: фрагменты не созданы")
                if self._chunks_within_limit(chunk_paths):
                    total_bytes = sum(os.path.getsize(path) for path in chunk_paths)
                    return PreparedAudioChunks(
                        source_path=source_path,
                        chunk_dir=chunk_dir,
                        chunk_paths=chunk_paths,
                        duration_seconds=duration_seconds,
                        source_bytes=source_bytes,
                        total_bytes=total_bytes,
                    )
            raise ValueError("Не удалось подготовить аудио: фрагмент больше 25 МБ")
        except Exception:
            shutil.rmtree(chunk_dir, ignore_errors=True)
            raise

    async def cleanup(
        self,
        prepared: PreparedAudioChunks | None,
        *,
        source_path: str | None = None,
    ) -> None:
        effective_source_path = source_path or (prepared.source_path if prepared else None)
        if effective_source_path:
            try:
                os.unlink(effective_source_path)
            except FileNotFoundError:
                pass
        if prepared:
            shutil.rmtree(prepared.chunk_dir, ignore_errors=True)

    async def _probe_duration_seconds(self, source_path: str) -> int | None:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            source_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _stderr = await proc.communicate()
        if getattr(proc, "returncode", 0):
            return None
        try:
            duration = float(stdout.decode("utf-8").strip())
        except (TypeError, ValueError):
            return None
        return int(duration)

    async def _segment_audio(
        self,
        *,
        source_path: str,
        chunk_dir: str,
        bitrate: str,
        segment_seconds: int,
    ) -> None:
        output_pattern = os.path.join(chunk_dir, "chunk_%03d.mp3")
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-y",
            "-i",
            source_path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-b:a",
            bitrate,
            "-f",
            "segment",
            "-segment_time",
            str(segment_seconds),
            "-reset_timestamps",
            "1",
            output_pattern,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _stdout, stderr = await proc.communicate()
        if getattr(proc, "returncode", 0):
            detail = stderr.decode("utf-8", errors="ignore").strip()
            raise ValueError(f"Не удалось подготовить аудио через ffmpeg: {detail}")

    def _list_chunk_paths(self, chunk_dir: str) -> list[str]:
        return [
            os.path.join(chunk_dir, filename)
            for filename in sorted(os.listdir(chunk_dir))
            if filename.endswith(".mp3")
        ]

    def _chunks_within_limit(self, chunk_paths: list[str]) -> bool:
        return all(os.path.getsize(path) <= self.safe_chunk_bytes for path in chunk_paths)

    def _clear_chunk_dir(self, chunk_dir: str) -> None:
        for filename in os.listdir(chunk_dir):
            path = os.path.join(chunk_dir, filename)
            if os.path.isfile(path) or os.path.islink(path):
                os.unlink(path)
