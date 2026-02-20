const LOCAL_DEV_API_URL = "http://localhost:8000";

function normalizeApiUrl(value: string | undefined): string {
  const trimmed = (value || "").trim();
  const unquoted = trimmed.replace(/^['\"]|['\"]$/g, "");
  return (unquoted || LOCAL_DEV_API_URL).replace(/\/+$/, "");
}

function isLocalFrontendHost(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getConfiguredApiUrl(): string {
  return normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
}

export function getApiBaseCandidates(preferred?: string | null): string[] {
  const candidates: string[] = [];

  if (preferred) {
    candidates.push(normalizeApiUrl(preferred));
  }

  const configured = getConfiguredApiUrl();
  candidates.push(configured);

  if (isLocalFrontendHost() && configured !== LOCAL_DEV_API_URL) {
    candidates.push(LOCAL_DEV_API_URL);
  }

  return Array.from(new Set(candidates));
}
