"""Tests for AnalysisService — content formatting, chunking, token estimation."""

import unittest
from datetime import datetime
from types import SimpleNamespace

from app.services.analysis_service import AnalysisService, CHARS_PER_TOKEN


class TestFormatContent(unittest.TestCase):
    """Tests for _format_content static method."""

    def _make_item(self, channel_id, text, msg_date, content_type="post"):
        return SimpleNamespace(
            channel_id=channel_id,
            text=text,
            message_date=msg_date,
            content_type=SimpleNamespace(value=content_type),
        )

    def test_single_channel_posts(self):
        items = [
            self._make_item("ch1", "Hello world", datetime(2026, 3, 1, 10, 0)),
            self._make_item("ch1", "Second post", datetime(2026, 3, 1, 11, 0)),
        ]
        result = AnalysisService._format_content(items, {"ch1": "Test Channel"})

        self.assertIn("### Channel: Test Channel", result)
        self.assertIn("Hello world", result)
        self.assertIn("Second post", result)
        self.assertIn("📝", result)  # Post emoji

    def test_comment_uses_comment_emoji(self):
        items = [
            self._make_item("ch1", "A comment", datetime(2026, 3, 1, 10, 0), "comment"),
        ]
        result = AnalysisService._format_content(items, {"ch1": "Ch"})
        self.assertIn("💬", result)

    def test_multiple_channels(self):
        items = [
            self._make_item("ch1", "Post A", datetime(2026, 3, 1, 10, 0)),
            self._make_item("ch2", "Post B", datetime(2026, 3, 1, 11, 0)),
        ]
        result = AnalysisService._format_content(
            items, {"ch1": "Channel 1", "ch2": "Channel 2"}
        )
        self.assertIn("### Channel: Channel 1", result)
        self.assertIn("### Channel: Channel 2", result)

    def test_unknown_channel(self):
        items = [
            self._make_item("unknown", "Post", datetime(2026, 3, 1, 10, 0)),
        ]
        result = AnalysisService._format_content(items, {})
        self.assertIn("### Channel: Unknown", result)


class TestSplitContent(unittest.TestCase):
    """Tests for _split_content static method."""

    def test_short_text_no_split(self):
        text = "Short text"
        chunks = AnalysisService._split_content(text, max_chars=1000)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0], text)

    def test_long_text_splits(self):
        # Create text longer than max_chars
        lines = [f"[2026-03-01 10:{i:02d}] 📝 Message number {i}\n" for i in range(200)]
        text = "\n".join(lines)
        max_chars = len(text) // 3

        chunks = AnalysisService._split_content(text, max_chars=max_chars)
        self.assertGreater(len(chunks), 1)

        # All content should be covered
        all_text = " ".join(chunks)
        self.assertIn("Message number 0", all_text)
        self.assertIn("Message number 199", all_text)

    def test_empty_text(self):
        chunks = AnalysisService._split_content("", max_chars=1000)
        # Empty string stripped → no chunks
        self.assertLessEqual(len(chunks), 1)


class TestTokenEstimation(unittest.TestCase):
    """Tests for token estimation constants."""

    def test_chars_per_token_reasonable(self):
        # Russian text: ~4 chars per token
        self.assertEqual(CHARS_PER_TOKEN, 4)

    def test_estimated_tokens(self):
        text = "Тестовый текст на русском языке для проверки оценки токенов."
        estimated = len(text) // CHARS_PER_TOKEN
        self.assertGreater(estimated, 0)
        self.assertLess(estimated, len(text))


if __name__ == "__main__":
    unittest.main()
