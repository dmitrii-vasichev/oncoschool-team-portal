import unittest
from unittest.mock import AsyncMock

from app.api.broadcasts import _send_to_chat, _validate_message_html


class BroadcastMessageNormalizationTests(unittest.IsolatedAsyncioTestCase):
    def test_validate_message_html_normalizes_crlf(self) -> None:
        message = _validate_message_html("  Первая строка\r\nВторая строка\r  ")
        self.assertEqual(message, "Первая строка\nВторая строка")

    async def test_send_to_chat_uses_normalized_length_for_caption_limit(self) -> None:
        bot = AsyncMock()
        normalized_message = ("x" * 1010) + ("\n" * 10)  # 1020 chars
        message_with_crlf = normalized_message.replace("\n", "\r\n")  # 1030 chars

        sent, error = await _send_to_chat(
            bot=bot,
            chat_id=123,
            thread_id=None,
            message_html=message_with_crlf,
            image_payload=b"image-bytes",
            image_filename="demo.png",
        )

        self.assertTrue(sent)
        self.assertIsNone(error)
        bot.send_photo.assert_awaited_once()
        self.assertEqual(
            bot.send_photo.await_args.kwargs["caption"],
            normalized_message,
        )


if __name__ == "__main__":
    unittest.main()
