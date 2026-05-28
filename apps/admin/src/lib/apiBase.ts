/**
 * Resolves the backend API base URL for the admin app.
 *
 * Mirrors apps/web/src/lib/apiBase.ts. Production MUST set NEXT_PUBLIC_API_URL
 * via Vercel; missing in production throws. Development falls back to
 * http://localhost:3333 (the documented dev API port). No silent localhost:4000
 * fallback in production paths.
 */
export function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw && raw.length > 0) return raw;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Production builds must configure this " +
        "env var (Settings → Environment Variables) for Production and Preview."
    );
  }
  return "http://localhost:3333";
}
