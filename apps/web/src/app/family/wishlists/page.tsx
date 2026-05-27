"use client";

/**
 * Iteration 8 — /family/wishlists (parent surface).
 *
 * Owner/admin ONLY. The server returns 403 on
 * /api/v1/households/:id/wishlist for adult_member AND limited_member, and the
 * AppShell nav hides the link for everyone except owner/admin. We also
 * short-circuit client-side so a non-parent who navigates directly here sees a
 * friendly Hebrew message and never issues a 403'd fetch.
 *
 * The endpoint returns ONLY limited_member-owned items (store-level filter), so
 * a parent's own / an adult's items never appear here. Each child is rendered
 * with their persisted Iteration 6 Avatar colour. Owner/admin may mark an item
 * "נקנה" (fulfilled) or remove it.
 */

import { useEffect, useMemo, useState } from "react";
import type { HouseholdMember, WishlistItem } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { Avatar } from "../../../components/Avatar";
import { LoadState } from "../../../components/LoadState";
import { api } from "../../../lib/api";

type MemberLite = HouseholdMember & { displayName?: string; phoneE164?: string };

export default function FamilyWishlistsPage() {
  const [items, setItems] = useState<WishlistItem[]>();
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [isParent, setIsParent] = useState<boolean>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(undefined);
      try {
        const me = await api.me();
        if (cancelled) return;
        if (!me.household) {
          setError("אין בית מחובר.");
          return;
        }
        const parent = me.membership?.role === "owner" || me.membership?.role === "admin";
        setIsParent(parent);
        if (!parent) return; // adult/limited never fetch — server would 403

        const [wishlistRes, membersRes] = await Promise.all([
          api.householdWishlist(me.household.id),
          api.listMembers(me.household.id).catch(() => ({ members: [] as MemberLite[] })),
        ]);
        if (cancelled) return;
        setItems(wishlistRes.items);
        setMembers(membersRes.members);
      } catch {
        if (cancelled) return;
        setError("לא הצלחנו לטעון את המשאלות. נסו לרענן.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const memberById = useMemo(() => {
    const map = new Map<string, MemberLite>();
    for (const m of members) map.set(m.userId, m);
    return map;
  }, [members]);

  // Group items by owning child, preserving member display order.
  const groups = useMemo(() => {
    const byOwner = new Map<string, WishlistItem[]>();
    for (const w of items ?? []) {
      const list = byOwner.get(w.ownerUserId) ?? [];
      list.push(w);
      byOwner.set(w.ownerUserId, list);
    }
    return [...byOwner.entries()].sort((a, b) => {
      const na = memberById.get(a[0])?.displayName ?? a[0];
      const nb = memberById.get(b[0])?.displayName ?? b[0];
      return na.localeCompare(nb, "he");
    });
  }, [items, memberById]);

  async function fulfill(itemId: string) {
    setError(undefined);
    try {
      const res = await api.updateWishlistItem(itemId, { status: "fulfilled" });
      setItems((prev) => (prev ?? []).map((w) => (w.id === itemId ? res.item : w)));
    } catch {
      setError("לא הצלחנו לסמן כנקנה. נסו שוב.");
    }
  }

  async function remove(itemId: string) {
    setError(undefined);
    try {
      await api.deleteWishlistItem(itemId);
      setItems((prev) => (prev ?? []).filter((w) => w.id !== itemId));
    } catch {
      setError("לא הצלחנו להסיר את המשאלה. נסו שוב.");
    }
  }

  return (
    <AppShell>
      <div style={{ display: "grid", gap: "var(--sp-5)", maxWidth: 720 }}>
        <header style={{ display: "grid", gap: "var(--sp-2)" }}>
          <h1 className="h1">משאלות הילדים 🎁</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            מה הילדים היו רוצים. סמנו כנקנה אחרי שקניתם.
          </div>
        </header>

        {isParent === false ? (
          <section className="panel" style={{ padding: "var(--sp-5)" }}>
            <div style={{ fontWeight: 600, marginBottom: "var(--sp-2)" }}>
              הדף הזה זמין רק לבעלים ולמנהלי הבית
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              המשאלות שלכם נמצאות בדשבורד האישי שלכם.
            </div>
          </section>
        ) : error ? (
          <LoadState error={error} />
        ) : items === undefined ? (
          <LoadState />
        ) : groups.length === 0 ? (
          <section
            className="card"
            style={{
              padding: "var(--sp-10) var(--sp-4)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--sp-3)",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 36 }} aria-hidden="true">🎈</span>
            <span style={{ fontWeight: 500, color: "var(--text-1)" }}>אין עדיין משאלות</span>
            <span className="muted" style={{ fontSize: 13 }}>
              כשהילדים יוסיפו משאלות, הן יופיעו כאן.
            </span>
          </section>
        ) : (
          <div style={{ display: "grid", gap: "var(--sp-4)" }}>
            {groups.map(([ownerUserId, ownerItems]) => {
              const member = memberById.get(ownerUserId);
              return (
                <section key={ownerUserId} className="card" style={{ padding: "var(--sp-5)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
                    <Avatar
                      memberId={ownerUserId}
                      displayName={member?.displayName}
                      colorKey={member?.color ?? null}
                      size="md"
                    />
                    <div style={{ fontWeight: 600 }}>{member?.displayName ?? "חבר משפחה"}</div>
                  </div>

                  <ul style={{ display: "grid", gap: "var(--sp-2)", listStyle: "none", padding: 0, margin: 0 }}>
                    {ownerItems.map((w) => {
                      const fulfilled = w.status === "fulfilled";
                      return (
                        <li
                          key={w.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--sp-3)",
                            padding: "var(--sp-3)",
                            borderRadius: "var(--r-2)",
                            background: "var(--cream-1)",
                            border: "1px solid var(--cream-3)",
                            opacity: fulfilled ? 0.6 : 1,
                          }}
                        >
                          <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "var(--text-1)" }}>
                            {w.priority === "high" && <span aria-hidden="true">⭐ </span>}
                            <span style={{ textDecoration: fulfilled ? "line-through" : "none" }}>{w.title}</span>
                            {typeof w.priceEst === "number" && (
                              <span className="mono muted" style={{ fontSize: 12, marginInlineStart: 6 }}>
                                ₪{w.priceEst.toLocaleString("he-IL")}
                              </span>
                            )}
                          </span>
                          {fulfilled ? (
                            <span className="status">נקנה ✓</span>
                          ) : (
                            <div style={{ display: "flex", gap: "var(--sp-2)", flexShrink: 0 }}>
                              <button
                                type="button"
                                className="btn sm primary"
                                onClick={() => fulfill(w.id)}
                                aria-label={`סמן כנקנה: ${w.title}`}
                              >
                                סמן כנקנה
                              </button>
                              <button
                                type="button"
                                className="btn sm ghost"
                                onClick={() => remove(w.id)}
                                aria-label={`הסר משאלה: ${w.title}`}
                              >
                                הסר
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
