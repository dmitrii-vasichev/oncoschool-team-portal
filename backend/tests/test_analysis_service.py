"""Tests for AnalysisService — content formatting, chunking, token estimation."""

import unittest
from datetime import datetime
from types import SimpleNamespace

from app.services.analysis_service import (
    ANALYSIS_MAX_OUTPUT_TOKENS,
    AnalysisService,
    CHARS_PER_TOKEN_BY_PROVIDER,
    DEFAULT_CONTEXT_WINDOWS,
    FALLBACK_CHARS_PER_TOKEN,
    FALLBACK_MAX_INPUT_TOKENS,
    MAX_INPUT_TOKENS_MINI_MODELS,
    MAX_INPUT_TOKENS_PER_REQUEST,
    MINI_MODEL_PATTERNS,
    OUTPUT_RESERVE_RATIO,
)


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
    """Tests for per-provider token estimation constants."""

    def test_openai_chars_per_token_lower_for_cyrillic(self):
        # OpenAI BPE is less efficient with Cyrillic
        self.assertLessEqual(CHARS_PER_TOKEN_BY_PROVIDER["openai"], 3.0)

    def test_all_providers_have_chars_per_token(self):
        for provider in DEFAULT_CONTEXT_WINDOWS:
            self.assertIn(provider, CHARS_PER_TOKEN_BY_PROVIDER)

    def test_fallback_is_conservative(self):
        # Fallback should use the lowest (most conservative) estimate
        min_cpt = min(CHARS_PER_TOKEN_BY_PROVIDER.values())
        self.assertLessEqual(FALLBACK_CHARS_PER_TOKEN, min_cpt)


class TestTPMLimitChunking(unittest.TestCase):
    """Regression tests for #134: chunks must respect TPM rate limits."""

    def test_openai_chunk_size_under_tpm_limit(self):
        """With 44K tokens of content, OpenAI must produce multiple chunks."""
        # Simulate ~44K tokens of Russian text at OpenAI's char-per-token rate
        chars_per_token = CHARS_PER_TOKEN_BY_PROVIDER["openai"]
        content_chars = int(44_000 * chars_per_token)  # ~110K chars
        text = "А" * content_chars  # Cyrillic filler

        # Calculate max_input_chars the same way run_analysis does
        context_window = DEFAULT_CONTEXT_WINDOWS["openai"]
        context_based = int(context_window * (1 - OUTPUT_RESERVE_RATIO))
        tpm_based = MAX_INPUT_TOKENS_PER_REQUEST["openai"]
        max_input_tokens = min(context_based, tpm_based)
        max_input_chars = int(max_input_tokens * chars_per_token)

        # TPM limit must be the binding constraint for OpenAI
        self.assertEqual(max_input_tokens, tpm_based)
        self.assertLess(tpm_based, context_based)

        chunks = AnalysisService._split_content(text, max_input_chars)

        # Must split into >1 chunk to stay under TPM limit
        self.assertGreater(len(chunks), 1)

        # Each chunk must be within the limit
        for chunk in chunks:
            self.assertLessEqual(len(chunk), max_input_chars)

    def test_openai_max_tokens_per_request_below_30k_tpm(self):
        """MAX_INPUT_TOKENS_PER_REQUEST for OpenAI must stay below 30K TPM."""
        self.assertLessEqual(MAX_INPUT_TOKENS_PER_REQUEST["openai"], 30_000)

    def test_anthropic_uses_context_window_not_tpm(self):
        """Anthropic has high TPM limits — context window should be binding."""
        context_based = int(DEFAULT_CONTEXT_WINDOWS["anthropic"] * (1 - OUTPUT_RESERVE_RATIO))
        tpm_based = MAX_INPUT_TOKENS_PER_REQUEST["anthropic"]
        effective = min(context_based, tpm_based)
        # For Anthropic, context window is the tighter constraint
        self.assertEqual(effective, context_based)

    def test_unknown_provider_uses_conservative_defaults(self):
        """Unknown providers should get conservative (safe) limits."""
        cpt = CHARS_PER_TOKEN_BY_PROVIDER.get("unknown_provider", FALLBACK_CHARS_PER_TOKEN)
        max_tokens = MAX_INPUT_TOKENS_PER_REQUEST.get("unknown_provider", FALLBACK_MAX_INPUT_TOKENS)

        # Conservative: low chars-per-token → more chunks; low max tokens → smaller chunks
        self.assertLessEqual(cpt, 3.0)
        self.assertLessEqual(max_tokens, 30_000)


