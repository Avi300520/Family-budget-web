"use client";

import Link from "next/link";
import { CreditCard, Home, RefreshCw, Rocket, ShieldCheck, SlidersHorizontal, Users, Wallet } from "lucide-react";
import type { HouseholdRole } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { useViewer } from "../../lib/useViewer";
import { filterByRole } from "../../lib/settingsView";

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
    href: "/settings/category-budgets",
    title: "תקציבי קטגוריות",
    description: "קביעת תקרה חודשית להוצאות לפי קטגוריה.",
    icon: Wallet,
    roles: ["owner", "admin"]
  },
  {
    // Late onboarding / edit mode — re-run the wizard against the existing household.
    // Owner/admin only (mirrors the backend SEC-01b guard on /onboarding/complete).
    href: "/onboarding?mode=edit",
    title: "עדכון בסיס התקציב",
    description: "עריכת הכנסות, הוצאות קבועות, תקציבי קטגוריות והתראות.",
    icon: SlidersHorizontal,
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

function CardLink({ card }: { card: SettingCard }) {
  const Icon = card.icon;
  return (
    <Link className="panel" href={card.href} style={{ textDecoration: "none", color: "inherit" }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={20} aria-hidden />
        {card.title}
      </h2>
      <p className="muted">{card.description}</p>
    </Link>
  );
}

export default function SettingsPage() {
  const viewer = useViewer();

  // Still resolving who the viewer is — show a loader, never the degraded
  // (privacy-only) menu. This was the production "only a privacy card" symptom:
  // a slow/empty /me left role undefined and only the roles:"all" card rendered.
  if (viewer.status === "loading") {
    return (
      <AppShell>
        <h1 className="page-title">הגדרות</h1>
        <LoadState />
      </AppShell>
    );
  }

  // /me failed — be honest and offer a retry instead of silently hiding management.
  // The privacy/terms link is always available regardless.
  if (viewer.status === "error") {
    return (
      <AppShell>
        <h1 className="page-title">הגדרות</h1>
        <div className="status error" style={{ display: "block", marginBottom: 16 }}>
          לא הצלחנו לטעון את ההגדרות. בדקו את החיבור ונסו שוב.
          <div style={{ marginTop: 10 }}>
            <button className="button secondary" type="button" onClick={viewer.retry}>
              <RefreshCw size={16} aria-hidden /> נסו שוב
            </button>
          </div>
        </div>
        <section className="grid two">
          <CardLink card={CARDS[CARDS.length - 1]!} />
        </section>
      </AppShell>
    );
  }

  // Authenticated but no household yet (never finished onboarding) — guide them to
  // complete it rather than showing an empty/privacy-only settings menu.
  if (!viewer.hasHousehold) {
    return (
      <AppShell>
        <h1 className="page-title">הגדרות</h1>
        <p className="muted" style={{ marginBottom: 20 }}>עוד לא סיימתם להקים את משק הבית.</p>
        <section className="grid two">
          <Link className="panel" href="/onboarding" style={{ textDecoration: "none", color: "inherit" }}>
            <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Rocket size={20} aria-hidden />
              השלמת הקמת הבית
            </h2>
            <p className="muted">כמה שאלות קצרות ונכין את התקציב שמתנהל בוואטסאפ.</p>
          </Link>
          <CardLink card={CARDS[CARDS.length - 1]!} />
        </section>
      </AppShell>
    );
  }

  // Ready with a household — show the cards permitted for the resolved role.
  // limited_member sees only the roles:"all" cards (privacy); owner/admin see all.
  const visibleCards = filterByRole(CARDS, viewer.role);

  return (
    <AppShell>
      <h1 className="page-title">הגדרות</h1>
      <p className="muted" style={{ marginBottom: 20 }}>ניהול חברי הבית, תשלום והעדפות חשבון.</p>
      <section className="grid two">
        {visibleCards.map((card) => (
          <CardLink card={card} key={card.href} />
        ))}
      </section>
    </AppShell>
  );
}
