// NextAuth (Auth.js v5) catch-all route — Google sign-in, callback, session, sign-out, CSRF.
// Excluded from the admin auth middleware (matcher skips /api/auth) so the OAuth callback can run.
import { handlers } from "../../../../auth";

export const { GET, POST } = handlers;
