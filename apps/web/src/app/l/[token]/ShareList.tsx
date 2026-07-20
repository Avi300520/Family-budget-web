"use client";

// BATCH-BB — the no-login, in-store "shopping mode" list. Chrome-free (no AppShell),
// mobile-first, he-only, RTL (inherited from the root <html dir="rtl">). Talks ONLY to the
// public token-scoped /l/:token endpoints via plain fetch (no session singleton, no cookie).
//
// Design (SHOPPING_MODE_WEB_DESIGN.md §2.5): grouped by category, big tap targets, a "נשאר X"
// count, tap→bought (strike + sink to "נקנה" + re-tap undo), a "חסר" badge that keeps the item
// active, optimistic UI with PER-ITEM pending merge (a poll refetch must skip in-flight items,
// not blind-replace), a surfaced POST failure, and a ~3s ±20% jittered version poll paused on a
// hidden tab. The three flag-gated endpoints 404 when the feature is dormant.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SHOPPING_CATEGORIES, shoppingCategoryMeta, type ShoppingCategoryId } from "@shopping-assistant/shared-types";
import { apiBaseUrl } from "../../../lib/apiBase";

type ShareItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: ShoppingCategoryId;
  status: "active" | "purchased" | "removed";
  outOfStock: boolean;
  // BATCH-FF: how many of `quantity` were taken so far (null = not partially set). Drives the
  // "bought X of Y" stepper; survives a poll refetch because it's part of the server projection.
  quantityBought: number | null;
};
type ShareAction = "bought" | "missing" | "restock" | "unbought" | "partial";
type Phase = "loading" | "ready" | "invalid" | "error";

const POLL_BASE_MS = 3000;
const jitter = () => POLL_BASE_MS * (0.8 + Math.random() * 0.4); // ±20% so forwarded links don't phase-align

