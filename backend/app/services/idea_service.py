import math
from datetime import datetime
from types import SimpleNamespace

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Department, Idea, IdeaDepartment, IdeaTask, TeamMember
from app.db.repositories import IdeaRepository
from app.db.schemas import (
    IdeaDepartmentResponse,
    IdeaResponse,
    IdeaTaskResponse,
    PaginatedIdeasResponse,
)
from app.services.permission_service import PermissionService
from app.services.task_visibility_service import can_access_task


CLOSED_TASK_STATUSES = {"done", "cancelled"}
COMPLETED_DEPARTMENT_STATUSES = {"ready", "not_required"}
DECISION_STATUSES = {"accepted", "rejected", "deferred"}


class IdeaService:
    def __init__(self, repo: IdeaRepository | None = None) -> None:
        self.repo = repo or IdeaRepository()

    def validate_status_change(self, status: str, comment: str | None) -> None:
        if status in {"rejected", "deferred"} and not (comment or "").strip():
            raise ValueError("Укажите причину решения по идее")

    def can_manage_idea(self, member: TeamMember, idea: Idea) -> bool:
        return (
            PermissionService.is_moderator(member)
            or getattr(idea, "review_owner_id", None) == getattr(member, "id", None)
        )

    def can_manage_idea_department(
        self,
        member: TeamMember,
        idea: Idea,
        idea_department: IdeaDepartment,
    ) -> bool:
        if self.can_manage_idea(member, idea):
            return True
        member_id = getattr(member, "id", None)
        if getattr(idea_department, "owner_id", None) == member_id:
            return True
        department = getattr(idea_department, "department", None)
        return getattr(department, "head_id", None) == member_id

    def can_add_department(
        self,
        member: TeamMember,
        idea: Idea,
        department: Department,
    ) -> bool:
        if getattr(idea, "status", None) not in {"accepted", "in_tasks"}:
            return False
        return self.can_manage_idea(member, idea) or (
            getattr(department, "head_id", None) == getattr(member, "id", None)
        )

    def can_complete_idea(self, idea: Idea) -> bool:
        departments = list(getattr(idea, "departments", []) or [])
        if departments:
            return all(
                getattr(department, "status", None) in COMPLETED_DEPARTMENT_STATUSES
                for department in departments
            )

        direct_links = [
            link
            for link in (getattr(idea, "task_links", []) or [])
            if getattr(link, "idea_department_id", None) is None
        ]
        return bool(direct_links) and all(self._is_closed_task_link(link) for link in direct_links)

    def can_mark_department_ready(self, idea_department: IdeaDepartment) -> bool:
        task_links = list(getattr(idea_department, "task_links", []) or [])
        return all(self._is_closed_task_link(link) for link in task_links)

    async def shape_task_link(
        self,
        session: AsyncSession,
        member: TeamMember,
        link: IdeaTask,
    ) -> IdeaTaskResponse:
        task = getattr(link, "task", None)
        visible = await can_access_task(session, member, task)
        shaped_link = SimpleNamespace(
            id=link.id,
            idea_id=link.idea_id,
            idea_department_id=link.idea_department_id,
            task_id=link.task_id,
            created_by_id=link.created_by_id,
            created_at=link.created_at,
            task=task if visible else None,
            hidden=not visible,
        )
        return IdeaTaskResponse.model_validate(shaped_link)

    async def shape_response(
        self,
        session: AsyncSession,
        member: TeamMember,
        idea: Idea,
        include_comments: bool = True,
        include_events: bool = True,
    ) -> IdeaResponse:
        direct_links = [
            link
            for link in (getattr(idea, "task_links", []) or [])
            if getattr(link, "idea_department_id", None) is None
        ]
        shaped_direct_links = [
            await self.shape_task_link(session, member, link) for link in direct_links
        ]

        shaped_departments = []
        for department in getattr(idea, "departments", []) or []:
            shaped_department_links = [
                await self.shape_task_link(session, member, link)
                for link in (getattr(department, "task_links", []) or [])
            ]
            shaped_departments.append(
                IdeaDepartmentResponse.model_validate(department).model_copy(
                    update={"task_links": shaped_department_links}
                )
            )

        all_shaped_links = self._dedupe_task_links(
            [
                *shaped_direct_links,
                *[
                    link
                    for department in shaped_departments
                    for link in department.task_links
                ],
            ]
        )
        response = IdeaResponse.model_validate(idea)
        return response.model_copy(
            update={
                "departments": shaped_departments,
                "task_links": shaped_direct_links,
                "comments": response.comments if include_comments else [],
                "events": response.events if include_events else [],
                "linked_task_count": len(all_shaped_links),
                "visible_linked_task_count": sum(
                    1 for link in all_shaped_links if not link.hidden
                ),
                "completed_linked_task_count": sum(
                    1
                    for link in all_shaped_links
                    if getattr(link.task, "status", None) in CLOSED_TASK_STATUSES
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
                "can_complete": self.can_complete_idea(idea),
            }
        )

    async def list_ideas(
        self,
        session: AsyncSession,
        member: TeamMember,
        **filters,
    ) -> PaginatedIdeasResponse:
        ideas, total = await self.repo.list(session, **filters)
        items = [
            await self.shape_response(
                session,
                member,
                item,
                include_comments=False,
                include_events=False,
            )
            for item in ideas
        ]
        page = filters.get("page", 1)
        per_page = filters.get("per_page", 50)
        pages = max(1, math.ceil(total / max(per_page, 1)))
        return PaginatedIdeasResponse(
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
        idea: Idea,
        member: TeamMember,
        status: str,
        comment: str | None,
        deferred_until,
    ) -> Idea:
        if not self.can_manage_idea(member, idea):
            raise PermissionError("Недостаточно прав для изменения статуса идеи")

        self.validate_status_change(status, comment)
        if status == "completed" and not self.can_complete_idea(idea):
            raise ValueError("Идею нельзя завершить: не все связанные работы закрыты")

        now = datetime.utcnow()
        old_status = idea.status
        fields = {"status": status}
        if status in DECISION_STATUSES:
            fields.update(
                {
                    "decision_comment": (comment or "").strip() or None,
                    "decision_by_id": member.id,
                    "decision_at": now,
                    "deferred_until": deferred_until if status == "deferred" else None,
                }
            )
        if status == "completed":
            fields["completed_at"] = now
        else:
            fields["completed_at"] = None

        updated = await self.repo.update(session, idea, **fields)
        await self.repo.add_event(
            session,
            idea_id=idea.id,
            actor_id=member.id,
            event_type="status_changed",
            payload={"old_status": old_status, "new_status": status},
        )
        if status in DECISION_STATUSES:
            await self.repo.add_event(
                session,
                idea_id=idea.id,
                actor_id=member.id,
                event_type="decision_recorded",
                payload={
                    "status": status,
                    "comment": fields["decision_comment"],
                    "deferred_until": deferred_until.isoformat()
                    if deferred_until is not None
                    else None,
                },
            )
        return updated

    def _is_closed_task_link(self, link: IdeaTask) -> bool:
        task = getattr(link, "task", None)
        return getattr(task, "status", None) in CLOSED_TASK_STATUSES

    def _dedupe_task_links(
        self,
        links: list[IdeaTaskResponse],
    ) -> list[IdeaTaskResponse]:
        seen = set()
        deduped = []
        for link in links:
            if link.id in seen:
                continue
            seen.add(link.id)
            deduped.append(link)
        return deduped
