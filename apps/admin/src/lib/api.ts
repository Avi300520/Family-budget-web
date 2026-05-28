"use client";

import { createApiClient } from "@shopping-assistant/api-client";
import { apiBaseUrl } from "./apiBase";

export const api = createApiClient({
  baseUrl: apiBaseUrl(),
  getCsrfToken: () => (typeof window === "undefined" ? undefined : window.localStorage.getItem("adminCsrfToken") ?? undefined),
  setCsrfToken: (token) => {
    if (typeof window !== "undefined") window.localStorage.setItem("adminCsrfToken", token);
  }
});