class TestMiniModelDetection(unittest.TestCase):
    """Tests for mini model detection and higher TPM limits."""

    def test_mini_model_patterns_match(self):
        """gpt-4o-mini should be detected as a mini model."""
        model = "gpt-4o-mini"
        is_mini = any(p in model.lower() for p in MINI_MODEL_PATTERNS)
        self.assertTrue(is_mini)

    def test_gpt4o_is_not_mini(self):
        """gpt-4o should NOT be detected as a mini model."""
        model = "gpt-4o"
        is_mini = any(p in model.lower() for p in MINI_MODEL_PATTERNS)
        self.assertFalse(is_mini)

    def test_mini_openai_gets_higher_tpm(self):
        """Mini models should get higher input token limit."""
        self.assertGreater(
            MAX_INPUT_TOKENS_MINI_MODELS["openai"],
            MAX_INPUT_TOKENS_PER_REQUEST["openai"],
        )

    def test_mini_model_fewer_chunks(self):
        """With mini model limits, same content produces fewer chunks."""
        chars_per_token = CHARS_PER_TOKEN_BY_PROVIDER["openai"]

        # Standard model limits
        std_max_chars = int(MAX_INPUT_TOKENS_PER_REQUEST["openai"] * chars_per_token)
        # Mini model limits
        mini_max_chars = int(MAX_INPUT_TOKENS_MINI_MODELS["openai"] * chars_per_token)

        # ~1.5M chars of content (realistic for the project)
        content_chars = 1_500_000
        text = "А" * content_chars

        std_chunks = AnalysisService._split_content(text, std_max_chars)
        mini_chunks = AnalysisService._split_content(text, mini_max_chars)

        # Mini should produce significantly fewer chunks
        self.assertGreater(len(std_chunks), len(mini_chunks))
        self.assertLessEqual(len(mini_chunks), 15)  # ~10 expected for 60K tokens


class TestAnalysisOutputTokens(unittest.TestCase):
    """Regression tests for #143: analysis output must not be truncated."""

    def test_analysis_max_output_tokens_sufficient(self):
        """ANALYSIS_MAX_OUTPUT_TOKENS must be >= 4096 to avoid truncation."""
        self.assertGreaterEqual(ANALYSIS_MAX_OUTPUT_TOKENS, 4096)

    def test_analysis_max_output_higher_than_default(self):
        """Analysis output limit must exceed the default OpenAI limit."""
        from app.services.ai_service import OPENAI_DEFAULT_MAX_TOKENS
        self.assertGreater(ANALYSIS_MAX_OUTPUT_TOKENS, OPENAI_DEFAULT_MAX_TOKENS)


class TestFeatureKeyMatchesDB(unittest.TestCase):
    """Regression test for #145: FEATURE_KEY must match the DB seed."""

    def test_feature_key_matches_migration_seed(self):
        """FEATURE_KEY must be 'telegram_analysis' (as seeded in migration 026)."""
        from app.services.analysis_service import FEATURE_KEY

        self.assertEqual(
            FEATURE_KEY,
            "telegram_analysis",
            "FEATURE_KEY must match the ai_feature_config seed in migration 026. "
            "Mismatch causes analysis to ignore per-feature AI config and fall back to default.",
        )


if __name__ == "__main__":
    unittest.main()
