"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronLeft,
  CreditCard,
  Download,
  Home,
  Receipt,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Users,
  Wallet
} from "lucide-react";
import { planForCode, type BillingTier, type Subscription } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";
import { useViewer } from "../../lib/useViewer";
import {
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
  /** Token tint key — drives the leading icon tile (var(--{tint}-bg) / var(--{tint}-dark)). */
  tint: string;
  /** Capability predicate — gates on role + permissions, aligned with backend authz. */
  can: (caps: ViewerCaps) => boolean;
}

interface SettingGroup {
  label: string;
  cards: SettingCard[];
}

// ?from=settings → the legal page's top nav shows "חזרה להגדרות" back to /settings
// (instead of the default "חזרה לכניסה"). Reused in the error / no-household states.
const PRIVACY_CARD: SettingCard = {
  href: "/privacy?from=settings",
  title: "פרטיות ותנאים",
  description: "מדיניות הפרטיות ותנאי השימוש.",
  icon: ShieldCheck,
  tint: "ocean",
  can: () => true
};

const GROUPS: SettingGroup[] = [
  {
    label: "משק הבית והמשפחה",
    cards: [
      {
        href: "/settings/household",
        title: "פרטי משק הבית",
        description: "הכנסות, הוצאות קבועות, מבנה החודש ותקציבי הבסיס - המודל המלא.",
        icon: Home,
        tint: "teal",
        can: canViewHouseholdSettings
      },
      {
        href: "/settings/members",
        title: "חברי הבית",
        description: "הזמנת בני משפחה, תפקידים ותקציבים אישיים.",
        icon: Users,
        tint: "coral",
        can: canViewHouseholdMembers
      }
    ]
  },
  {
    label: "תקציב והתראות",
    cards: [
      {
        href: "/settings/category-budgets",
        title: "תקציבי קטגוריות",
        description: "תקרה חודשית לכל קטגוריה - מה שמופיע בדשבורד.",
        icon: Wallet,
        tint: "mustard",
        can: canViewCategoryBudgets
      },
      {
        href: "/settings/notifications",
        title: "התראות",
        description: "מתי ואיך נעדכן אתכם בוואטסאפ.",
        icon: Bell,
        tint: "ocean",
        can: canViewHouseholdSettings
      }
    ]
  },
  {
    label: "חשבון וחיוב",
    cards: [
      {
        // billing now lives under /settings/billing (NOT the old /billing route).
        href: "/settings/billing",
        title: "תשלום ומסלול",
        description: "המסלול שלכם, אמצעי תשלום והיסטוריית חיובים.",
        icon: CreditCard,
        tint: "plum",
        can: canViewBilling
      },
      {
        // Receipts: any member (incl. limited_member) may upload a receipt — owner decision.
        href: "/receipts",
        title: "קבלות",
        description: "צילום ושליחת קבלות בוואטסאפ, והשלמת פרטים אוטומטית.",
        icon: Receipt,
        tint: "berry",
        can: () => true
      }
    ]
  },
  {
    label: "נתונים ופרטיות",
    cards: [
      {
        // Export: household expense data. Backend 403s limited_member, so gate to
        // owner/admin/adult_member — the same set as canViewHouseholdMembers.
        href: "/export",
        title: "יצוא נתונים",
        description: "הורדת ההוצאות החודשיות כקובץ CSV.",
        icon: Download,
        tint: "sage",
        can: canViewHouseholdMembers
      },
      PRIVACY_CARD
    ]
  }
];

// Concise Hebrew tier labels for the banner meta pill (no dashes, by copy rule).
const TIER_LABELS: Record<BillingTier, string> = {
  couple: "זוגי",
  family_small: "משפחתי",
  family_large: "מורחב"
};

/** Resolve a short plan label only when readily available; otherwise undefined (omit the pill). */
function planLabelFor(sub?: Subscription): string | undefined {
  if (!sub) return undefined;
  if (sub.status === "trialing") return "ניסיון";
  const plan = planForCode(sub.planCode);
  return plan ? TIER_LABELS[plan.tier] : undefined;
}

