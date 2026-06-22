"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";

/**
 * Top navigation for the public legal pages (/privacy, /terms).
 *
 * A small CLIENT island rendered inside the (otherwise static) server-rendered
 * LegalLayout. It reads ONLY the `from` query param + the current pathname — no
 * /me, no auth, no dashboard data. The page stays public/static; this island
 * hydrates the search param on the client.
 *
 * Security: `from` is never used as a URL. It selects a destination from a
 * fixed allowlist (settings | login). Anything unknown falls back to /login,
 * so a crafted `?from=https://evil` can only ever resolve to /login.
 */

// Strict allowlist — maps a known origin token to an in-app return path + label.
// The default (missing/unknown token) is the public login destination.
const RETURNS = {
  settings: { href: "/settings", label: "חזרה להגדרות" },
  login: { href: "/login", label: "חזרה לכניסה" },
} as const;

export function LegalTopNav() {
  const pathname = usePathname();
  const from = useSearchParams().get("from");

  const ret = from === "settings" ? RETURNS.settings : RETURNS.login;
  // Preserve the origin context when switching between the two legal pages.
  const ctx = from === "settings" ? "?from=settings" : "";

  return (
    <nav className="legal-nav" aria-label="ניווט עמודים משפטיים">
      <Link href={ret.href} className="legal-nav__back">
        <ArrowRight size={16} aria-hidden />
        {ret.label}
      </Link>
      <div className="legal-nav__tabs">
        <Link
          href={`/privacy${ctx}`}
          className="legal-nav__tab"
          aria-current={pathname === "/privacy" ? "page" : undefined}
        >
          מדיניות פרטיות
        </Link>
        <Link
          href={`/terms${ctx}`}
          className="legal-nav__tab"
          aria-current={pathname === "/terms" ? "page" : undefined}
        >
          תנאי שימוש
        </Link>
      </div>
    </nav>
  );
}
