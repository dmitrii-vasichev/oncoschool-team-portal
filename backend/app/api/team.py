import io
import uuid
from pathlib import Path

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Query
from PIL import Image
from pydantic import BaseModel
from sqlalchemy import delete as sa_delete, func, select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth import get_current_user, require_moderator
from app.db.database import get_session
from app.db.models import Department, Task, TeamMember, TeamMemberDepartmentAccess
from app.db.repositories import DepartmentRepository, TeamMemberRepository
from app.db.schemas import TeamMemberCreate, TeamMemberResponse, TeamMemberUpdate
from app.services.permission_service import PermissionService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/team", tags=["team"])
member_repo = TeamMemberRepository()
dept_repo = DepartmentRepository()

AVATAR_DIR = Path(__file__).resolve().parents[2] / "static" / "avatars"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2 MB


class MemberDeactivationPreviewTaskItem(BaseModel):
    short_id: int
    title: str


class MemberDeactivationPreviewResponse(BaseModel):
    open_tasks_count: int
    open_tasks_preview: list[MemberDeactivationPreviewTaskItem]


async def _normalize_extra_department_ids(
    session: AsyncSession,
    department_ids: list[uuid.UUID] | None,
    *,
    primary_department_id: uuid.UUID | None,
) -> list[uuid.UUID]:
    if not department_ids:
        return []

    unique_ids: list[uuid.UUID] = []
    for department_id in department_ids:
        if department_id == primary_department_id:
            continue
        if department_id not in unique_ids:
            unique_ids.append(department_id)

    if not unique_ids:
        return []

    stmt = select(Department.id).where(
        Department.id.in_(unique_ids),
        Department.is_active.is_(True),
    )
    existing_ids = set((await session.execute(stmt)).scalars().all())
    if len(existing_ids) != len(unique_ids):
        raise HTTPException(
            status_code=400,
            detail="Один или несколько дополнительных отделов недоступны",
        )

    return unique_ids


async def _sync_extra_department_access(
    session: AsyncSession,
    member_id: uuid.UUID,
    *,
    department_ids: list[uuid.UUID],
    granted_by_id: uuid.UUID,
) -> None:
    await session.execute(
        sa_delete(TeamMemberDepartmentAccess).where(
            TeamMemberDepartmentAccess.member_id == member_id
        )
    )

    for department_id in department_ids:
        session.add(
            TeamMemberDepartmentAccess(
                member_id=member_id,
                department_id=department_id,
                granted_by_id=granted_by_id,
            )
        )

    await session.flush()


def _is_member_visible(
    target: TeamMember,
    *,
    include_inactive: bool,
    include_test: bool,
) -> bool:
    if not include_inactive and not target.is_active:
        return False
    if not include_test and target.is_test:
        return False
    return True


