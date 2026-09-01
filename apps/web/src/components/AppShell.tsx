"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, ChevronRight, ClipboardList, Gift, LayoutDashboard, ListChecks, LogOut, Menu, Settings, Sparkles } from "lucide-react";
import type { HouseholdRole } from "@shopping-assistant/shared-types";
import { api, clearClientSession } from "../lib/api";
import { backLinkFor } from "../lib/backLink";
import { useViewer } from "../lib/useViewer";
import { filterByRole } from "../lib/settingsView";
import { roleLabelFor } from "../lib/roleLabels";
import { Avatar } from "./Avatar";

/** Active when the current path equals the link or is nested under it (prefix match
 *  on a path boundary), so e.g. /settings/members highlights "הגדרות". */
function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const base = href.split("?")[0]!;
  return pathname === base || pathname.startsWith(base + "/");
}

interface NavLink {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: HouseholdRole[] | "all";
}

// Receipts, export, and the dev-inbox are intentionally NOT primary nav items.
// Receipts ("קבלות") and export ("ייצוא נתונים") are discoverable as cards in
// /settings (2026-06-17); the dev-inbox is internal tooling, reached by URL in dev.
const ALL_LINKS: NavLink[] = [
  { href: "/dashboard",        label: "דשבורד",        icon: LayoutDashboard, roles: "all" },
  { href: "/shopping-list",    label: "רשימת קניות",   icon: ListChecks,      roles: "all" },
  // limited_member surface — their pending household-expense requests.
  { href: "/my-requests",      label: "הבקשות שלי",    icon: ClipboardList,   roles: ["limited_member"] },
  { href: "/budget",           label: "תקציב",          icon: BarChart3,       roles: ["owner", "admin", "adult_member"] },
  // Merged Insights + Analysis (redesign §I): ONE "תובנות וניתוח" destination
  // (/insights) with סיכום/ניתוח tabs + a period selector. The old /family/pulse
  // now redirects here, so the nav is the canonical 6 items. Same role scope as
  // /budget (limited_member hidden client-side; server returns 403).
  { href: "/insights",         label: "תובנות וניתוח",  icon: Sparkles,        roles: ["owner", "admin", "adult_member"] },
  // Iteration 8 — children's wishlists (parent surface). Owner/admin ONLY.
  { href: "/family/wishlists", label: "משאלות",   icon: Gift,            roles: ["owner", "admin"] },
  { href: "/settings",         label: "הגדרות",         icon: Settings,        roles: "all" }
];