interface BannerData {
  memberCount?: number;
  region?: string;
  planLabel?: string;
}

function CardLink({ card }: { card: SettingCard }) {
  const Icon = card.icon;
  return (
    <Link className="panel settings-card" href={card.href}>
      <span
        className="settings-card__icon"
        style={{ background: `var(--${card.tint}-bg)`, color: `var(--${card.tint}-dark)` }}
        aria-hidden
      >
        <Icon size={22} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="settings-card__title">{card.title}</span>
        <p className="settings-card__desc">{card.description}</p>
      </span>
      <ChevronLeft size={18} className="settings-card__chev" aria-hidden />
    </Link>
  );
}

export default function SettingsPage() {
  const viewer = useViewer();
  const [banner, setBanner] = useState<BannerData>({});

  // Banner data is best-effort and additive. Only fetch once we know the viewer has a
  // household; each step is wrapped so a failure degrades to fewer meta pills (never a crash).
  useEffect(() => {
    if (viewer.status !== "ready" || !viewer.hasHousehold) return;
    let cancelled = false;
    (async () => {
      try {
        const { household, subscription } = await api.currentHousehold();
        if (cancelled) return;
        const next: BannerData = {};
        if (household.defaultCity) next.region = household.defaultCity;
        const plan = planLabelFor(subscription);
        if (plan) next.planLabel = plan;
        setBanner((b) => ({ ...b, ...next }));
        try {
          const { members } = await api.listMembers(household.id);
          if (!cancelled && Array.isArray(members)) setBanner((b) => ({ ...b, memberCount: members.length }));
        } catch {
          // Member count unavailable — omit the "👥" pill.
        }
      } catch {
        // Household/subscription unavailable — banner keeps just the household name.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewer.status, viewer.hasHousehold]);

  // Still resolving who the viewer is — show a loader, never the degraded (privacy-only) menu.
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

  // Ready with a household — banner + labelled groups. Show a group only when at least one of
  // its cards passes its capability gate, and within a group only the cards whose gate passes.
  // Capabilities mirror the backend so a surfaced card never 403s on the action it implies
  // (limited_member is left with only קבלות + פרטיות ותנאים under their groups).
  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    cards: group.cards.filter((card) => card.can(viewer.caps))
  })).filter((group) => group.cards.length > 0);

  // Banner meta order mirrors the design: members · plan · region. The plan tier is
  // billing-sensitive — gate it to owner/admin (canViewBilling) so a limited_member /
  // adult never sees the household's billing tier even though the banner fetch returns it.
  const metaPills = [
    typeof banner.memberCount === "number" ? `👥 ${banner.memberCount} חברים` : null,
    banner.planLabel && canViewBilling(viewer.caps) ? `💳 מסלול ${banner.planLabel}` : null,
    banner.region ? `📍 ${banner.region}` : null
  ].filter((p): p is string => p !== null);

  return (
    <AppShell>
      <h1 className="page-title">הגדרות</h1>
      <p className="muted" style={{ marginBottom: 20 }}>ניהול משק הבית, התקציב, החיוב והפרטיות במקום אחד.</p>

      <div className="settings-banner">
        <div className="settings-banner__tile" aria-hidden>🏡</div>
        <div>
          <div className="settings-banner__eyebrow">הגדרות הבית</div>
          <div className="settings-banner__title">
            {viewer.householdName ? `משפחת ${viewer.householdName}` : "הבית שלכם"}
          </div>
          {metaPills.length > 0 ? (
            <div className="settings-banner__meta">
              {metaPills.map((pill) => (
                <span key={pill}>{pill}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {visibleGroups.map((group) => (
        <div className="settings-group" key={group.label}>
          <div className="settings-group__label label">{group.label}</div>
          <section className="grid two">
            {group.cards.map((card) => (
              <CardLink card={card} key={card.href} />
            ))}
          </section>
        </div>
      ))}
    </AppShell>
  );
}
