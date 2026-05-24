"use client";

import Link from "next/link";
import { BarChart3, LayoutDashboard, ListChecks, Settings } from "lucide-react";
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
        <div className="brand">עוזר הקניות המשפחתי</div>
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
