"use client";

/**
 * WishlistPanel - Iteration 8 ChildView surface.
 *
 * A member's OWN wishlist. Self-contained: loads api.myWishlist(), supports
 * add + soft-delete of the caller's own items. It NEVER shows or targets
 * another member's items - the server only ever returns the caller's rows on
 * /wishlist/me, and there is no cross-user control here by construction.
 *
 * Mark-fulfilled is intentionally absent: that is an owner/admin-only action
 * exposed on the parent /family/wishlists route, not here.
 *
 * Reuses existing primitives (.card, .input, .button, .muted, .h3) - no new
 * CSS tokens. All Hebrew copy is in logical order in source.
 */

import { useEffect, useState } from "react";
import type { WishlistItem } from "@shopping-assistant/shared-types";
import { api } from "../lib/api";

export function WishlistPanel() {
  const [items, setItems] = useState<WishlistItem[]>();
  const [error, setError] = useState<string>();
  const [title, setTitle] = useState("");
  const [important, setImportant] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .myWishlist()
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch(() => {
        if (!cancelled) setError("לא הצלחנו לטעון את המשאלות. נסו לרענן.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function add() {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await api.createWishlistItem({
        title: trimmed,
        priority: important ? "high" : "normal",
      });
      setItems((prev) => [...(prev ?? []), res.item]);
      setTitle("");
      setImportant(false);
    } catch {
      setError("לא הצלחנו להוסיף את המשאלה. נסו שוב.");
    } finally {
      setBusy(false);
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
    <section className="card" style={{ padding: "var(--sp-6)" }}>
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <h3 className="h3">המשאלות שלי 🎁</h3>
        <div className="muted" style={{ fontSize: 13, marginTop: "var(--sp-1)" }}>
          דברים שהייתי רוצה - ההורים יראו את הרשימה.
        </div>
      </div>

      {/* Add form */}
      <div className="form" style={{ marginBottom: "var(--sp-4)" }}>
        <input
          className="input"
          value={title}
          maxLength={120}
          placeholder="מה היית רוצה? (אופניים, משחק…)"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          aria-label="משאלה חדשה"
        />
        <div className="row between" style={{ marginTop: "var(--sp-2)" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)", fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={important}
              onChange={(e) => setImportant(e.target.checked)}
            />
            ⭐ חשוב לי
          </label>
          <button
            type="button"
            className="button"
            onClick={add}
            disabled={busy || title.trim().length === 0}
          >
            {busy ? "מוסיף…" : "הוסף"}
          </button>
        </div>
      </div>

      {error && (
        <div className="status error" style={{ marginBottom: "var(--sp-3)" }}>
          {error}
        </div>
      )}

      {/* Items */}
      {items === undefined ? (
        <div className="muted" style={{ padding: "var(--sp-5) 0", textAlign: "center", fontSize: 13 }}>
          טוען…
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--sp-8) var(--sp-4)",
            gap: "var(--sp-2)",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 32 }} aria-hidden="true">🌟</span>
          <span style={{ fontWeight: 500, color: "var(--text-1)" }}>רשימת המשאלות שלך ריקה</span>
          <span className="muted" style={{ fontSize: 13 }}>
            כתבו כאן דבר שהייתם רוצים, וההורים יראו את זה.
          </span>
        </div>
      ) : (
        <ul style={{ display: "grid", gap: "var(--sp-2)", listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((w) => {
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
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => remove(w.id)}
                    aria-label={`הסר משאלה: ${w.title}`}
                  >
                    הסר
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
