import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(__dirname, "..");
export const EVIDENCE = path.join(ROOT, "evidence");
export const SHOTS = path.join(EVIDENCE, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

export const states = JSON.parse(fs.readFileSync(path.join(ROOT, "states.json"), "utf8")) as {
  apiBase: string;
  invalid: string;
  active: string;
  mixed: string;
  locked: string;
  joinToken: string;
  mutable: Record<string, string>;
};

export const API = states.apiBase;

/** Append one measurement/verdict record to the NDJSON evidence log. */
export function record(entry: Record<string, unknown>): void {
  fs.appendFileSync(path.join(EVIDENCE, "results.ndjson"), JSON.stringify(entry) + "\n", "utf8");
}

export type Target = {
  id: string;
  path: string;
  /** Which REAL state this URL puts the route in — quoted verbatim in the coverage matrix. */
  state: string;
  /** storageState fixture file name (under ./fixtures) when the route needs a session. */
  storage?: string;
  /** Proof the page really reached the intended state. `open()` throws if it is absent, so a
   *  dead share token can never masquerade as a scanned "real" state. */
  marker?: RegExp;
};

/**
 * The 8 public routes of the accessibility statement, in every state this harness can
 * reach deterministically. `/l` is covered in all four real states (the CI axe run only
 * ever saw the invalid-token error state).
 */
export const TARGETS: Target[] = [
  { id: "home", path: "/", state: "full public page" },
  { id: "login", path: "/login", state: "full public page (same MarketingLanding)" },
  { id: "privacy", path: "/privacy", state: "full public page" },
  { id: "terms", path: "/terms", state: "full public page" },
  { id: "join-real", path: `/join?token=${states.joinToken}`, state: "REAL unconsumed invite token" },
  { id: "join-invalid", path: "/join?token=a11y-verify-bad-token", state: "invalid-invite error state" },
  { id: "onboarding-auth", path: "/onboarding", state: "REAL wizard, authenticated session with no household", storage: "no-household.json" },
  { id: "onboarding-shell", path: "/onboarding", state: "unauthenticated shell / redirect" },
  { id: "consume-invalid", path: `/auth/consume?token=${states.invalid}`, state: "invalid/expired-token error state" },
  { id: "l-active", path: `/l/${states.active}`, state: "REAL list, 9 items, nothing touched", marker: /נשאר\s*9/ },
  { id: "l-mixed", path: `/l/${states.mixed}`, state: "REAL list: partial 5/9 + חסר במלאי + 2 bought + active", marker: /חסר במלאי/ },
  { id: "l-locked", path: `/l/${states.locked}`, state: "REAL completed/LOCKED list (read-only + נשאר לפעם הבאה)", marker: /נשאר לפעם הבאה/ },
  { id: "l-invalid", path: `/l/${states.invalid}`, state: "invalid/expired share-link error state", marker: /אינו תקף/ },
];

/** Accessibility-menu modes. `null` = the default palette. */
export const MENU_MODES = [
  { id: "default", label: null as string | null, steps: 0 },
  { id: "contrast", label: "ניגודיות גבוהה", steps: 0 },
  { id: "readable-font", label: "גופן קריא", steps: 0 },
  { id: "highlight-links", label: "הדגשת קישורים", steps: 0 },
  { id: "stop-motion", label: "עצירת אנימציות", steps: 0 },
  { id: "font-160", label: null as string | null, steps: 6 },  // 100% -> 160% (max)
  { id: "font-90", label: null as string | null, steps: -1 },  // 100% -> 90%  (min)
];
