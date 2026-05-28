/**
 * Resolves the backend API base URL.
 *
 * Production (NODE_ENV=production) MUST have NEXT_PUBLIC_API_URL set in Vercel
 * (Settings → Environment Variables) for both Production and Preview
 * environments. If it is missing, this helper THROWS — better to surface a
 * loud, traceable error during build/runtime than to silently fall back to
 * localhost and ship a broken bundle that quietly calls the user's machine.
 *
 * Development falls back to http://localhost:3333 (the documented dev API
 * port — see backend `.env.example` API_PORT=3333). The previous fallback of
 * localhost:4000 was wrong on Windows (Hyper-V reserves 4000-4002) and is
 * intentionally removed.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` and `process.env.NODE_ENV` at
 * build time, so the production branch is statically resolved by the bundler.
 */
export function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw && raw.length > 0) return raw;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Production builds must configure this " +
        "env var in Vercel (Settings → Environment Variables) for Production " +
        "and Preview before deploy."
    );
  }
  return "http://localhost:3333";
}
