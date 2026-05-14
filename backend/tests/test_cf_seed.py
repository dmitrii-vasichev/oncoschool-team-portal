import unittest

from app.services.content_factory.seed import REFERENCE_SEED


class TestSeed(unittest.IsolatedAsyncioTestCase):
    async def test_seed_contains_expected_platforms(self):
        platform_codes = {p["code"] for p in REFERENCE_SEED["platforms"]}
        expected = {"telegram", "vk", "max", "dzen", "ok", "instagram",
                    "youtube", "email", "whatsapp", "getcourse_push", "website"}
        self.assertTrue(expected.issubset(platform_codes))

    async def test_seed_contains_expected_formats(self):
        codes = {f["code"] for f in REFERENCE_SEED["formats"]}
        for expected in ["button", "announcement", "follow_up", "live", "carousel",
                         "patient_story", "life", "expert", "push", "digest"]:
            self.assertIn(expected, codes, f"missing format: {expected}")

    async def test_seed_contains_expected_rubrics(self):
        codes = {r["code"] for r in REFERENCE_SEED["rubrics"]}
        for expected in ["expert", "life", "button", "psychology",
                         "nutrition_health", "q_and_a", "marathon", "navigation", "live"]:
            self.assertIn(expected, codes)

    async def test_telegram_capabilities_realistic(self):
        tg = next(p for p in REFERENCE_SEED["platforms"] if p["code"] == "telegram")
        caps = tg["capabilities"]
        self.assertTrue(caps.get("can_api_publish"))
        self.assertEqual(caps.get("default_publish_mode"), "manual")  # Phase 1


if __name__ == "__main__":
    unittest.main()