/** Gradient brand mark — coral→mustard "P" tile (design set-shell.jsx BrandMark). */
function BrandMark() {
  return <span className="brand-mark" aria-hidden>P</span>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // Resolve the role with explicit loading/error states. Role-gated links appear
  // once the viewer is `ready`; while loading or on a transient /me failure only the
  // always-available ("all") links show — but the settings index surfaces a real
  // loader/retry rather than silently degrading (see lib/useViewer + settingsView).
  const { role, displayName, householdName, hasHousehold } = useViewer();
  const links = filterByRole(ALL_LINKS, role);
  const router = useRouter();
  const pathname = usePathname();
  const backLink = backLinkFor(pathname);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Close the mobile drawer whenever the route changes (a nav tap navigates).
  // A navigation legitimately resets focus, so this path deliberately does NOT
  // move focus - only the two explicit dismissals below do.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // BATCH-GI (2.4.3): the closed drawer is `visibility:hidden`, which drops its
  // whole subtree out of the focus order - so an explicit dismissal (Escape or
  // scrim) would blur the focused nav link and orphan focus to <body>. Return
  // focus to the burger that opened it (same contract as LandingNav). Orphan
  // guard: if the user has already Tabbed somewhere outside the drawer, leave
  // their focus exactly where they put it.
  const dismissDrawer = useCallback(() => {
    const ae = document.activeElement;
    const shouldRestore = !ae || ae === document.body || !!drawerRef.current?.contains(ae);
    setDrawerOpen(false);
    if (shouldRestore) burgerRef.current?.focus();
  }, []);

  // While the drawer is open: lock body scroll and close on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissDrawer();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen, dismissDrawer]);

  // Real logout: the backend revokes the session + clears the HttpOnly cookie (the FE
  // cannot clear it). Only on a confirmed success do we drop the local csrf and route to
  // /login — never optimistically, since a failed call leaves the session alive.
  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(false);
    try {
      await api.logout();
      clearClientSession();
      router.replace("/login");
    } catch {
      setLogoutError(true);
      setLoggingOut(false);
    }
  }

  // The sidebar body is rendered in BOTH the fixed desktop rail and the mobile
  // drawer (one source of truth, like the design's SidebarNav). Its parent
  // (.side-nav / .app-drawer) is the flex column that pins the footer to bottom.
  const sidebar = (
    <>
      <div className="brand">
        <BrandMark />
        <div className="brand-text">
          <div className="brand-name">קופה משפחתית</div>
          <div className="brand-sub">Pingtally</div>
        </div>
      </div>
      <nav className="nav-links">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              className="nav-link"
              href={link.href}
              key={link.href}
              data-action={`navigate-${link.href.replace(/^\//, "").replaceAll("/", "-") || "home"}`}
              aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
            >
              <Icon size={18} aria-hidden />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
      {/* Account / logout — pinned to the sidebar footer. The identity block
          (name + role · household) is the SINGLE home for who-is-signed-in. */}
      <div className="side-nav-footer">
        {hasHousehold && displayName && (
          <div className="side-id">
            <Avatar memberId={displayName} displayName={displayName} size="sm" />
            <div className="side-id__text">
              <div className="side-id__name">{displayName}</div>
              <div className="side-id__meta">
                {[roleLabelFor(role), householdName].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
        )}
        {/* BATCH-GI F-A1 (2.4.3): activating this button is what disabled it, so the
            focused element vanished from the focus order and focus fell to <body>.
            aria-busy carries the in-flight state instead; the re-entrancy guard is
            already the first statement of handleLogout(), so nothing double-submits. */}
        <button type="button" className="nav-link nav-logout" onClick={handleLogout} aria-busy={loggingOut}>
          <LogOut size={18} aria-hidden />
          <span>{loggingOut ? "מתנתק…" : "התנתקות"}</span>
        </button>
        {/* BATCH-GI F-B1 (4.1.3): the failure appears with no other announcement. */}
        {logoutError && <div className="nav-logout-error" role="alert">ההתנתקות נכשלה, נסו שוב.</div>}
      </div>
    </>
  );

  return (
    <div className="app-shell">
      {/* Desktop fixed rail (hidden ≤900px). */}
      <aside className="side-nav">{sidebar}</aside>

      {/* Mobile sticky top bar (≤900px): hamburger + centered brand. */}
      <header className="app-topbar">
        <button
          type="button"
          ref={burgerRef}
          className="topbar-btn"
          data-action="open-navigation"
          aria-label="פתיחת תפריט"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <Menu size={22} aria-hidden />
        </button>
        <div className="topbar-brand">
          <BrandMark />
          <span>קופה משפחתית</span>
        </div>
        <span className="topbar-spacer" aria-hidden />
      </header>

      {/* Mobile off-canvas drawer (slides from the RTL right) + scrim. */}
      <div
        className={"app-drawer-scrim" + (drawerOpen ? " open" : "")}
        onClick={dismissDrawer}
        aria-hidden
      />
      <aside ref={drawerRef} className={"app-drawer" + (drawerOpen ? " open" : "")} aria-label="תפריט" aria-hidden={!drawerOpen}>
        {sidebar}
      </aside>

      {/* BATCH-GI F2 (2.4.1): id="main" was missing, so the site-wide skip link's
          href="#main" resolved to nothing on EVERY authenticated route, not just
          the dashboard. A11yBar's JS fallback masked it for mouse-less users with
          JS on; with JS off the link went nowhere. */}
      <main id="main" className="main">
        {/* Back-to-hub affordance, one place → covers all states. The ROUTE TABLE moved to
            `lib/backLink.ts` when `CC_UX_BUILD` item 6 added the three separate-accounts pages,
            which had no navigation and no way back at all; the rule is testable there and this
            component just renders the answer. */}
        {backLink && (
          <Link
            href={backLink.href}
            data-action="navigate-back"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
              padding: "6px 4px",
              marginBottom: "var(--sp-2)",
              color: "var(--text-2)",
              fontWeight: 600,
              fontSize: 14
            }}
          >
            <ChevronRight size={18} aria-hidden />
            <span>{backLink.label}</span>
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}
