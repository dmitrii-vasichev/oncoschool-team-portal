import type { MeetingBoardSettings } from "../../lib/types.ts";

export function sanitizeMeetingBoardMaterialUrl(url: string): string | null {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  try {
    const parsedUrl = new URL(trimmedUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export function getMeetingBoardScopeCounts(settings: MeetingBoardSettings): {
  addedMemberCount: number;
  addedDepartmentCount: number;
  pinnedTaskCount: number;
  focusLabelCount: number;
} {
  return {
    addedMemberCount: settings.added_member_ids.length,
    addedDepartmentCount: settings.added_department_ids.length,
    pinnedTaskCount: settings.pinned_task_ids.length,
    focusLabelCount: settings.focus_label_ids.length,
  };
}
