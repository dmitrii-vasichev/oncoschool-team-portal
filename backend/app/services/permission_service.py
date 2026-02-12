from app.db.models import Task, TeamMember


class PermissionService:
    @staticmethod
    def is_moderator(member: TeamMember) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_create_task_for_others(member: TeamMember) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_assign_task(member: TeamMember) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_change_task_status(member: TeamMember, task: Task) -> bool:
        if member.role == "moderator":
            return True
        return task.assignee_id == member.id

    @staticmethod
    def can_add_task_update(member: TeamMember, task: Task) -> bool:
        if member.role == "moderator":
            return True
        return task.assignee_id == member.id

    @staticmethod
    def can_delete_task(member: TeamMember) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_manage_team(member: TeamMember) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_submit_summary(member: TeamMember) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_configure_reminders(member: TeamMember) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_subscribe_notifications(member: TeamMember) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_change_ai_settings(member: TeamMember) -> bool:
        return member.role == "moderator"
