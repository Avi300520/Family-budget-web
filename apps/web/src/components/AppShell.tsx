"use client";

import Link from "next/link";
import { Activity, BarChart3, Gift, LayoutDashboard, ListChecks, Settings, Sparkles } from "lucide-react";
import type { HouseholdRole } from "@shopping-assistant/shared-types";
import { useViewer } from "../lib/useViewer";
import { filterByRole } from "../lib/settingsView";

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
  { href: "/budget",           label: "תקציב",          icon: BarChart3,       roles: ["owner", "admin", "adult_member"] },
  // Iteration 7 — Insights / Weekly Wrapped. Privacy: same role scope as
  // /budget (limited_member hidden client-side; server returns 403).
  { href: "/insights",         label: "תובנות",         icon: Sparkles,        roles: ["owner", "admin", "adult_member"] },
  // Iteration 9 — DashboardB / Family Pulse. Owner/admin/adult_member:
  // same role scope as /budget and /insights (limited_member hidden client-side;
  // server returns 403 on all three /family/pulse endpoints).
  // Renamed פעילות→ניתוח (2026-06-17): this destination is the analytics/breakdown page
  // (member & weekday spend + activity heatmap), distinct from the dashboard's
  // "הפעילות שלנו" event feed — the shared "פעילות" label was a confusing collision.
  { href: "/family/pulse",    label: "ניתוח",            icon: Activity,        roles: ["owner", "admin", "adult_member"] },
  // Iteration 8 — children's wishlists (parent surface). Owner/admin ONLY:
  // adult_member is NOT a parent for the wishlist, and the server returns 403
  // for both adult_member and limited_member on /households/:id/wishlist.
  { href: "/family/wishlists", label: "משאלות הילדים",   icon: Gift,            roles: ["owner", "admin"] },
  { href: "/settings",         label: "הגדרות",         icon: Settings,        roles: "all" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  // Resolve the role with explicit loading/error states. Role-gated links appear
  // once the viewer is `ready`; while loading or on a transient /me failure only the
  // always-available ("all") links show — but the settings index surfaces a real
  // loader/retry rather than silently degrading (see lib/useViewer + settingsView).
  const { role } = useViewer();
  const links = filterByRole(ALL_LINKS, role);

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand">קופה משפחתית</div>
        <nav className="nav-links">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link className="nav-link" href={link.href} key={link.href}>
                <Icon size={18} aria-hidden />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
