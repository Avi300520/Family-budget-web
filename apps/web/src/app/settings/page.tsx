"use client";

import Link from "next/link";
import { CreditCard, Home, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { HouseholdRole } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { api } from "../../lib/api";

interface SettingCard {
  href: string;
  title: string;
  description: string;
  icon: typeof Users;
  roles: HouseholdRole[] | "all";
}

const CARDS: SettingCard[] = [
  {
    href: "/settings/household",
    title: "הגדרות בית",
    description: "תקציב חודשי, יום תחילת חודש ואזור קניות.",
    icon: Home,
    roles: ["owner", "admin"]
  },
  {
    href: "/settings/members",
    title: "חברי בית",
    description: "הזמנת בני משפחה, תפקידים ותקציבים אישיים.",
    icon: Users,
    roles: ["owner", "admin"]
  },
  {
    href: "/billing",
    title: "תשלום ומסלול",
    description: "ניהול מסלול, פרטי תשלום והיסטוריית חשבוניות.",
    icon: CreditCard,
    roles: ["owner", "admin"]
  },
  {
    href: "/privacy",
    title: "פרטיות ותנאים",
    description: "מדיניות הפרטיות ותנאי השימוש.",
    icon: ShieldCheck,
    roles: "all"
  }
];

export default function SettingsPage() {
  const [role, setRole] = useState<HouseholdRole>();

  useEffect(() => {
    api.me().then((me) => setRole(me.membership?.role)).catch(() => undefined);
  }, []);

  const visibleCards = CARDS.filter((card) => {
    if (card.roles === "all") return true;
    if (!role) return false;
    return card.roles.includes(role);
  });

  return (
    <AppShell>
      <h1 className="page-title">הגדרות</h1>
      <p className="muted" style={{ marginBottom: 20 }}>ניהול חברי הבית, תשלום והעדפות חשבון.</p>
      <section className="grid two">
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link className="panel" href={card.href} key={card.href} style={{ textDecoration: "none", color: "inherit" }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon size={20} aria-hidden />
                {card.title}
              </h2>
              <p className="muted">{card.description}</p>
            </Link>
          );
        })}
      </section>
    </AppShell>
  );
}
