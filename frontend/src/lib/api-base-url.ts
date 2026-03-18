/**
 * API base URL utilities.
 *
 * All API requests use relative URLs ("/api/...") and are proxied to the
 * backend via Next.js rewrites (see next.config.mjs). This eliminates
 * cross-origin requests and avoids CORS issues entirely.
 */

function normalizeApiUrl(value: string | undefined): string {
  const trimmed = (value || "").trim();
  const unquoted = trimmed.replace(/^['\"]|['\"]$/g, "");
  return (unquoted || "http://localhost:8000").replace(/\/+$/, "");
}

/**
 * Returns the configured backend URL (for error messages only).
 * Actual requests use relative URLs proxied through Next.js rewrites.
 */
export function getConfiguredApiUrl(): string {
  return normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
}

/**
 * Returns API base candidates for fetch calls.
 * Always returns [""] (relative URL) — requests are proxied via Next.js rewrites.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getApiBaseCandidates(preferred?: string | null): string[] {
  return [""];
}
