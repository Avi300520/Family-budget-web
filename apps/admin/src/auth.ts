/**
 * NextAuth (Auth.js v5) instance for the admin app — the Node-side handler used by the auth route
 * (app/api/auth/[...nextauth]/route.ts) and the BFF (await auth()). Built from the shared edge-safe
 * authConfig. AUTH_SECRET + AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET are read from env by NextAuth.
 */
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
