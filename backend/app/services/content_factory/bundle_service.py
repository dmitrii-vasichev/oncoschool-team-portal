import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CFBundle
from app.db.schemas import CFBundleCreate, CFBundleUpdate


class BundleService:
    @staticmethod
    async def create(session: AsyncSession, payload: CFBundleCreate) -> CFBundle:
        bundle = CFBundle(
            name=payload.name,
            product_stream=payload.product_stream,
            status=payload.status,
            event_date=payload.event_date,
            owner_id=payload.owner_id,
            brief=payload.brief,
            funnel_template_id=payload.funnel_template_id,
            source_material_refs=payload.source_material_refs,
        )
        session.add(bundle)
        await session.flush()
        await session.refresh(bundle)
        return bundle

    @staticmethod
    async def get(session: AsyncSession, bundle_id: uuid.UUID) -> CFBundle | None:
        result = await session.execute(select(CFBundle).where(CFBundle.id == bundle_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list(
        session: AsyncSession,
        *,
        product_stream: str | None = None,
        status: str | None = None,
        owner_id: uuid.UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CFBundle]:
        stmt = select(CFBundle)
        if product_stream:
            stmt = stmt.where(CFBundle.product_stream == product_stream)
        if status:
            stmt = stmt.where(CFBundle.status == status)
        if owner_id:
            stmt = stmt.where(CFBundle.owner_id == owner_id)
        stmt = stmt.order_by(CFBundle.event_date.desc().nullslast(), CFBundle.created_at.desc())
        stmt = stmt.limit(limit).offset(offset)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def update(
        session: AsyncSession, bundle_id: uuid.UUID, payload: CFBundleUpdate
    ) -> CFBundle | None:
        bundle = await BundleService.get(session, bundle_id)
        if bundle is None:
            return None
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(bundle, field, value)
        await session.flush()
        return bundle

    @staticmethod
    async def delete(session: AsyncSession, bundle_id: uuid.UUID) -> bool:
        bundle = await BundleService.get(session, bundle_id)
        if bundle is None:
            return False
        await session.delete(bundle)
        await session.flush()
        return True