export function ShareList({ token }: { token: string }) {
  const base = apiBaseUrl();
  const [items, setItems] = useState<ShareItem[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  // BATCH-FF: the trip has been completed (server completion_fired_at set) → the list is LOCKED:
  // rendered read-only, polling stops, no write is sent. Derived from the GET response only.
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState<{ id: string; action: ShareAction; optimistic: (it: ShareItem) => ShareItem } | null>(null);
  // Items with an in-flight local mutation — a poll refetch keeps the LOCAL copy for these
  // (R12: never blind-replace an un-acked tap). A ref so the poll closure reads the live set.
  const pendingRef = useRef<Set<string>>(new Set());
  const versionRef = useRef<number>(-1);
  const [, forceRender] = useState(0);

  const mergeServer = useCallback((serverItems: ShareItem[]) => {
    setItems((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      return serverItems.map((si) => (pendingRef.current.has(si.id) ? byId.get(si.id) ?? si : si));
    });
  }, []);

  const fetchList = useCallback(async (): Promise<"ok" | "invalid" | "error"> => {
    try {
      const res = await fetch(`${base}/l/${token}`, { cache: "no-store" });
      if (res.status === 404) return "invalid";
      if (!res.ok) return "error";
      const body = (await res.json()) as { version: number; items: ShareItem[]; completed?: boolean };
      versionRef.current = body.version;
      setCompleted(body.completed === true);
      mergeServer(body.items);
      return "ok";
    } catch {
      return "error";
    }
  }, [base, token, mergeServer]);

  // Initial load.
  useEffect(() => {
    let alive = true;
    fetchList().then((r) => {
      if (!alive) return;
      setPhase(r === "ok" ? "ready" : r === "invalid" ? "invalid" : "error");
    });
    return () => { alive = false; };
  }, [fetchList]);

  // Version poll — recursive setTimeout for per-tick jitter, paused on a hidden tab, plus an
  // immediate check when the tab becomes visible again.
  useEffect(() => {
    if (phase !== "ready" || completed) return; // BATCH-FF: a locked (completed) list never changes
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;

    const tick = async () => {
      if (!alive) return;
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        try {
          const res = await fetch(`${base}/l/${token}/version`, { cache: "no-store" });
          if (res.ok) {
            const { version } = (await res.json()) as { version: number };
            if (version !== versionRef.current) await fetchList();
          }
        } catch { /* transient — keep the current view, retry next tick */ }
      }
      if (alive) timer = setTimeout(tick, jitter());
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    timer = setTimeout(tick, jitter());
    return () => { alive = false; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [phase, completed, base, token, fetchList]);

  const act = useCallback((id: string, action: ShareAction, optimistic: (it: ShareItem) => ShareItem, quantityBought?: number) => {
    setFailed((f) => (f?.id === id ? null : f));
    setItems((prev) => prev.map((it) => (it.id === id ? optimistic(it) : it)));
    pendingRef.current.add(id);
    forceRender((n) => n + 1);
    (async () => {
      let ok = false;
      try {
        const res = await fetch(`${base}/l/${token}/items/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quantityBought === undefined ? { action } : { action, quantityBought }),
        });
        ok = res.ok;
      } catch { ok = false; }
      pendingRef.current.delete(id);
      if (ok) {
        // Trust the server's post-write version so the next poll doesn't refetch needlessly.
        await fetchList();
      } else {
        setFailed({ id, action, optimistic });
        await fetchList(); // now un-pending → the optimistic change reverts to server truth
      }
      forceRender((n) => n + 1);
    })();
  }, [base, token, fetchList]);

  const buy = (it: ShareItem) => act(it.id, "bought", (x) => ({ ...x, status: "purchased", outOfStock: false, quantityBought: null }));
  const undo = (it: ShareItem) => act(it.id, "unbought", (x) => ({ ...x, status: "active", quantityBought: null }));
  const toggleMissing = (it: ShareItem) =>
    it.outOfStock ? act(it.id, "restock", (x) => ({ ...x, outOfStock: false }))
                  : act(it.id, "missing", (x) => ({ ...x, outOfStock: true, quantityBought: null }));

  // BATCH-FF — partial "bought X of Y" stepper (multi-qty items only). One control drives all
  // three ends: 0 → back to untouched (unbought), full Y → bought (sinks to נקנה), 0<X<Y →
  // partial (stays active; the shortfall carries to next trip at completion). Clamped to [0, Y].
  const setPartial = (it: ShareItem, next: number) => {
    const v = Math.max(0, Math.min(next, it.quantity));
    if (v === 0) return act(it.id, "unbought", (x) => ({ ...x, status: "active", quantityBought: null }));
    if (v >= it.quantity) return buy(it);
    act(it.id, "partial", (x) => ({ ...x, status: "active", outOfStock: false, quantityBought: v }), v);
  };

  // BATCH-DD — explicit "I'm done shopping" (closes out any items still on the list and, when
  // the backend feature is armed, nudges the amount in WhatsApp). Best-effort: the endpoint 404s
  // when the feature is dormant — we just refetch; the "done" state below is derived from the list.
  const [finishing, setFinishing] = useState(false);
  const finish = useCallback(() => {
    if (finishing) return;
    setFinishing(true);
    (async () => {
      try {
        await fetch(`${base}/l/${token}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      } catch { /* best-effort — the poll + list truth reconcile the view */ }
      await fetchList();
      setFinishing(false);
    })();
  }, [base, token, fetchList, finishing]);

  // BATCH-GH 2.4.3 (Focus Order) — tapping "bought" moves the item out of `active` and
  // re-renders it as a different control inside the נקנה section, so React unmounts the
  // element that currently has focus and focus falls to <body>: a keyboard or screen-reader
  // user loses their place in the list every single time they tick something off. We record
  // which item was acted on and re-attach focus to that item's control after the re-render.
  // Deliberately NO change to act/buy/undo/setPartial — this only observes and restores.
  const refocusIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = refocusIdRef.current;
    if (!id) return;
    refocusIdRef.current = null;
    // Only step in if the activation actually orphaned focus. If the user has already
    // moved on (or is using a pointer), leave their focus exactly where they put it.
    const ae = document.activeElement;
    if (ae && ae !== document.body) return;
    document.querySelector<HTMLElement>(`[data-share-item="${CSS.escape(id)}"]`)?.focus();
  }, [items]);

  const active = useMemo(() => items.filter((i) => i.status === "active"), [items]);
  const bought = useMemo(() => items.filter((i) => i.status === "purchased"), [items]);
  const groups = useMemo(() => {
    const buckets = new Map<ShoppingCategoryId, ShareItem[]>();
    for (const it of active) buckets.set(it.category, [...(buckets.get(it.category) ?? []), it]);
    return SHOPPING_CATEGORIES
      .filter((c) => buckets.has(c.id))
      .map((c) => ({ ...c, items: buckets.get(c.id)! }));
  }, [active]);

  // BATCH-GH (P1-4/P1-5/P2-7): the terminal states are the WHOLE page, so they need the same
  // <main> landmark + <h1> the ready view has (sr-only, so nothing moves), and the two failure
  // states mount fresh → role="alert" announces them.
  if (phase === "loading") return <Standalone role="status">טוען רשימה…</Standalone>;
  if (phase === "invalid") return <Standalone role="alert">הקישור לרשימה אינו תקף או שפג תוקפו. בקשו קישור חדש מהבוט בוואטסאפ.</Standalone>;
  if (phase === "error") return <Standalone role="alert">לא הצלחנו לטעון את הרשימה. בדקו את החיבור ונסו שוב.</Standalone>;

  // BATCH-FF — LOCKED (completed) view: read-only, no toggle / no missing / no finish button, so
  // a stale page can't un-check after the trip closed (the server also no-ops writes). Keep the
  // celebration; the kept-back (still-active) items show what carried to next time.
  if (completed) {
    return (
      <main id="main" style={S.page}>
        <header style={S.header}>
          <h1 style={S.title}><span aria-hidden>🛒</span> רשימת קניות</h1>
          <div style={S.remain} role="status" aria-live="polite">נסגר</div>
        </header>

        <div style={S.doneBanner}>
          <h2 style={S.doneTitle}><span aria-hidden>🎉</span> כל הכבוד, סיימתם את הקנייה!</h2>
          <div style={S.doneSub}>שלחו לבוט בוואטסאפ את הסכום ששילמתם ונוסיף אותו לתקציב.</div>
        </div>

        {active.length > 0 && (
          <section style={S.section}>
            <h2 style={S.catHead}>נשאר לפעם הבאה ({active.length})</h2>
            <ul role="list" style={S.list}>
              {active.map((it) => (
                <li key={it.id} role="listitem" style={{ ...S.row, ...S.lockedRow }}>
                  <span style={S.name}>
                    {it.name}
                    {it.quantity > 1 ? <Qty n={it.quantity} style={S.qty} /> : null}
                    {it.outOfStock ? <span style={S.badge}>חסר במלאי</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {bought.length > 0 && (
          <section style={S.section}>
            <h2 style={S.catHead}><span aria-hidden>✅</span> נקנה ({bought.length})</h2>
            <ul role="list" style={S.list}>
              {bought.map((it) => (
                <li key={it.id} role="listitem" style={{ ...S.row, ...S.boughtRow, ...S.lockedRow, cursor: "default" }}>
                  <span style={S.checkboxDone} aria-hidden>✓</span>
                  <span style={S.nameDone}>{it.name}{it.quantity > 1 ? <Qty n={it.quantity} /> : null}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div style={S.closedNotice}>הרשימה נסגרה. לרשימה חדשה שלחו לבוט &quot;תביא רשימה&quot;.</div>
      </main>
    );
  }

  return (
    <main id="main" style={S.page}>
      <header style={S.header}>
        <h1 style={S.title}><span aria-hidden>🛒</span> רשימת קניות</h1>
        {/* BATCH-GH (P2-7): a collaborator ticking an item off changes this counter via the ~3s
            poll with no other cue, so it is the page's own status region. The per-item stepper
            count keeps its own aria-live; the two never describe the same change. */}
        <div style={S.remain} role="status" aria-live="polite">
          {active.length > 0 ? `נשאר ${active.length}` : <>הכול נקנה <span aria-hidden>🎉</span></>}
        </div>
      </header>

      {failed && (
        <div style={S.toast} role="alert">
          <span>לא הצלחתי לעדכן פריט.</span>
          <button style={S.toastBtn} onClick={() => { const f = failed; setFailed(null); act(f.id, f.action, f.optimistic); }}>
            נסו שוב
          </button>
        </div>
      )}

      {active.length === 0 && bought.length > 0 && (
        <div style={S.doneBanner}>
          <h2 style={S.doneTitle}><span aria-hidden>🎉</span> כל הכבוד, סיימתם את הקנייה!</h2>
          <div style={S.doneSub}>שלחו לבוט בוואטסאפ את הסכום ששילמתם ונוסיף אותו לתקציב.</div>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.id} style={S.section}>
          <h2 style={S.catHead}><span aria-hidden>{g.icon}</span> {g.nameHe}</h2>
          <ul role="list" style={S.list}>
            {g.items.map((it) => (
              <li key={it.id} style={S.itemBlock}>
                <div style={S.row}>
                  {/* BATCH-GH (P1-6): NO aria-label here. An aria-label would override the inner
                      content, dropping the ×N quantity, the X/Y partial badge and the "חסר במלאי"
                      flag from the accessible name — and would silently desync from the visible
                      text on the next change. The visible content is made self-describing with
                      .sr-only words instead, so name and pixels can never drift apart. */}
                  <button
                    style={S.buyTap}
                    data-share-item={it.id}
                    onClick={() => { refocusIdRef.current = it.id; buy(it); }}
                  >
                    <span style={S.checkbox} aria-hidden />
                    <span style={S.name}>
                      <span className="sr-only">סמן </span>
                      {it.name}
                      {it.quantity > 1 ? <Qty n={it.quantity} style={S.qty} /> : null}
                      {it.quantityBought != null ? (
                        <span style={S.partialBadge}>
                          <span className="sr-only">נלקחו </span>
                          {it.quantityBought}
                          <span aria-hidden>/</span>
                          <span className="sr-only"> מתוך </span>
                          {it.quantity}
                        </span>
                      ) : null}
                      {it.outOfStock ? <span style={S.badge}>חסר במלאי</span> : null}
                      <span className="sr-only"> כנקנה</span>
                    </span>
                  </button>
                  <button
                    style={{ ...S.missBtn, ...(it.outOfStock ? S.missBtnOn : null) }}
                    onClick={() => toggleMissing(it)}
                    aria-pressed={it.outOfStock}
                  >
                    חסר<span className="sr-only"> במלאי - {it.name}</span>
                  </button>
                </div>
                {/* BATCH-FF — partial "how many did you take?" stepper, multi-qty items only. The
                    main tap above still means "bought all" (fast path); this records X of Y. */}
                {it.quantity > 1 && (
                  <div style={S.stepRow}>
                    <span style={S.stepLabel}>כמה לקחתם?</span>
                    <button style={S.stepBtn} onClick={() => setPartial(it, (it.quantityBought ?? 0) - 1)} aria-label={`הפחת כמות של ${it.name}`}>−</button>
                    <span style={S.stepCount} aria-live="polite">
                      {it.quantityBought ?? 0}<span aria-hidden> / </span><span className="sr-only"> מתוך </span>{it.quantity}
                    </span>
                    <button style={S.stepBtn} onClick={() => setPartial(it, (it.quantityBought ?? 0) + 1)} aria-label={`הוסף כמות של ${it.name}`}>+</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {bought.length > 0 && (
        <section style={S.section}>
          <h2 style={S.catHead}><span aria-hidden>✅</span> נקנה ({bought.length})</h2>
          <ul role="list" style={S.list}>
            {bought.map((it) => (
              <li key={it.id}>
                {/* Same P1-6 lens as the buy button: the old aria-label hid the ×N quantity. */}
                <button
                  style={{ ...S.row, ...S.boughtRow }}
                  data-share-item={it.id}
                  onClick={() => { refocusIdRef.current = it.id; undo(it); }}
                >
                  <span style={S.checkboxDone} aria-hidden>✓</span>
                  <span style={S.nameDone}>
                    <span className="sr-only">בטל קנייה של </span>
                    {it.name}
                    {it.quantity > 1 ? <Qty n={it.quantity} /> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {active.length === 0 && bought.length === 0 && <Centered>הרשימה ריקה.</Centered>}

      {active.length > 0 && (
        <div className="a11y-sticky-cta" style={S.footer}>
          {/* No aria-label: it duplicated the visible text and went stale while the button read
              "מסיים…". The visible text is the accessible name and stays in sync by construction. */}
          <button style={S.finishBtn} onClick={finish} disabled={finishing}>
            {finishing ? "מסיים…" : <>סיימתי את הקנייה <span aria-hidden>✓</span></>}
          </button>
        </div>
      )}
    </main>
  );
}

function Centered({ children, role }: { children: React.ReactNode; role?: "status" | "alert" }) {
  return <div style={S.centered} role={role}>{children}</div>;
}

// A terminal state (loading / invalid link / fetch error) IS the whole page, so it carries the
// same <main> landmark + <h1> as the ready view. The heading is .sr-only because the design has
// no visible title on these screens — zero pixels change.
function Standalone({ children, role }: { children: React.ReactNode; role?: "status" | "alert" }) {
  return (
    <main id="main">
      <h1 className="sr-only">רשימת קניות</h1>
      <Centered role={role}>{children}</Centered>
    </main>
  );
}

// BATCH-GH (P1-6/4.1.2) — the "×N" quantity suffix. "×" (U+00D7) is announced inconsistently
// (often silently) by screen readers, which would leave a bare number in the accessible name, so
// the glyph is aria-hidden and an .sr-only word carries the meaning. Renders the identical
// " ×3" glyph run: .sr-only is absolutely positioned and clipped, so it takes no space.
function Qty({ n, style }: { n: number; style?: React.CSSProperties }) {
  return (
    <span style={style}>
      <span aria-hidden> ×</span>
      <span className="sr-only"> כמות </span>
      {n}
    </span>
  );
}

// Self-contained inline styles keyed to the app tokens (var(--…)) with hard fallbacks so the
// page renders correctly even standalone. Big tap targets (≥52px), safe-area bottom padding.
//
// BATCH-GH accessibility notes for this map:
//  · Every `var(--x, #hex)` FALLBACK literal was raised to the post-BATCH-GH token value, since a
//    stale fallback is what actually paints if tokens.css ever fails to load. --text-2 #7A8390
//    (3.62:1 on cream-0) → #59626E (5.83 cream-0 / 6.18 white); --pos #2A8C5A → #1B6B43.
//  · Control BOUNDARIES (1.4.11, ≥3:1) use --field-border #9C8E6B (3.23 on #FFF / 3.05 on cream-0);
//    --cream-3 #ECE5D5 was 1.25:1 and on this page the border IS the only affordance.
//  · Headings carry `margin: 0` because there is no global h1/h2 reset — the UA default margin
//    and font-size would otherwise move pixels when a styled <div> became a real heading.
//  · Nothing here sets `outline: none`, so the global :focus-visible ring (globals.css) applies.
const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 560, margin: "0 auto", padding: "16px 14px calc(24px + env(safe-area-inset-bottom))", minHeight: "100dvh", background: "var(--cream-0, #FBF8F1)", color: "var(--text-0, #1A2330)" },
  header: { position: "sticky", top: 0, zIndex: 1, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "10px 4px 12px", background: "var(--cream-0, #FBF8F1)" },
  title: { margin: 0, fontSize: 20, fontWeight: 800 },
  remain: { fontSize: 15, fontWeight: 700, color: "var(--teal, #0F766E)" },
  section: { marginBottom: 14 },
  catHead: { margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-2, #59626E)", padding: "6px 4px" },
  // <ul role="list"> reset — the list semantics are for AT only, the box must not move.
  // NB: rows built on S.row carry an explicit role="listitem"; display:flex drops the
  // implicit listitem role in WebKit, which would make role="list" announce 0 items.
  list: { listStyle: "none", margin: 0, padding: 0 },
  itemBlock: { marginBottom: 8 },
  row: { display: "flex", alignItems: "stretch", gap: 8, width: "100%" },
  // a11y 1.4.3: no opacity here. Dimming the row diluted text against --cream-0
  // (nameDone 5.83 -> 4.16, the "חסר במלאי" badge 5.05 -> 3.81). The locked state
  // is already carried by the banner, the closed notice and the strike-through.
  lockedRow: { marginBottom: 8 },
  // BATCH-FF partial stepper — a compact secondary control under a multi-qty row.
  stepRow: { display: "flex", alignItems: "center", gap: 10, padding: "4px 14px 0", justifyContent: "flex-start" },
  stepLabel: { fontSize: 12.5, fontWeight: 600, color: "var(--text-2, #59626E)" },
  stepBtn: { width: 34, height: 34, borderRadius: 10, border: "1px solid var(--field-border, #9C8E6B)", background: "var(--cream-2, #FFF)", color: "var(--text-1, #45505F)", fontSize: 20, fontWeight: 800, lineHeight: 1, cursor: "pointer", display: "grid", placeItems: "center" },
  stepCount: { minWidth: 44, textAlign: "center", fontSize: 14, fontWeight: 700, color: "var(--text-1, #45505F)", fontVariantNumeric: "tabular-nums" },
  partialBadge: { marginInlineStart: 8, fontSize: 11, fontWeight: 800, color: "var(--teal, #0F766E)", background: "#DCF2EE", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  closedNotice: { margin: "6px 0 0", padding: "12px 14px", background: "var(--cream-2, #FFF)", border: "1px dashed var(--cream-3, #ECE5D5)", borderRadius: 12, textAlign: "center", fontSize: 14, lineHeight: 1.5, color: "var(--text-2, #59626E)" },
  buyTap: { flex: 1, display: "flex", alignItems: "center", gap: 12, minHeight: 54, padding: "0 14px", textAlign: "start", background: "var(--cream-2, #FFF)", border: "1px solid var(--field-border, #9C8E6B)", borderRadius: 14, cursor: "pointer", font: "inherit", color: "inherit" },
  checkbox: { flexShrink: 0, width: 22, height: 22, borderRadius: 7, border: "2px solid var(--field-border, #9C8E6B)" },
  name: { fontSize: 16, fontWeight: 600, lineHeight: 1.25 },
  qty: { color: "var(--text-2, #59626E)", fontWeight: 700 },
  badge: { marginInlineStart: 8, fontSize: 11, fontWeight: 700, color: "#8F5400", background: "#FBE7C6", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" },
  missBtn: { flexShrink: 0, minWidth: 60, minHeight: 54, borderRadius: 14, border: "1px solid var(--field-border, #9C8E6B)", background: "var(--cream-2, #FFF)", color: "var(--text-2, #59626E)", fontWeight: 700, cursor: "pointer" },
  // a11y 1.4.11: the old borderColor #F0D48A was 1.45:1 on the card - below the 3:1
  // UI-boundary floor for the PRESSED state. Inherit missBtn's --field-border (3.23:1).
  missBtnOn: { background: "#FBE7C6", color: "#8F5400" },
  boughtRow: { minHeight: 48, marginBottom: 8, alignItems: "center", gap: 12, padding: "0 14px", background: "transparent", border: "1px solid transparent", borderRadius: 14, cursor: "pointer", width: "100%", textAlign: "start", font: "inherit", color: "inherit" },
  checkboxDone: { flexShrink: 0, width: 22, height: 22, borderRadius: 7, background: "var(--pos, #1B6B43)", color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800 },
  nameDone: { fontSize: 15, color: "var(--text-2, #59626E)", textDecoration: "line-through" },
  toast: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 0 12px", padding: "10px 14px", background: "#FDECEC", border: "1px solid #F3C0C0", borderRadius: 12, color: "#8A1C1C", fontWeight: 600 },
  toastBtn: { flexShrink: 0, padding: "6px 12px", borderRadius: 10, border: "none", background: "#8A1C1C", color: "#fff", fontWeight: 700, cursor: "pointer" },
  doneBanner: { margin: "0 0 14px", padding: "14px 16px", background: "#E7F6EE", border: "1px solid #BFE6CE", borderRadius: 14, textAlign: "center" },
  doneTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: "var(--pos, #1B6B43)" },
  doneSub: { marginTop: 4, fontSize: 14, lineHeight: 1.4, color: "var(--text-1, #45505F)" },
  footer: { position: "sticky", bottom: 0, marginTop: 8, padding: "10px 0 calc(6px + env(safe-area-inset-bottom))", background: "linear-gradient(to top, var(--cream-0, #FBF8F1) 70%, transparent)" },
  finishBtn: { width: "100%", minHeight: 52, borderRadius: 14, border: "none", background: "var(--teal, #0F766E)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" },
  centered: { minHeight: "70dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", color: "var(--text-2, #59626E)", fontSize: 16, lineHeight: 1.5 },
};
