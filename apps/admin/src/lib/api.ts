"use client";

import { createApiClient } from "@shopping-assistant/api-client";

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  getCsrfToken: () => (typeof window === "undefined" ? undefined : window.localStorage.getItem("adminCsrfToken") ?? undefined),
  setCsrfToken: (token) => {
    if (typeof window !== "undefined") window.localStorage.setItem("adminCsrfToken", token);
  }
});
