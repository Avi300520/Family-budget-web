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

import { useEffect, useRef, useState } from "react";
import type { WishlistItem } from "@shopping-assistant/shared-types";
import { api } from "../lib/api";

/**
 * BATCH-GI 2.4.3 orphan guard for a post-await focus repair.
 *
 * `origin` is captured BEFORE the await - it is the control that was activated, and the one
 * React is about to unmount (a row's "הסר") or disable (the add button). React commits those
 * updates after this runs, so an `origin` that still holds focus is precisely the focus that
 * is about to fall to <body>: repairing it is the point. Any OTHER focused element means the
 * user Tabbed onward during the round-trip, and their focus must be left alone.
 */
function restoreFocus(origin: Element | null, target: HTMLElement | null): void {
  const ae = document.activeElement;
  if (ae && ae !== document.body && ae !== origin) return; // user moved on - leave their focus alone
  target?.focus();
}

export function WishlistPanel() {
  const [items, setItems] = useState<WishlistItem[]>();
  const [error, setError] = useState<string>();
  const [title, setTitle] = useState("");
  const [important, setImportant] = useState(false);
  const [busy, setBusy] = useState(false);
  // BATCH-GI 4.1.3: add + remove complete asynchronously with no visible
  // confirmation, so a polite region is the only cue a screen reader gets.
  const [notice, setNotice] = useState("");
  // BATCH-GI 2.4.3: both the add button (it disables itself once the field is
  // cleared) and each row's "הסר" button stop existing at the end of their own
  // activation. Focus returns here instead of falling to <body>.
  const inputRef = useRef<HTMLInputElement>(null);

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
    const origin = document.activeElement;
    setBusy(true);
    setError(undefined);
    // Blank-then-set across the await: writing the SAME string into a mounted live region is
    // not a DOM mutation, so adding two items with the same title would announce only once.
    setNotice("");
    try {
      const res = await api.createWishlistItem({
        title: trimmed,
        priority: important ? "high" : "normal",
      });
      setItems((prev) => [...(prev ?? []), res.item]);
      setTitle("");
      setImportant(false);
      // The item name is part of the message so the confirmation names what was added; the
      // re-announce of a repeated identical string is handled by the blank above, not by this.
      setNotice(`${trimmed} נוספה לרשימת המשאלות`);
      restoreFocus(origin, inputRef.current);
    } catch {
      setError("לא הצלחנו להוסיף את המשאלה. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(itemId: string) {
    const origin = document.activeElement;
    setError(undefined);
    // Same blank-then-set as add(): removing two items with the SAME title in a row would
    // otherwise write an identical string and stay silent.
    setNotice("");
    const removedTitle = (items ?? []).find((w) => w.id === itemId)?.title;
    try {
      await api.deleteWishlistItem(itemId);
      setItems((prev) => (prev ?? []).filter((w) => w.id !== itemId));
      setNotice(removedTitle ? `${removedTitle} הוסרה מרשימת המשאלות` : "המשאלה הוסרה");
      restoreFocus(origin, inputRef.current);
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
          ref={inputRef}
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
          {/* BATCH-GI 4.1.2: `busy` used to disable this button, so activating it
              dropped focus to <body> for the duration of the request. add() already
              guards re-entry with `if (!trimmed || busy) return`, so aria-busy can
              carry the state without removing the control from the focus order. */}
          <button
            type="button"
            className="button"
            onClick={add}
            aria-busy={busy}
            disabled={title.trim().length === 0}
          >
            {busy ? "מוסיף…" : "הוסף"}
          </button>
        </div>
      </div>

      {error && (
        <div className="status error" role="alert" style={{ marginBottom: "var(--sp-3)" }}>
          {error}
        </div>
      )}
      <span className="sr-only" role="status">{notice}</span>

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
        // The rows are display:flex, which strips the implicit list/listitem roles in
        // WebKit - the explicit roles keep the item count announced.
        <ul role="list" style={{ display: "grid", gap: "var(--sp-2)", listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((w) => {
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
                  border: "1px solid var(--cream-3)",
                }}
              >
                {/* 1.4.3: the row used to carry opacity .6 when fulfilled, which
                    composites the text toward the background and drops it below the
                    AA floor. The "done" state is now a token colour on the text plus
                    the existing line-through. */}
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: fulfilled ? "var(--text-2)" : "var(--text-1)" }}>
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
