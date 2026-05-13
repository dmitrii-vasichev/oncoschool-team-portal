import math
from datetime import datetime
from types import SimpleNamespace

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Department, Project, ProjectDepartment, ProjectTask, TeamMember
from app.db.repositories import ProjectRepository
from app.db.schemas import (
    PaginatedProjectsResponse,
    ProjectDepartmentResponse,
    ProjectResponse,
    ProjectTaskResponse,
)
from app.services.permission_service import PermissionService
from app.services.task_visibility_service import can_access_task


CLOSED_TASK_STATUSES = {"done", "cancelled"}
COMPLETED_DEPARTMENT_STATUSES = {"ready", "not_required"}


class ProjectService:
    def __init__(self, repo: ProjectRepository | None = None) -> None:
        self.repo = repo or ProjectRepository()

    def can_create_direct_project(self, member: TeamMember) -> bool:
        return PermissionService.is_moderator(member)

    def can_manage_project(self, member: TeamMember, project: Project) -> bool:
        return (
            PermissionService.is_moderator(member)
            or getattr(project, "owner_id", None) == getattr(member, "id", None)
        )

    def can_complete_project(self, project: Project) -> bool:
        task_links = self._all_task_links(project)
        return bool(task_links) and all(self._is_closed_task_link(link) for link in task_links)

    def can_delete_project(self, member: TeamMember, project: Project) -> bool:
        if self._has_linked_tasks(project):
            return False
        if PermissionService.is_moderator(member):
            return True
        return (
            getattr(project, "owner_id", None) == getattr(member, "id", None)
            and getattr(project, "status", None) == "planned"
        )

    def validate_delete_project(self, member: TeamMember, project: Project) -> None:
        if self._has_linked_tasks(project):
            raise ValueError("Проект нельзя удалить: по нему уже созданы связанные задачи")

        if PermissionService.is_moderator(member):
            return

        if getattr(project, "owner_id", None) == getattr(member, "id", None):
            if getattr(project, "status", None) != "planned":
                raise ValueError("Удалить можно только запланированный проект до начала работы")
            return

        raise PermissionError("Недостаточно прав для удаления проекта")

    def can_manage_project_department(
        self,
        member: TeamMember,
        project: Project,
        project_department: ProjectDepartment,
    ) -> bool:
        if self.can_manage_project(member, project):
            return True
        member_id = getattr(member, "id", None)
        if getattr(project_department, "owner_id", None) == member_id:
            return True
        department = getattr(project_department, "department", None)
        return getattr(department, "head_id", None) == member_id

    def can_add_department(
        self,
        member: TeamMember,
        project: Project,
        department: Department,
    ) -> bool:
        if getattr(project, "status", None) not in {"planned", "in_progress", "paused"}:
            return False
        return self.can_manage_project(member, project) or (
            getattr(department, "head_id", None) == getattr(member, "id", None)
        )

    def can_mark_department_ready(self, project_department: ProjectDepartment) -> bool:
        task_links = list(getattr(project_department, "task_links", []) or [])
        return all(self._is_closed_task_link(link) for link in task_links)

    async def shape_task_link(
        self,
        session: AsyncSession,
        member: TeamMember,
        link: ProjectTask,
    ) -> ProjectTaskResponse:
        task = getattr(link, "task", None)
        visible = await can_access_task(session, member, task)
        shaped_link = SimpleNamespace(
            id=link.id,
            project_id=link.project_id,
            project_department_id=link.project_department_id,
            task_id=link.task_id,
            created_by_id=link.created_by_id,
            created_at=link.created_at,
            task=task if visible else None,
            hidden=not visible,
        )
        return ProjectTaskResponse.model_validate(shaped_link)

    async def shape_response(
        self,
        session: AsyncSession,
        member: TeamMember,
        project: Project,
        include_comments: bool = True,
        include_events: bool = True,
    ) -> ProjectResponse:
        direct_links = [
            link
            for link in (getattr(project, "task_links", []) or [])
            if getattr(link, "project_department_id", None) is None
        ]
        shaped_direct_links = [
            await self.shape_task_link(session, member, link) for link in direct_links
        ]
        visible_direct_links = [
            link for link in shaped_direct_links if not link.hidden
        ]

        shaped_departments = []
        shaped_department_task_links = []
        for department in getattr(project, "departments", []) or []:
            shaped_department_links = [
                await self.shape_task_link(session, member, link)
                for link in (getattr(department, "task_links", []) or [])
            ]
            shaped_department_task_links.extend(shaped_department_links)
            visible_department_links = [
                link for link in shaped_department_links if not link.hidden
            ]
            shaped_departments.append(
                ProjectDepartmentResponse.model_validate(department).model_copy(
                    update={"task_links": visible_department_links}
                )
            )

        all_raw_links = self._all_task_links(project)
        all_shaped_links = self._dedupe_task_links(
            [
                *shaped_direct_links,
                *shaped_department_task_links,
            ]
        )
        milestones = list(getattr(project, "milestones", []) or [])
        response = ProjectResponse.model_validate(project)
        return response.model_copy(
            update={
                "departments": shaped_departments,
                "task_links": visible_direct_links,
                "comments": response.comments if include_comments else [],
                "events": response.events if include_events else [],
                "linked_task_count": len(all_shaped_links),
                "visible_linked_task_count": sum(
                    1 for link in all_shaped_links if not link.hidden
                ),
                "completed_linked_task_count": sum(
                    1
                    for link in all_raw_links
                    if self._is_closed_task_link(link)
                ),
                "hidden_linked_task_count": sum(
                    1 for link in all_shaped_links if link.hidden
                ),
                "ready_department_count": sum(
                    1
                    for department in shaped_departments
                    if department.status in COMPLETED_DEPARTMENT_STATUSES
                ),
                "required_department_count": sum(
                    1
                    for department in shaped_departments
                    if department.status != "not_required"
                ),
                "completed_milestone_count": sum(
                    1 for milestone in milestones if getattr(milestone, "status", None) == "done"
                ),
                "milestone_count": len(milestones),
                "can_complete": self.can_complete_project(project),
                "can_delete": self.can_delete_project(member, project),
            }
        )

    async def list_projects(
        self,
        session: AsyncSession,
        member: TeamMember,
        **filters,
    ) -> PaginatedProjectsResponse:
        projects, total = await self.repo.list(session, **filters)
        items = [
            await self.shape_response(
                session,
                member,
                item,
                include_comments=False,
                include_events=False,
            )
            for item in projects
        ]
        page = filters.get("page", 1)
        per_page = filters.get("per_page", 50)
        pages = max(1, math.ceil(total / max(per_page, 1)))
        return PaginatedProjectsResponse(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
            pages=pages,
        )

    async def record_status_change(
        self,
        session: AsyncSession,
        *,
        project: Project,
        member: TeamMember,
        status: str,
    ) -> Project:
        if not self.can_manage_project(member, project):
            raise PermissionError("Недостаточно прав для изменения статуса проекта")

        if status == "completed" and not self.can_complete_project(project):
            raise ValueError("Проект нельзя завершить: не все связанные задачи закрыты")

        now = datetime.utcnow()
        old_status = project.status
        fields = {
            "status": status,
            "completed_at": now if status == "completed" else None,
        }

        updated = await self.repo.update(session, project, **fields)
        await self.repo.add_event(
            session,
            project_id=project.id,
            actor_id=member.id,
            event_type="status_changed",
            payload={"old_status": old_status, "new_status": status},
        )
        if status == "completed":
            await self.repo.add_event(
                session,
                project_id=project.id,
                actor_id=member.id,
                event_type="project_completed",
                payload={"completed_at": now.isoformat()},
            )
        return updated

    def _is_closed_task_link(self, link: ProjectTask) -> bool:
        task = getattr(link, "task", None)
        return getattr(task, "status", None) in CLOSED_TASK_STATUSES

    def _has_linked_tasks(self, project: Project) -> bool:
        return bool(self._all_task_links(project))

    def _dedupe_task_links(self, links: list) -> list:
        seen = set()
        deduped = []
        for link in links:
            link_id = getattr(link, "id", None)
            if link_id in seen:
                continue
            seen.add(link_id)
            deduped.append(link)
        return deduped

    def _all_task_links(self, project: Project) -> list:
        return self._dedupe_task_links(
            [
                *list(getattr(project, "task_links", []) or []),
                *[
                    link
                    for department in (getattr(project, "departments", []) or [])
                    for link in (getattr(department, "task_links", []) or [])
                ],
            ]
        )
