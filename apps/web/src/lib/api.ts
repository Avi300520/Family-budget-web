"use client";

import { createApiClient } from "@shopping-assistant/api-client";

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  getCsrfToken: () => (typeof window === "undefined" ? undefined : window.localStorage.getItem("csrfToken") ?? undefined),
  setCsrfToken: (token) => {
    if (typeof window !== "undefined") window.localStorage.setItem("csrfToken", token);
  }
});

export function clearClientSession() {
  if (typeof window !== "undefined") window.localStorage.removeItem("csrfToken");
}
