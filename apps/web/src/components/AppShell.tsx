"use client";

import Link from "next/link";
import { Activity, BarChart3, Gift, LayoutDashboard, ListChecks, Settings, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { HouseholdRole } from "@shopping-assistant/shared-types";
import { api } from "../lib/api";

interface NavLink {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: HouseholdRole[] | "all";
}

// Receipts and the dev-inbox have been intentionally moved out of the primary
// nav: receipts live as a card on the dashboard; the dev-inbox is internal
// tooling, reached directly by URL during local development.
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
  { href: "/family/pulse",    label: "פעילות",           icon: Activity,        roles: ["owner", "admin", "adult_member"] },
  // Iteration 8 — children's wishlists (parent surface). Owner/admin ONLY:
  // adult_member is NOT a parent for the wishlist, and the server returns 403
  // for both adult_member and limited_member on /households/:id/wishlist.
  { href: "/family/wishlists", label: "משאלות",         icon: Gift,            roles: ["owner", "admin"] },
  { href: "/settings",         label: "הגדרות",         icon: Settings,        roles: "all" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<HouseholdRole>();

  useEffect(() => {
    api.me().then((me) => setRole(me.membership?.role)).catch(() => undefined);
  }, []);

  const links = ALL_LINKS.filter((link) => {
    if (link.roles === "all") return true;
    if (!role) return false;
    return link.roles.includes(role);
  });

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
