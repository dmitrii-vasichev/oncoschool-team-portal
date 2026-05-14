"""Seed data for Content Factory reference tables.

Run via:
    python3 -m app.services.content_factory.seed
or call seed_reference_data(session) from a script / migration.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    CFFormat, CFFunnelTemplate, CFNosology, CFPlatform, CFRubric,
)


REFERENCE_SEED = {
    "platforms": [
        {"code": "telegram", "display_name": "Telegram", "display_order": 1,
         "capabilities": {
             "can_api_publish": True, "can_api_metrics": True,
             "supports_reactions": True, "supports_comments": True,
             "supports_link_preview": True, "supports_scheduling": True,
             "supports_post_url": True, "supports_post_editing": True,
             "metric_freshness_typical_hours": 24, "default_publish_mode": "manual",
         }},
        {"code": "vk", "display_name": "ВКонтакте", "display_order": 2,
         "capabilities": {
             "can_api_publish": True, "can_api_metrics": True,
             "supports_reactions": True, "supports_comments": True,
             "supports_link_preview": True, "supports_scheduling": True,
             "supports_post_url": True, "supports_post_editing": True,
             "metric_freshness_typical_hours": 24, "default_publish_mode": "manual",
         }},
        {"code": "max", "display_name": "Max", "display_order": 3,
         "capabilities": {
             "can_api_publish": False, "can_api_metrics": False,
             "supports_reactions": True, "supports_comments": True,
             "supports_link_preview": True, "supports_scheduling": False,
             "supports_post_url": True, "metric_freshness_typical_hours": 168,
             "default_publish_mode": "manual",
         }},
        {"code": "dzen", "display_name": "Дзен", "display_order": 4,
         "capabilities": {
             "can_api_publish": False, "can_api_metrics": False,
             "supports_reactions": True, "supports_comments": True,
             "supports_link_preview": True, "supports_post_url": True,
             "metric_freshness_typical_hours": 72, "default_publish_mode": "manual",
         }},
        {"code": "ok", "display_name": "Одноклассники", "display_order": 5,
         "capabilities": {
             "can_api_publish": False, "can_api_metrics": False,
             "supports_post_url": True, "default_publish_mode": "manual",
         }},
        {"code": "instagram", "display_name": "Instagram", "display_order": 6,
         "capabilities": {
             "can_api_publish": False, "can_api_metrics": False,
             "supports_post_url": True, "default_publish_mode": "manual",
         }},
        {"code": "youtube", "display_name": "YouTube / Shorts", "display_order": 7,
         "capabilities": {
             "can_api_publish": False, "can_api_metrics": True,
             "supports_post_url": True, "default_publish_mode": "manual",
         }},
        {"code": "email", "display_name": "Email-дайджест", "display_order": 8,
         "capabilities": {
             "can_api_publish": True, "can_api_metrics": True,
             "supports_scheduling": True, "metric_freshness_typical_hours": 3,
             "default_publish_mode": "api",
         }},
        {"code": "whatsapp", "display_name": "WhatsApp воронка", "display_order": 9,
         "capabilities": {
             "can_api_publish": True, "can_api_metrics": False,
             "default_publish_mode": "api",
         }},
        {"code": "getcourse_push", "display_name": "GetCourse push", "display_order": 10,
         "capabilities": {
             "can_api_publish": True, "can_api_metrics": True,
             "metric_freshness_typical_hours": 1, "default_publish_mode": "api",
         }},
        {"code": "website", "display_name": "Сайт медтуризма", "display_order": 11,
         "capabilities": {
             "can_api_publish": False, "can_api_metrics": True,
             "metric_freshness_typical_hours": 24, "default_publish_mode": "manual",
         }},
    ],
    "formats": [
        {"code": "button", "display_name": "Кнопка (CTA)", "default_objective": "registration",
         "requires_medical_review": False, "display_order": 1},
        {"code": "announcement", "display_name": "Анонс", "default_objective": "reach",
         "requires_medical_review": True, "display_order": 2},
        {"code": "warming", "display_name": "Прогрев", "default_objective": "trust",
         "requires_medical_review": True, "display_order": 3},
        {"code": "follow_up", "display_name": "Дожимной пост", "default_objective": "purchase",
         "requires_medical_review": False, "display_order": 4},
        {"code": "live", "display_name": "Эфир / прямой эфир", "default_objective": "show_up",
         "requires_medical_review": True, "display_order": 5},
        {"code": "longread", "display_name": "Лонгрид", "default_objective": "trust",
         "requires_medical_review": True, "display_order": 6},
        {"code": "patient_story", "display_name": "История пациента", "default_objective": "trust",
         "requires_medical_review": True, "display_order": 7},
        {"code": "life", "display_name": "Лайф (личное эксперта)", "default_objective": "trust",
         "requires_medical_review": False, "display_order": 8},
        {"code": "expert", "display_name": "Экспертный пост", "default_objective": "trust",
         "requires_medical_review": True, "display_order": 9},
        {"code": "q_and_a", "display_name": "Q&A / Вопрос-Ответ", "default_objective": "trust",
         "requires_medical_review": True, "display_order": 10},
        {"code": "pin", "display_name": "Закреп", "default_objective": "navigation",
         "requires_medical_review": False, "display_order": 11},
        {"code": "methodology_pdf", "display_name": "Методичка / PDF",
         "default_objective": "trust", "requires_medical_review": True, "display_order": 12},
        {"code": "digest", "display_name": "Email-дайджест", "default_objective": "reach",
         "requires_medical_review": True, "display_order": 13},
        {"code": "push", "display_name": "Push-уведомление", "default_objective": "show_up",
         "requires_medical_review": False, "display_order": 14},
        {"code": "reel_shorts", "display_name": "Рилс / Shorts", "default_objective": "reach",
         "requires_medical_review": True, "display_order": 15},
        {"code": "carousel", "display_name": "Карусель", "default_objective": "trust",
         "requires_medical_review": True, "display_order": 16},
        {"code": "video_montage", "display_name": "Видеомонтаж разборов",
         "default_objective": "trust", "requires_medical_review": True, "display_order": 17},
        {"code": "citation", "display_name": "Цитата на фоне", "default_objective": "trust",
         "requires_medical_review": False, "display_order": 18},
        {"code": "guest_call", "display_name": "Объявление: поиск гостя",
         "default_objective": "trust", "requires_medical_review": False, "display_order": 19},
    ],
    "rubrics": [
        {"code": "expert", "display_name": "Экспертный"},
        {"code": "q_and_a", "display_name": "Вопрос-Ответ"},
        {"code": "button", "display_name": "Кнопка"},
        {"code": "life", "display_name": "Лайф"},
        {"code": "marathon", "display_name": "Марафон"},
        {"code": "navigation", "display_name": "Навигация по каналу"},
        {"code": "nutrition_health", "display_name": "Питание + Польза здоровью"},
        {"code": "psychology", "display_name": "Психология"},
        {"code": "live", "display_name": "Эфир"},
    ],
    "nosologies": [
        {"code": "rmj", "display_name": "РМЖ (рак молочной железы)"},
        {"code": "gkt", "display_name": "ЖКТ"},
        {"code": "urinary", "display_name": "Мочеполовая"},
        {"code": "palliative", "display_name": "Палиатив"},
        {"code": "neurology", "display_name": "Неврология"},
        {"code": "lymphology", "display_name": "Лимфология"},
        {"code": "psychoonkology", "display_name": "Психоонкология"},
    ],
    "funnel_templates": [
        {"code": "live_funnel", "name": "Воронка эфира",
         "description": "Стандартная воронка для эфира: анонс → кнопка → push → эфир → запись → дожим",
         "template_publications": [
             {"format_code": "announcement", "offset_days": -7,
              "default_platforms": ["telegram", "vk"]},
             {"format_code": "warming", "offset_days": -5,
              "default_platforms": ["telegram"]},
             {"format_code": "button", "offset_days": -3,
              "default_platforms": ["telegram", "vk", "email"]},
             {"format_code": "follow_up", "offset_days": -1,
              "default_platforms": ["telegram", "vk"]},
             {"format_code": "push", "offset_hours": -1,
              "default_platforms": ["telegram", "email"]},
             {"format_code": "live", "offset_hours": 0,
              "default_platforms": ["telegram"]},
             {"format_code": "follow_up", "offset_days": 1,
              "default_platforms": ["telegram", "vk", "email"]},
             {"format_code": "digest", "offset_days": 3,
              "default_platforms": ["email"]},
         ]},
        {"code": "webinar_funnel", "name": "Воронка вебинара",
         "description": "Двухдневный вебинар: подогрев → анонс → кнопка → день 1 → день 2 → дожим",
         "template_publications": [
             {"format_code": "announcement", "offset_days": -14,
              "default_platforms": ["telegram", "vk", "email"]},
             {"format_code": "warming", "offset_days": -10,
              "default_platforms": ["telegram", "vk"]},
             {"format_code": "button", "offset_days": -7,
              "default_platforms": ["telegram", "vk", "email"]},
             {"format_code": "push", "offset_hours": -3,
              "default_platforms": ["email", "telegram"]},
             {"format_code": "live", "offset_hours": 0,
              "default_platforms": ["telegram"]},
             {"format_code": "follow_up", "offset_days": 2,
              "default_platforms": ["telegram", "email"]},
         ]},
    ],
}


async def _upsert(session: AsyncSession, model_cls, items: list[dict]) -> int:
    """Idempotent: insert rows whose code is not already present."""
    existing_codes = set(
        (await session.execute(select(model_cls.code))).scalars().all()
    )
    inserted = 0
    for item in items:
        if item["code"] in existing_codes:
            continue
        session.add(model_cls(**item))
        inserted += 1
    await session.flush()
    return inserted


async def seed_reference_data(session: AsyncSession) -> dict[str, int]:
    """Seed all reference tables. Safe to run multiple times."""
    counts = {}
    counts["platforms"] = await _upsert(session, CFPlatform, REFERENCE_SEED["platforms"])
    counts["formats"] = await _upsert(session, CFFormat, REFERENCE_SEED["formats"])
    counts["rubrics"] = await _upsert(session, CFRubric, REFERENCE_SEED["rubrics"])
    counts["nosologies"] = await _upsert(session, CFNosology, REFERENCE_SEED["nosologies"])
    counts["funnel_templates"] = await _upsert(
        session, CFFunnelTemplate, REFERENCE_SEED["funnel_templates"]
    )
    return counts


if __name__ == "__main__":
    import asyncio
    from app.db.database import async_session

    async def _main():
        async with async_session() as session:
            async with session.begin():
                counts = await seed_reference_data(session)
            print("Seeded:", counts)

    asyncio.run(_main())
