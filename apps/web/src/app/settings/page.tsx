"use client";

import Link from "next/link";
import { CreditCard, Download, Home, Receipt, RefreshCw, Rocket, ShieldCheck, SlidersHorizontal, Users, Wallet } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { useViewer } from "../../lib/useViewer";
import {
  canEditBaseline,
  canViewBilling,
  canViewCategoryBudgets,
  canViewHouseholdMembers,
  canViewHouseholdSettings,
  type ViewerCaps
} from "../../lib/settingsView";

interface SettingCard {
  href: string;
  title: string;
  description: string;
  icon: typeof Users;
  /** Capability predicate — gates on role + permissions, aligned with backend authz. */
  can: (caps: ViewerCaps) => boolean;
}

const CARDS: SettingCard[] = [
  {
    href: "/settings/household",
    title: "הגדרות בית",
    description: "תקציב חודשי, יום תחילת חודש ואזור קניות.",
    icon: Home,
    can: canViewHouseholdSettings
  },
  {
    href: "/settings/members",
    title: "חברי בית",
    description: "הזמנת בני משפחה, תפקידים ותקציבים אישיים.",
    icon: Users,
    can: canViewHouseholdMembers
  },
  {
    href: "/settings/category-budgets",
    title: "תקציבי קטגוריות",
    description: "קביעת תקרה חודשית להוצאות לפי קטגוריה.",
    icon: Wallet,
    can: canViewCategoryBudgets
  },
  {
    // Late onboarding / edit mode — re-run the wizard against the existing household.
    href: "/onboarding?mode=edit",
    title: "עדכון בסיס התקציב",
    description: "עריכת הכנסות, הוצאות קבועות, תקציבי קטגוריות והתראות.",
    icon: SlidersHorizontal,
    can: canEditBaseline
  },
  {
    href: "/billing",
    title: "תשלום ומסלול",
    description: "ניהול מסלול, פרטי תשלום והיסטוריית חשבוניות.",
    icon: CreditCard,
    can: canViewBilling
  },
  {
    // Receipts: any member (incl. limited_member) may upload a receipt — owner decision.
    href: "/receipts",
    title: "קבלות",
    description: "צילום קבלה והשלמת הפרטים אוטומטית.",
    icon: Receipt,
    can: () => true
  },
  {
    // Export: household expense data. Backend 403s limited_member (server.ts), so gate to
    // owner/admin/adult_member — the same set as canViewHouseholdMembers.
    href: "/export",
    title: "ייצוא נתונים",
    description: "הורדת ההוצאות החודשיות כקובץ CSV.",
    icon: Download,
    can: canViewHouseholdMembers
  },
  {
    // ?from=settings → the legal page's top nav shows "חזרה להגדרות" back to /settings
    // (instead of the default "חזרה לכניסה"). Terms is reachable from that top nav.
    href: "/privacy?from=settings",
    title: "פרטיות ותנאים",
    description: "מדיניות הפרטיות ותנאי השימוש.",
    icon: ShieldCheck,
    can: () => true
  }
];

const PRIVACY_CARD = CARDS[CARDS.length - 1]!;

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
  // (privacy-only) menu. (A slow/empty /me previously left role undefined and only
  // the roles:"all" card rendered → the production "only a privacy card" symptom.)
  if (viewer.status === "loading") {
    return (
      <AppShell>
        <h1 className="page-title">הגדרות</h1>
        <LoadState />
      </AppShell>
    );
  }

  // /me failed — be honest and offer a retry instead of silently hiding management.
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
          <CardLink card={PRIVACY_CARD} />
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
          <CardLink card={PRIVACY_CARD} />
        </section>
      </AppShell>
    );
  }

  // Ready with a household — show every card the viewer's capabilities permit.
  // owner/admin see all; adult_member sees members (+ household settings when
  // permissions.all); limited_member sees only privacy. Capabilities mirror the
  // backend so a surfaced card never 403s on the action it implies.
  const visibleCards = CARDS.filter((card) => card.can(viewer.caps));

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
