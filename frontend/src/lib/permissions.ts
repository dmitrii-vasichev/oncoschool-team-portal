import { type TeamMember, type Task } from "./types";

export class PermissionService {
  static isModerator(member: TeamMember): boolean {
    return member.role === "moderator";
  }

  static canCreateTaskForOthers(member: TeamMember): boolean {
    return member.role === "moderator";
  }

  static canAssignTask(member: TeamMember): boolean {
    return member.role === "moderator";
  }

  static canChangeTaskStatus(member: TeamMember, task: Task): boolean {
    if (member.role === "moderator") return true;
    return task.assignee_id === member.id;
  }

  static canAddTaskUpdate(member: TeamMember, task: Task): boolean {
    if (member.role === "moderator") return true;
    return task.assignee_id === member.id;
  }

  static canDeleteTask(member: TeamMember): boolean {
    return member.role === "moderator";
  }

  static canManageTeam(member: TeamMember): boolean {
    return member.role === "moderator";
  }

  static canSubmitSummary(member: TeamMember): boolean {
    return member.role === "moderator";
  }

  static canConfigureReminders(member: TeamMember): boolean {
    return member.role === "moderator";
  }

  static canSubscribeNotifications(member: TeamMember): boolean {
    return member.role === "moderator";
  }

  static canChangeAiSettings(member: TeamMember): boolean {
    return member.role === "moderator";
  }
}
