from app.db.models import Task, TeamMember


class PermissionService:
    TASK_EDIT_BASE_FIELDS = {"status", "checklist", "title"}
    TASK_EDIT_AUTHOR_EXTRA_FIELDS = {"description", "priority", "deadline", "assignee_id"}
    TASK_EDIT_REMINDER_FIELDS = {"reminder_at", "reminder_comment"}
    TASK_EDIT_MODERATOR_FIELDS = (
        TASK_EDIT_BASE_FIELDS | TASK_EDIT_AUTHOR_EXTRA_FIELDS | TASK_EDIT_REMINDER_FIELDS
    )

    @staticmethod
    def is_admin(member: TeamMember) -> bool:
        return member.role == "admin"

    @staticmethod
    def is_moderator(member: TeamMember) -> bool:
        """admin is also a moderator — all existing checks keep working."""
        return member.role in ("admin", "moderator")

    # ── Task permissions ──

    @staticmethod
    def can_create_task_for_others(member: TeamMember) -> bool:
        return member.role in ("admin", "moderator", "member")

    @staticmethod
    def can_assign_task(member: TeamMember, task: Task | None = None) -> bool:
        if PermissionService.is_moderator(member):
            return True
        return task is not None and task.created_by_id == member.id

    @staticmethod
    def can_edit_task(member: TeamMember, task: Task) -> bool:
        if PermissionService.is_moderator(member):
            return True
        return task.assignee_id == member.id or task.created_by_id == member.id

    @staticmethod
    def allowed_task_edit_fields(member: TeamMember, task: Task) -> set[str]:
        if PermissionService.is_moderator(member):
            return set(PermissionService.TASK_EDIT_MODERATOR_FIELDS)

        if not PermissionService.can_edit_task(member, task):
            return set()

        allowed_fields = set(PermissionService.TASK_EDIT_BASE_FIELDS)
        if task.created_by_id == member.id:
            allowed_fields |= PermissionService.TASK_EDIT_AUTHOR_EXTRA_FIELDS
        if PermissionService.can_manage_task_reminder(member, task):
            allowed_fields |= PermissionService.TASK_EDIT_REMINDER_FIELDS
        return allowed_fields

    @staticmethod
    def can_change_task_status(member: TeamMember, task: Task) -> bool:
        return "status" in PermissionService.allowed_task_edit_fields(member, task)

    @staticmethod
    def can_add_task_update(member: TeamMember, task: Task) -> bool:
        return "status" in PermissionService.allowed_task_edit_fields(member, task)

    @staticmethod
    def can_manage_task_reminder(member: TeamMember, task: Task) -> bool:
        if task.status in ("done", "cancelled"):
            return False
        if PermissionService.is_moderator(member):
            return True
        return task.assignee_id == member.id

    @staticmethod
    def can_delete_task(member: TeamMember) -> bool:
        return PermissionService.is_moderator(member)

    # ── Team & content (moderator+) ──

    @staticmethod
    def can_manage_team(member: TeamMember) -> bool:
        return PermissionService.is_moderator(member)

    @staticmethod
    def can_submit_summary(member: TeamMember) -> bool:
        return PermissionService.is_moderator(member)

    @staticmethod
    def can_subscribe_notifications(member: TeamMember) -> bool:
        return PermissionService.is_moderator(member)

    @staticmethod
    def can_manage_departments(member: TeamMember) -> bool:
        return PermissionService.is_moderator(member)

    # ── Member management (moderator+) ──

    @staticmethod
    def can_add_member(member: TeamMember) -> bool:
        return PermissionService.is_moderator(member)

    # ── Admin-only ──

    @staticmethod
    def can_manage_roles(member: TeamMember) -> bool:
        return PermissionService.is_admin(member)

    @staticmethod
    def can_change_ai_settings(member: TeamMember) -> bool:
        return PermissionService.is_admin(member)

    @staticmethod
    def can_configure_reminders(member: TeamMember) -> bool:
        return PermissionService.is_moderator(member)
