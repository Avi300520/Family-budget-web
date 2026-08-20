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

import { MessageCircle, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { HouseholdMember, WishlistItem } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { Avatar } from "../../../components/Avatar";
import { LoadState } from "../../../components/LoadState";
import { activeChildren } from "../../../lib/roster";
import { api } from "../../../lib/api";

type MemberLite = HouseholdMember & { displayName?: string; phoneE164?: string };

export default function FamilyWishlistsPage() {
  const [items, setItems] = useState<WishlistItem[]>();
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [isParent, setIsParent] = useState<boolean>();
  const [error, setError] = useState<string>();

  // Manual-add (empty-state): a parent adds a wish on behalf of a child.
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addChildId, setAddChildId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string>();
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [savingPriceId, setSavingPriceId] = useState<string>();

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
          api.householdWishlistGoals(me.household.id),
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

  async function contribute(item: WishlistItem) {
    const raw = window.prompt(`כמה להוסיף ל„${item.title}“?`);
    if (!raw) return;
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw.trim()) || Number(raw.replace(",", ".")) <= 0 || Number(raw.replace(",", ".")) > 10_000_000) {
      setError("נא להזין סכום חיובי עם עד שתי ספרות אחרי הנקודה.");
      return;
    }
    const amount = Number(raw.replace(",", "."));
    try {
      const result = await api.contributeToWishlist(item.id, amount, crypto.randomUUID());
      setItems((previous) => (previous ?? []).map((current) => current.id === item.id ? result.item : current));
    } catch {
      setError("לא הצלחנו להוסיף תרומה. נסו שוב.");
    }
  }

  async function savePrice(item: WishlistItem) {
    const raw = priceDrafts[item.id]?.trim() ?? "";
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw) || Number(raw.replace(",", ".")) <= 0 || Number(raw.replace(",", ".")) > 10_000_000) {
      setError("נא להזין מחיר חיובי בש״ח, עם עד שתי ספרות אחרי הנקודה.");
      return;
    }
    setSavingPriceId(item.id);
    setError(undefined);
    try {
      const res = await api.updateWishlistItem(item.id, { priceEst: Number(raw.replace(",", ".")) });
      setItems((previous) => (previous ?? []).map((current) => current.id === item.id ? res.item : current));
      setPriceDrafts((previous) => {
        const next = { ...previous };
        delete next[item.id];
        return next;
      });
    } catch {
      setError("לא הצלחנו לעדכן את המחיר. נסו שוב.");
    } finally {
      setSavingPriceId(undefined);
    }
  }

  // Children eligible to own a wish (the wishlist is a limited_member surface). A
  // removed member must not be offered - role alone is not enough.
  const children = useMemo(() => activeChildren(members), [members]);

  function toggleAdd() {
    setAddError(undefined);
    setShowAdd((prev) => {
      const next = !prev;
      if (next && !addChildId) setAddChildId(children[0]?.userId ?? "");
      return next;
    });
  }

  async function addManual() {
    const trimmed = addTitle.trim();
    const childId = addChildId || children[0]?.userId;
    if (!trimmed || !childId || adding) return;
    setAdding(true);
    setAddError(undefined);
    try {
      // ownerUserId targets the child; the created item is owned by them and
      // surfaces in their group on the next render.
      const res = await api.createWishlistItem({ title: trimmed, ownerUserId: childId });
      setItems((prev) => [...(prev ?? []), res.item]);
      setAddTitle("");
      setShowAdd(false);
    } catch {
      setAddError("לא הצלחנו להוסיף את המשאלה. נסו שוב.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <AppShell>
      <div style={{ display: "grid", gap: "var(--sp-5)", maxWidth: 720 }}>
        <header style={{ display: "grid", gap: "var(--sp-2)" }}>
          <h1 className="h1">משאלות 🎁</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            משאלות של בני המשפחה, עם התקדמות החיסכון. סמנו כנקנה אחרי שקניתם.
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
            style={{ padding: "var(--sp-10) var(--sp-6)", textAlign: "center" }}
          >
            <div style={{ fontSize: 46, marginBottom: "var(--sp-3)" }} aria-hidden="true">🎈</div>
            <div style={{ fontWeight: 700, fontSize: 19, marginBottom: "var(--sp-2)" }}>אין עדיין משאלות</div>
            <p
              className="muted"
              style={{ margin: "0 auto", maxWidth: 360, fontSize: 14, lineHeight: 1.6 }}
            >
              {'כשהילדים ישלחו משאלה בוואטסאפ - למשל "אני רוצה אוזניות 🎧" - היא תופיע כאן, ותוכלו לאשר ולקנות.'}
            </p>

            <div
              style={{
                display: "flex",
                gap: "var(--sp-3)",
                justifyContent: "center",
                flexWrap: "wrap",
                marginTop: "var(--sp-5)",
              }}
            >
              <a
                className="btn primary"
                href="/settings/members"
                style={{ textDecoration: "none" }}
              >
                <MessageCircle size={18} aria-hidden />
                הזמינו את הילדים
              </a>
              <button
                type="button"
                className="btn"
                onClick={toggleAdd}
                aria-expanded={showAdd}
              >
                <Plus size={17} aria-hidden />
                הוספת משאלה ידנית
              </button>
            </div>

            {showAdd && (
              <div
                style={{
                  marginTop: "var(--sp-4)",
                  display: "grid",
                  gap: "var(--sp-3)",
                  textAlign: "start",
                  maxWidth: 420,
                  marginInline: "auto",
                  width: "100%",
                }}
              >
                {children.length === 0 ? (
                  <div className="muted" style={{ fontSize: 13 }}>
                    כדי להוסיף משאלה ידנית צריך קודם להוסיף ילד בהגדרות החברים.
                  </div>
                ) : (
                  <>
                    <label style={{ display: "grid", gap: "var(--sp-1)" }}>
                      <span className="label">בשביל מי</span>
                      <select
                        className="select"
                        value={addChildId}
                        onChange={(e) => setAddChildId(e.target.value)}
                        aria-label="בחירת ילד"
                      >
                        {children.map((c) => (
                          <option key={c.userId} value={c.userId}>
                            {c.displayName ?? "חבר משפחה"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: "var(--sp-1)" }}>
                      <span className="label">המשאלה</span>
                      <input
                        className="input"
                        value={addTitle}
                        maxLength={120}
                        placeholder="למשל: אוזניות 🎧"
                        onChange={(e) => setAddTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addManual();
                        }}
                        aria-label="כותרת המשאלה"
                      />
                    </label>
                    {addError && (
                      <div className="status error" style={{ fontSize: 13 }}>
                        {addError}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "flex-end" }}>
                      <button type="button" className="btn sm ghost" onClick={() => setShowAdd(false)}>
                        ביטול
                      </button>
                      <button
                        type="button"
                        className="btn sm primary"
                        onClick={addManual}
                        disabled={adding || addTitle.trim().length === 0}
                      >
                        {adding ? "מוסיף…" : "הוספה"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div
              style={{
                marginTop: "var(--sp-7)",
                paddingTop: "var(--sp-5)",
                borderTop: "1px solid var(--cream-3)",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "var(--sp-4)",
                textAlign: "start",
              }}
            >
              {[
                ["📩", "הילד שולח", "מבקש בוואטסאפ מה שהוא רוצה"],
                ["✅", "אתם מאשרים", "רואים את הבקשה ומחליטים"],
                ["🎁", "קונים", "מסמנים כנקנה כשהגיע"],
              ].map(([emoji, title, sub]) => (
                <div key={title}>
                  <div style={{ fontSize: 22, marginBottom: "var(--sp-1)" }} aria-hidden="true">{emoji}</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
                </div>
              ))}
            </div>
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

                  {/* role="list"/"listitem" restore the semantics WebKit drops on a
                      list-style:none <ul> whose <li> are display:flex (1.3.1). */}
                  <ul role="list" style={{ display: "grid", gap: "var(--sp-2)", listStyle: "none", padding: 0, margin: 0 }}>
                    {ownerItems.map((w) => {
                      const fulfilled = w.status === "fulfilled";
                      return (
                        <li
                          key={w.id}
                          role="listitem"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--sp-3)",
                            padding: "var(--sp-3)",
                            borderRadius: "var(--r-2)",
                            background: "var(--cream-1)",
                            // No opacity on a fulfilled row: it composites the text
                            // toward the background and breaks 1.4.3. The
                            // line-through + "נקנה ✓" status already carry the state.
                            border: "1px solid var(--cream-3)",
                          }}
                        >
                          {/* De-emphasis for a fulfilled row is a token step on the
                              text (--text-2, still AA), never opacity. */}
                          <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: fulfilled ? "var(--text-2)" : "var(--text-1)" }}>
                            {w.priority === "high" && <span aria-hidden="true">⭐ </span>}
                            <span style={{ textDecoration: fulfilled ? "line-through" : "none" }}>{w.title}</span>
                            {typeof w.priceEst === "number" && (
                              <span className="mono muted" style={{ fontSize: 12, marginInlineStart: 6 }}>
                                ₪{w.priceEst.toLocaleString("he-IL")}
                              </span>
                            )}
                            {typeof w.priceEst === "number" && (
                              <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 4 }}>
                                נחסכו {(w.totalContributed ?? 0).toLocaleString("he-IL")} מתוך {w.priceEst.toLocaleString("he-IL")} ₪ ({w.fundedPercentage ?? 0}%)
                              </span>
                            )}
                            {typeof w.priceEst !== "number" && !fulfilled && (
                              <div
                                style={{ display: "grid", gap: "var(--sp-2)", marginTop: "var(--sp-3)", maxWidth: 360 }}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                                  אני מבין שרוצים „{w.title}“. כמה זה עולה בערך?
                                </span>
                                <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", flexWrap: "wrap" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span className="sr-only">מחיר משוער עבור {w.title}</span>
                                    <input
                                      className="input"
                                      inputMode="decimal"
                                      placeholder="למשל 250"
                                      value={priceDrafts[w.id] ?? ""}
                                      onChange={(event) => setPriceDrafts((previous) => ({ ...previous, [w.id]: event.target.value }))}
                                      onKeyDown={(event) => { if (event.key === "Enter") void savePrice(w); }}
                                      style={{ width: 132 }}
                                    />
                                    <span className="muted" style={{ fontSize: 12 }}>₪</span>
                                  </label>
                                  <button
                                    type="button"
                                    className="btn sm"
                                    disabled={savingPriceId === w.id || !(priceDrafts[w.id]?.trim())}
                                    onClick={() => void savePrice(w)}
                                  >
                                    {savingPriceId === w.id ? "שומר…" : "עדכון מחיר"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          {fulfilled ? (
                            <span className="status">נקנה ✓</span>
                          ) : (
                            <div style={{ display: "flex", gap: "var(--sp-2)", flexShrink: 0 }}>
                              {typeof w.priceEst === "number" && (
                                <button type="button" className="btn sm" onClick={() => contribute(w)}>
                                  תרומה
                                </button>
                              )}
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
