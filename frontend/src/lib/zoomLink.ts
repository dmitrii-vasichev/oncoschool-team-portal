const HOST_ONLY_QUERY_KEYS = new Set(["zak", "zpk", "role"]);

function extractMeetingIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  let candidate = parts[parts.length - 1];
  if (["j", "s", "wc"].includes(parts[0]) && parts.length > 1) {
    candidate = parts[1];
  }

  const digits = candidate.replace(/\D/g, "");
  return digits || null;
}

export function sanitizeZoomJoinUrl(
  rawUrl: string | null | undefined,
  zoomMeetingId?: string | number | null
): string | null {
  if (typeof rawUrl !== "string") return null;
  const normalizedUrl = rawUrl.trim();
  if (!normalizedUrl) return null;

  try {
    const parsed = new URL(normalizedUrl);
    const rawMeetingId =
      typeof zoomMeetingId === "string"
        ? zoomMeetingId
        : typeof zoomMeetingId === "number"
          ? String(zoomMeetingId)
          : "";
    const meetingId = rawMeetingId.trim() || extractMeetingIdFromPath(parsed.pathname);

    if (meetingId) {
      parsed.pathname = `/j/${meetingId}`;
    }

    const keys = Array.from(parsed.searchParams.keys());
    for (const key of keys) {
      if (HOST_ONLY_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }

    return parsed.toString();
  } catch {
    return normalizedUrl;
  }
}
