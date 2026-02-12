from fastapi import APIRouter

from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.meetings import router as meetings_router
from app.api.settings import router as settings_router
from app.api.tasks import router as tasks_router
from app.api.task_updates import router as task_updates_router
from app.api.team import router as team_router

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(tasks_router)
api_router.include_router(task_updates_router)
api_router.include_router(meetings_router)
api_router.include_router(team_router)
api_router.include_router(settings_router)
api_router.include_router(analytics_router)
