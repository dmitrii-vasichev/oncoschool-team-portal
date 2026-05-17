"""Content Factory composite router.

Mounted at /api/content-factory. Each resource lives in its own
module; this file wires them into a single APIRouter.
"""

from fastapi import APIRouter

from app.api.content_factory.bundles import router as bundles_router
from app.api.content_factory.formats import router as formats_router
from app.api.content_factory.funnel_templates import router as funnel_templates_router
from app.api.content_factory.glossary import router as glossary_router
from app.api.content_factory.guests import router as guests_router
from app.api.content_factory.metric_sources import router as metric_sources_router
from app.api.content_factory.metrics import router as metrics_router
from app.api.content_factory.nosologies import router as nosologies_router
from app.api.content_factory.platforms import router as platforms_router
from app.api.content_factory.publications import (
    bundle_pubs_router,
    pubs_router,
)
from app.api.content_factory.publishing_queue import router as publishing_queue_router
from app.api.content_factory.retros import router as retros_router
from app.api.content_factory.rubrics import router as rubrics_router
from app.api.content_factory.segments import router as segments_router

content_factory_router = APIRouter(prefix="/content-factory")
content_factory_router.include_router(glossary_router)
content_factory_router.include_router(platforms_router)
content_factory_router.include_router(formats_router)
content_factory_router.include_router(rubrics_router)
content_factory_router.include_router(nosologies_router)
content_factory_router.include_router(funnel_templates_router)
content_factory_router.include_router(bundles_router)
content_factory_router.include_router(bundle_pubs_router)
content_factory_router.include_router(pubs_router)
content_factory_router.include_router(publishing_queue_router)
content_factory_router.include_router(segments_router)
content_factory_router.include_router(metric_sources_router)
content_factory_router.include_router(metrics_router)
content_factory_router.include_router(retros_router)
content_factory_router.include_router(guests_router)
