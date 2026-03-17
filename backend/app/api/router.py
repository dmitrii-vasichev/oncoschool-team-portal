from fastapi import APIRouter

from app.api.admin import router as admin_router
from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.broadcasts import router as broadcasts_router
from app.api.departments import router as departments_router
from app.api.meeting_schedules import router as meeting_schedules_router
from app.api.meetings import router as meetings_router
from app.api.notifications import router as notifications_router
from app.api.settings import router as settings_router
from app.api.tasks import router as tasks_router
from app.api.task_updates import router as task_updates_router
from app.api.team import router as team_router
from app.api.telegram_targets import router as telegram_targets_router

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(tasks_router)
api_router.include_router(task_updates_router)
api_router.include_router(meetings_router)
api_router.include_router(meeting_schedules_router)
api_router.include_router(notifications_router)
api_router.include_router(departments_router)
api_router.include_router(team_router)
api_router.include_router(settings_router)
api_router.include_router(analytics_router)
api_router.include_router(telegram_targets_router)
api_router.include_router(broadcasts_router)
api_router.include_router(admin_router)
