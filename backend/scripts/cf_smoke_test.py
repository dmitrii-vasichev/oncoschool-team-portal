"""End-to-end Content Factory smoke test.

Runs seed_reference_data (idempotent), creates 1 bundle + 1 publication,
records 1 metric, creates 1 retro. Asserts data is queryable and the version
audit trail kicks in. Cleans up at the end.

Usage:
    cd backend && python3 -m scripts.cf_smoke_test
"""
import asyncio

from sqlalchemy import select

from app.db.database import async_session
from app.db.models import (
    CFBundle, CFFormat, CFPlatform, CFPublicationVersion, CFRetroNote, TeamMember,
)
from app.db.schemas import (
    CFBundleCreate, CFMetricSnapshotCreate, CFPublicationCreate, CFRetroNoteCreate,
)
from app.services.content_factory.bundle_service import BundleService
from app.services.content_factory.metric_service import MetricService
from app.services.content_factory.publication_service import PublicationService
from app.services.content_factory.retro_service import RetroService
from app.services.content_factory.seed import seed_reference_data


async def main():
    from datetime import date

    async with async_session() as session:
        async with session.begin():
            counts = await seed_reference_data(session)
        print("Seed counts (re-run):", counts)

        result = await session.execute(select(TeamMember).limit(1))
        member = result.scalar_one_or_none()
        await session.commit()
        if member is None:
            print("FAIL: no team member in DB — cannot proceed.")
            return
        print(f"Using member: {member.full_name} ({member.role})")

        tg = (await session.execute(
            select(CFPlatform).where(CFPlatform.code == "telegram")
        )).scalar_one()
        fmt = (await session.execute(
            select(CFFormat).where(CFFormat.code == "announcement")
        )).scalar_one()
        # Close the implicit transaction opened by the read above so the next
        # explicit session.begin() block can start cleanly.
        await session.commit()

        async with session.begin():
            bundle = await BundleService.create(session, CFBundleCreate(
                name="SMOKE: Эфир тестовый",
                product_stream="onco_school",
                owner_id=member.id,
                brief="Smoke-test bundle.",
            ))
            pub = await PublicationService.create(session, CFPublicationCreate(
                bundle_id=bundle.id, platform_id=tg.id, format_id=fmt.id,
                responsible_id=member.id,
                title="SMOKE post",
                body_text="initial body",
            ), editor_id=member.id)
            metric = await MetricService.record(session, CFMetricSnapshotCreate(
                publication_id=pub.id, window="24h",
                metric_name="reach", metric_value=605,
                source="manual", confidence="high",
            ))
            retro = await RetroService.create(session, CFRetroNoteCreate(
                period_start=date(2026, 5, 6), period_end=date(2026, 5, 12),
                retro_type="weekly", facilitator_id=member.id,
                learnings={"topic": "smoke"},
                decisions={"continue": ["smoke testing"]},
                actions=[{"action": "cleanup", "owner_user_id": str(member.id)}],
            ))
            print(f"Bundle {bundle.id}, Pub {pub.id} v{pub.version_number}, "
                  f"Metric {metric.id}, Retro {retro.id}")

        async with session.begin():
            versions = (await session.execute(
                select(CFPublicationVersion).where(CFPublicationVersion.publication_id == pub.id)
            )).scalars().all()
            assert len(versions) == 1, f"expected 1 version, got {len(versions)}"
            assert versions[0].approval_event == "drafted"
            print(f"Version OK: {versions[0].approval_event}")

        async with session.begin():
            # Re-fetch bundle attached to this session before deleting (avoid DetachedInstance)
            b = (await session.execute(select(CFBundle).where(CFBundle.id == bundle.id))).scalar_one()
            r = (await session.execute(select(CFRetroNote).where(CFRetroNote.id == retro.id))).scalar_one()
            await session.delete(r)
            await session.delete(b)  # cascades to publication, version, metric
        print("Smoke test passed.")


if __name__ == "__main__":
    asyncio.run(main())
