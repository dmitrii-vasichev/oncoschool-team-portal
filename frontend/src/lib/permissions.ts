import { type TeamMember, type Task } from "./types";

export class PermissionService {
  static isAdmin(member: TeamMember): boolean {
    return member.role === "admin";
  }

  static isModerator(member: TeamMember): boolean {
    return member.role === "admin" || member.role === "moderator";
  }

  static canCreateTaskForOthers(member: TeamMember): boolean {
    return ["admin", "moderator", "member"].includes(member.role);
  }

  static canAssignTask(member: TeamMember, task?: Task): boolean {
    if (PermissionService.isModerator(member)) return true;
    return !!task && task.created_by_id === member.id;
  }

  static canChangeTaskStatus(member: TeamMember, task: Task): boolean {
    if (PermissionService.isModerator(member)) return true;
    return task.assignee_id === member.id || task.created_by_id === member.id;
  }

  static canAddTaskUpdate(member: TeamMember, task: Task): boolean {
    if (PermissionService.isModerator(member)) return true;
    return task.assignee_id === member.id || task.created_by_id === member.id;
  }

  static canManageTaskReminder(member: TeamMember, task: Task): boolean {
    if (task.status === "done" || task.status === "cancelled") return false;
    if (PermissionService.isModerator(member)) return true;
    return task.assignee_id === member.id;
  }

  static canDeleteTask(member: TeamMember): boolean {
    return PermissionService.isModerator(member);
  }

  static canManageTeam(member: TeamMember): boolean {
    return PermissionService.isModerator(member);
  }

  static canSubmitSummary(member: TeamMember): boolean {
    return PermissionService.isModerator(member);
  }

  static canSubscribeNotifications(member: TeamMember): boolean {
    return PermissionService.isModerator(member);
  }

  static canManageDepartments(member: TeamMember): boolean {
    return PermissionService.isModerator(member);
  }

  static canAddMember(member: TeamMember): boolean {
    return PermissionService.isModerator(member);
  }

  static canManageRoles(member: TeamMember): boolean {
    return PermissionService.isAdmin(member);
  }

  static canChangeAiSettings(member: TeamMember): boolean {
    return PermissionService.isAdmin(member);
  }

  static canConfigureReminders(member: TeamMember): boolean {
    return PermissionService.isModerator(member);
  }

  /**
   * Check if member can potentially access content module.
   * Admins always have access; for others, actual access is checked
   * via ContentAccessService on the backend (useContentAccess hook).
   */
  static canAccessContent(member: TeamMember): boolean {
    // Admins always have implicit access
    return PermissionService.isAdmin(member);
  }
}