@router.get("/tree")
async def get_team_tree(
    include_inactive: bool = Query(False),
    include_test: bool = Query(False),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get team organized by departments."""
    if include_test and not PermissionService.is_admin(member):
        raise HTTPException(
            status_code=403,
            detail="Только администратор может просматривать тестовых участников",
        )

    # Fetch departments with members eager-loaded
    stmt = (
        select(Department)
        .options(
            selectinload(Department.members).selectinload(
                TeamMember.extra_department_accesses
            )
        )
        .where(Department.is_active.is_(True))
        .order_by(Department.sort_order, Department.name)
    )
    result = await session.execute(stmt)
    departments = list(result.scalars().all())

    # Fetch members according to requested visibility mode
    all_members = (
        await member_repo.get_all(session)
        if include_inactive
        else await member_repo.get_all_active(session)
    )
    assigned_ids = set()
    for dept in departments:
        for m in dept.members:
            if _is_member_visible(
                m,
                include_inactive=include_inactive,
                include_test=include_test,
            ):
                assigned_ids.add(m.id)

    unassigned = [
        m
        for m in all_members
        if m.id not in assigned_ids
        and _is_member_visible(
            m,
            include_inactive=include_inactive,
            include_test=include_test,
        )
    ]

    def member_to_dict(m: TeamMember) -> dict:
        return {
            "id": str(m.id),
            "telegram_id": m.telegram_id,
            "telegram_username": m.telegram_username,
            "full_name": m.full_name,
            "name_variants": m.name_variants,
            "department_id": str(m.department_id) if m.department_id else None,
            "extra_department_ids": [str(dept_id) for dept_id in m.extra_department_ids],
            "position": m.position,
            "email": m.email,
            "birthday": m.birthday.isoformat() if m.birthday else None,
            "avatar_url": m.avatar_url,
            "role": m.role,
            "is_test": m.is_test,
            "is_active": m.is_active,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        }

    def dept_to_dict(d: Department) -> dict:
        dept_members = sorted(
            [
                m
                for m in d.members
                if _is_member_visible(
                    m,
                    include_inactive=include_inactive,
                    include_test=include_test,
                )
            ],
            key=lambda m: (not m.is_active, m.full_name.lower()),
        )
        return {
            "id": str(d.id),
            "name": d.name,
            "description": d.description,
            "head_id": str(d.head_id) if d.head_id else None,
            "color": d.color,
            "sort_order": d.sort_order,
            "is_active": d.is_active,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "members": [member_to_dict(m) for m in dept_members],
        }

    return {
        "departments": [dept_to_dict(d) for d in departments],
        "unassigned": sorted(
            [member_to_dict(m) for m in unassigned],
            key=lambda m: m["full_name"],
        ),
    }


@router.get("", response_model=list[TeamMemberResponse])
async def list_team(
    include_inactive: bool = Query(False),
    include_test: bool = Query(False),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List team members."""
    if include_test and not PermissionService.is_admin(member):
        raise HTTPException(
            status_code=403,
            detail="Только администратор может просматривать тестовых участников",
        )

    members = (
        await member_repo.get_all(session)
        if include_inactive
        else await member_repo.get_all_active(session)
    )
    return [
        m
        for m in members
        if _is_member_visible(
            m,
            include_inactive=include_inactive,
            include_test=include_test,
        )
    ]


@router.post("", response_model=TeamMemberResponse, status_code=201)
async def create_team_member(
    data: TeamMemberCreate,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Create a new team member. Admin can set any role, moderator — only moderator/member."""
    # Admin role can only be assigned by admin
    if data.role == "admin" and not PermissionService.is_admin(member):
        raise HTTPException(
            status_code=403,
            detail="Только администратор может создавать администраторов",
        )
    if data.is_test and not PermissionService.is_admin(member):
        raise HTTPException(
            status_code=403,
            detail="Только администратор может создавать тестовых участников",
        )

    # Check telegram_id uniqueness if provided
    if data.telegram_id is not None:
        existing = await member_repo.get_by_telegram_id(session, data.telegram_id)
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Участник с таким Telegram ID уже существует",
            )

    create_data = data.model_dump(exclude_unset=True)
    extra_department_ids = create_data.pop("extra_department_ids", [])
    normalized_extra_department_ids = await _normalize_extra_department_ids(
        session,
        extra_department_ids,
        primary_department_id=create_data.get("department_id"),
    )

    new_member = await member_repo.create(session, **create_data)
    await _sync_extra_department_access(
        session,
        new_member.id,
        department_ids=normalized_extra_department_ids,
        granted_by_id=member.id,
    )
    await session.commit()
    return await member_repo.get_by_id(session, new_member.id)


@router.get("/{member_id}", response_model=TeamMemberResponse)
async def get_team_member(
    member_id: uuid.UUID,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get team member details."""
    target = await member_repo.get_by_id(session, member_id)
    if not target:
        raise HTTPException(status_code=404, detail="Участник не найден")
    if target.is_test and not PermissionService.is_admin(member):
        raise HTTPException(status_code=404, detail="Участник не найден")
    return target


@router.get(
    "/{member_id}/deactivation-preview",
    response_model=MemberDeactivationPreviewResponse,
)
async def get_member_deactivation_preview(
    member_id: uuid.UUID,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    target = await member_repo.get_by_id(session, member_id)
    if not target:
        raise HTTPException(status_code=404, detail="Участник не найден")
    if target.is_test and not PermissionService.is_admin(member):
        raise HTTPException(status_code=404, detail="Участник не найден")

    open_tasks_stmt = select(func.count(Task.id)).where(
        Task.assignee_id == target.id,
        Task.status.notin_(["done", "cancelled"]),
    )
    open_tasks_count = (await session.execute(open_tasks_stmt)).scalar_one()

    preview_limit = 8
    preview_stmt = (
        select(Task.short_id, Task.title)
        .where(
            Task.assignee_id == target.id,
            Task.status.notin_(["done", "cancelled"]),
        )
        .order_by(Task.deadline.asc().nullslast(), Task.created_at.desc())
        .limit(preview_limit)
    )
    preview_rows = (await session.execute(preview_stmt)).all()
    preview_tasks = [
        MemberDeactivationPreviewTaskItem(short_id=row.short_id, title=row.title)
        for row in preview_rows
    ]

    return MemberDeactivationPreviewResponse(
        open_tasks_count=open_tasks_count,
        open_tasks_preview=preview_tasks,
    )


@router.patch("/{member_id}", response_model=TeamMemberResponse)
async def update_team_member(
    member_id: uuid.UUID,
    data: TeamMemberUpdate,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Update team member. Moderator+ only."""
    target = await member_repo.get_by_id(session, member_id)
    if not target:
        raise HTTPException(status_code=404, detail="Участник не найден")
    if target.is_test and not PermissionService.is_admin(member):
        raise HTTPException(
            status_code=403,
            detail="Только администратор может изменять тестовых участников",
        )

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")

    deactivation_strategy = update_data.pop("deactivation_strategy", None)
    reassign_to_member_id = update_data.pop("reassign_to_member_id", None)
    extra_department_ids = update_data.pop("extra_department_ids", None)
    role_changed = "role" in update_data and update_data["role"] != target.role
    is_test_changed = "is_test" in update_data and update_data["is_test"] != target.is_test

    # Role change requires admin
    if role_changed:
        if not PermissionService.can_manage_roles(member):
            raise HTTPException(
                status_code=403,
                detail="Только администратор может менять роли",
            )
        # Force Telegram menu refresh on the next interaction.
        update_data["bot_ui_version"] = 0

    if is_test_changed and not PermissionService.is_admin(member):
        raise HTTPException(
            status_code=403,
            detail="Только администратор может менять признак тестового участника",
        )

    # Deactivation workflow:
    # - block self-deactivation to avoid accidental lockout
    # - unassign all open tasks so they appear in "Не назначен"
    # - remove as department head
    is_deactivating = (
        "is_active" in update_data
        and update_data["is_active"] is False
        and target.is_active
    )
    if is_deactivating:
        if target.id == member.id:
            raise HTTPException(
                status_code=400,
                detail="Нельзя деактивировать самого себя",
            )
        strategy = (
            deactivation_strategy
            if deactivation_strategy is not None
            else ("reassign" if reassign_to_member_id else "unassign")
        )

        if strategy == "reassign":
            if not reassign_to_member_id:
                raise HTTPException(
                    status_code=400,
                    detail="Выберите участника для переназначения задач",
                )
            if reassign_to_member_id == target.id:
                raise HTTPException(
                    status_code=400,
                    detail="Нельзя переназначить задачи на деактивируемого участника",
                )
            reassign_member = await member_repo.get_by_id(session, reassign_to_member_id)
            if not reassign_member or not reassign_member.is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Выбранный участник для переназначения не найден или деактивирован",
                )

            reassign_result = await session.execute(
                sa_update(Task)
                .where(
                    Task.assignee_id == target.id,
                    Task.status.notin_(["done", "cancelled"]),
                )
                .values(assignee_id=reassign_to_member_id)
            )
            reassigned_count = reassign_result.rowcount or 0
            if reassigned_count:
                logger.info(
                    "Member %s deactivated: %s open tasks reassigned to %s",
                    target.id,
                    reassigned_count,
                    reassign_to_member_id,
                )
        elif strategy == "unassign":
            unassign_result = await session.execute(
                sa_update(Task)
                .where(
                    Task.assignee_id == target.id,
                    Task.status.notin_(["done", "cancelled"]),
                )
                .values(assignee_id=None)
            )
            unassigned_count = unassign_result.rowcount or 0
            if unassigned_count:
                logger.info(
                    "Member %s deactivated: %s open tasks moved to unassigned",
                    target.id,
                    unassigned_count,
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="Некорректная стратегия деактивации",
            )

        await session.execute(
            sa_update(Department)
            .where(Department.head_id == target.id)
            .values(head_id=None)
        )

    effective_primary_department_id = (
        update_data["department_id"]
        if "department_id" in update_data
        else target.department_id
    )
    normalized_extra_department_ids: list[uuid.UUID] | None = None
    if extra_department_ids is not None:
        normalized_extra_department_ids = await _normalize_extra_department_ids(
            session,
            extra_department_ids,
            primary_department_id=effective_primary_department_id,
        )

    updated = await member_repo.update(session, member_id, **update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Участник не найден")

    if normalized_extra_department_ids is not None:
        await _sync_extra_department_access(
            session,
            member_id,
            department_ids=normalized_extra_department_ids,
            granted_by_id=member.id,
        )
    elif "department_id" in update_data and update_data["department_id"] is not None:
        await session.execute(
            sa_delete(TeamMemberDepartmentAccess).where(
                TeamMemberDepartmentAccess.member_id == member_id,
                TeamMemberDepartmentAccess.department_id == update_data["department_id"],
            )
        )

    await session.commit()
    return await member_repo.get_by_id(session, member_id)


@router.post("/{member_id}/avatar")
async def upload_avatar(
    request: Request,
    member_id: uuid.UUID,
    file: UploadFile = File(...),
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Upload avatar for a team member. Moderator+ only."""
    target = await member_repo.get_by_id(session, member_id)
    if not target:
        raise HTTPException(status_code=404, detail="Участник не найден")

    # Validate content type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Допустимые форматы: JPEG, PNG, WebP",
        )

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Максимальный размер файла: 2 МБ",
        )

    # Validate magic bytes (file signature)
    is_jpeg = contents[:2] == b'\xff\xd8'
    is_png = contents[:8] == b'\x89PNG\r\n\x1a\n'
    is_webp = contents[:4] == b'RIFF' and len(contents) > 12 and contents[8:12] == b'WEBP'
    if not (is_jpeg or is_png or is_webp):
        raise HTTPException(
            status_code=400,
            detail="Файл не является допустимым изображением (JPEG, PNG, WebP)",
        )

    # Process with Pillow: resize to 256x256, convert to WebP
    try:
        img = Image.open(io.BytesIO(contents))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Не удалось обработать файл изображения",
        )
    img = img.convert("RGB")
    img.thumbnail((256, 256))

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=85)
    image_bytes = buf.getvalue()

    # Upload to Supabase Storage or local filesystem
    storage_service = request.app.state.storage_service
    if storage_service:
        avatar_url = await storage_service.upload(f"{member_id}.webp", image_bytes)
    else:
        AVATAR_DIR.mkdir(parents=True, exist_ok=True)
        avatar_path = AVATAR_DIR / f"{member_id}.webp"
        avatar_path.write_bytes(image_bytes)
        avatar_url = f"/static/avatars/{member_id}.webp"

    await member_repo.update(session, member_id, avatar_url=avatar_url)
    await session.commit()

    return {"avatar_url": avatar_url}


@router.delete("/{member_id}/avatar")
async def delete_avatar(
    request: Request,
    member_id: uuid.UUID,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Delete avatar for a team member. Moderator+ only."""
    target = await member_repo.get_by_id(session, member_id)
    if not target:
        raise HTTPException(status_code=404, detail="Участник не найден")

    # Delete files from Supabase Storage or local filesystem
    storage_service = request.app.state.storage_service
    if storage_service:
        try:
            await storage_service.delete([f"{member_id}.webp", f"{member_id}_tg.webp"])
        except Exception:
            logger.warning("Failed to delete avatar from Supabase for %s", member_id, exc_info=True)
    else:
        for suffix in ("", "_tg"):
            path = AVATAR_DIR / f"{member_id}{suffix}.webp"
            if path.exists():
                path.unlink()

    # Clear avatar_url
    await member_repo.update(session, member_id, avatar_url=None)
    await session.commit()

    return {"avatar_url": None}
