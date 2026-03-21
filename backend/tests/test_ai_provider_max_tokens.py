"""Tests for AIProvider max_tokens parameter propagation (#143)."""

import unittest

from app.services.ai_service import (
    ANTHROPIC_DEFAULT_MAX_TOKENS,
    OPENAI_DEFAULT_MAX_TOKENS,
    AIProvider,
)


class TestAIProviderSignature(unittest.TestCase):
    """Verify that AIProvider.complete() accepts max_tokens parameter."""

    def test_complete_accepts_max_tokens(self):
        """AIProvider.complete() must accept max_tokens kwarg."""
        import inspect
        sig = inspect.signature(AIProvider.complete)
        self.assertIn("max_tokens", sig.parameters)

    def test_max_tokens_defaults_to_none(self):
        """max_tokens should default to None (use provider default)."""
        import inspect
        sig = inspect.signature(AIProvider.complete)
        param = sig.parameters["max_tokens"]
        self.assertIs(param.default, None)

    def test_openai_default_is_1400(self):
        """OpenAI default should remain 1400 for non-analysis tasks."""
        self.assertEqual(OPENAI_DEFAULT_MAX_TOKENS, 1400)

    def test_anthropic_default_is_4096(self):
        """Anthropic default should be 4096."""
        self.assertEqual(ANTHROPIC_DEFAULT_MAX_TOKENS, 4096)


if __name__ == "__main__":
    unittest.main()
