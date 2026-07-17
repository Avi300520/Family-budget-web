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
};
type ShareAction = "bought" | "missing" | "restock" | "unbought";
type Phase = "loading" | "ready" | "invalid" | "error";

const POLL_BASE_MS = 3000;
const jitter = () => POLL_BASE_MS * (0.8 + Math.random() * 0.4); // ±20% so forwarded links don't phase-align

export function ShareList({ token }: { token: string }) {
  const base = apiBaseUrl();
  const [items, setItems] = useState<ShareItem[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
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
      const body = (await res.json()) as { version: number; items: ShareItem[] };
      versionRef.current = body.version;
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
    if (phase !== "ready") return;
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
  }, [phase, base, token, fetchList]);

  const act = useCallback((id: string, action: ShareAction, optimistic: (it: ShareItem) => ShareItem) => {
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
          body: JSON.stringify({ action }),
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

  const buy = (it: ShareItem) => act(it.id, "bought", (x) => ({ ...x, status: "purchased", outOfStock: false }));
  const undo = (it: ShareItem) => act(it.id, "unbought", (x) => ({ ...x, status: "active" }));
  const toggleMissing = (it: ShareItem) =>
    it.outOfStock ? act(it.id, "restock", (x) => ({ ...x, outOfStock: false }))
                  : act(it.id, "missing", (x) => ({ ...x, outOfStock: true }));

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

  const active = useMemo(() => items.filter((i) => i.status === "active"), [items]);
  const bought = useMemo(() => items.filter((i) => i.status === "purchased"), [items]);
  const groups = useMemo(() => {
    const buckets = new Map<ShoppingCategoryId, ShareItem[]>();
    for (const it of active) buckets.set(it.category, [...(buckets.get(it.category) ?? []), it]);
    return SHOPPING_CATEGORIES
      .filter((c) => buckets.has(c.id))
      .map((c) => ({ ...c, items: buckets.get(c.id)! }));
  }, [active]);

  if (phase === "loading") return <Centered>טוען רשימה…</Centered>;
  if (phase === "invalid") return <Centered>הקישור לרשימה אינו תקף או שפג תוקפו. בקשו קישור חדש מהבוט בוואטסאפ.</Centered>;
  if (phase === "error") return <Centered>לא הצלחנו לטעון את הרשימה. בדקו את החיבור ונסו שוב.</Centered>;

  return (
    <main style={S.page}>
      <header style={S.header}>
        <div style={S.title}>🛒 רשימת קניות</div>
        <div style={S.remain}>{active.length > 0 ? `נשאר ${active.length}` : "הכול נקנה 🎉"}</div>
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
          <div style={S.doneTitle}>🎉 כל הכבוד, סיימתם את הקנייה!</div>
          <div style={S.doneSub}>שלחו לבוט בוואטסאפ את הסכום ששילמתם ונוסיף אותו לתקציב.</div>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.id} style={S.section}>
          <div style={S.catHead}>{g.icon} {g.nameHe}</div>
          {g.items.map((it) => (
            <div key={it.id} style={S.row}>
              <button style={S.buyTap} onClick={() => buy(it)} aria-label={`סמן ${it.name} כנקנה`}>
                <span style={S.checkbox} aria-hidden />
                <span style={S.name}>
                  {it.name}
                  {it.quantity > 1 ? <span style={S.qty}> ×{it.quantity}</span> : null}
                  {it.outOfStock ? <span style={S.badge}>חסר במלאי</span> : null}
                </span>
              </button>
              <button
                style={{ ...S.missBtn, ...(it.outOfStock ? S.missBtnOn : null) }}
                onClick={() => toggleMissing(it)}
                aria-pressed={it.outOfStock}
              >
                חסר
              </button>
            </div>
          ))}
        </section>
      ))}

      {bought.length > 0 && (
        <section style={S.section}>
          <div style={S.catHead}>✅ נקנה ({bought.length})</div>
          {bought.map((it) => (
            <button key={it.id} style={{ ...S.row, ...S.boughtRow }} onClick={() => undo(it)} aria-label={`בטל קנייה של ${it.name}`}>
              <span style={S.checkboxDone} aria-hidden>✓</span>
              <span style={S.nameDone}>{it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ""}</span>
            </button>
          ))}
        </section>
      )}

      {active.length === 0 && bought.length === 0 && <Centered>הרשימה ריקה.</Centered>}

      {active.length > 0 && (
        <div style={S.footer}>
          <button style={S.finishBtn} onClick={finish} disabled={finishing} aria-label="סיימתי את הקנייה">
            {finishing ? "מסיים…" : "סיימתי את הקנייה ✓"}
          </button>
        </div>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={S.centered}>{children}</div>;
}

// Self-contained inline styles keyed to the app tokens (var(--…)) with hard fallbacks so the
// page renders correctly even standalone. Big tap targets (≥52px), safe-area bottom padding.
const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 560, margin: "0 auto", padding: "16px 14px calc(24px + env(safe-area-inset-bottom))", minHeight: "100dvh", background: "var(--cream-0, #FBF8F1)", color: "var(--text-0, #1A2330)" },
  header: { position: "sticky", top: 0, zIndex: 1, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "10px 4px 12px", background: "var(--cream-0, #FBF8F1)" },
  title: { fontSize: 20, fontWeight: 800 },
  remain: { fontSize: 15, fontWeight: 700, color: "var(--teal, #0F766E)" },
  section: { marginBottom: 14 },
  catHead: { fontSize: 13, fontWeight: 700, color: "var(--text-2, #7A8390)", padding: "6px 4px" },
  row: { display: "flex", alignItems: "stretch", gap: 8, marginBottom: 8, width: "100%" },
  buyTap: { flex: 1, display: "flex", alignItems: "center", gap: 12, minHeight: 54, padding: "0 14px", textAlign: "start", background: "var(--cream-2, #FFF)", border: "1px solid var(--cream-3, #ECE5D5)", borderRadius: 14, cursor: "pointer", font: "inherit", color: "inherit" },
  checkbox: { flexShrink: 0, width: 22, height: 22, borderRadius: 7, border: "2px solid var(--cream-3, #ECE5D5)" },
  name: { fontSize: 16, fontWeight: 600, lineHeight: 1.25 },
  qty: { color: "var(--text-2, #7A8390)", fontWeight: 700 },
  badge: { marginInlineStart: 8, fontSize: 11, fontWeight: 700, color: "#9A5B00", background: "#FBE7C6", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" },
  missBtn: { flexShrink: 0, minWidth: 60, minHeight: 54, borderRadius: 14, border: "1px solid var(--cream-3, #ECE5D5)", background: "var(--cream-2, #FFF)", color: "var(--text-2, #7A8390)", fontWeight: 700, cursor: "pointer" },
  missBtnOn: { background: "#FBE7C6", borderColor: "#F0D48A", color: "#9A5B00" },
  boughtRow: { minHeight: 48, alignItems: "center", gap: 12, padding: "0 14px", background: "transparent", border: "1px solid transparent", borderRadius: 14, cursor: "pointer", width: "100%", textAlign: "start", font: "inherit", color: "inherit" },
  checkboxDone: { flexShrink: 0, width: 22, height: 22, borderRadius: 7, background: "var(--pos, #2A8C5A)", color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800 },
  nameDone: { fontSize: 15, color: "var(--text-2, #7A8390)", textDecoration: "line-through" },
  toast: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 0 12px", padding: "10px 14px", background: "#FDECEC", border: "1px solid #F3C0C0", borderRadius: 12, color: "#8A1C1C", fontWeight: 600 },
  toastBtn: { flexShrink: 0, padding: "6px 12px", borderRadius: 10, border: "none", background: "#8A1C1C", color: "#fff", fontWeight: 700, cursor: "pointer" },
  doneBanner: { margin: "0 0 14px", padding: "14px 16px", background: "#E7F6EE", border: "1px solid #BFE6CE", borderRadius: 14, textAlign: "center" },
  doneTitle: { fontSize: 17, fontWeight: 800, color: "var(--pos, #2A8C5A)" },
  doneSub: { marginTop: 4, fontSize: 14, lineHeight: 1.4, color: "var(--text-1, #45505F)" },
  footer: { position: "sticky", bottom: 0, marginTop: 8, padding: "10px 0 calc(6px + env(safe-area-inset-bottom))", background: "linear-gradient(to top, var(--cream-0, #FBF8F1) 70%, transparent)" },
  finishBtn: { width: "100%", minHeight: 52, borderRadius: 14, border: "none", background: "var(--teal, #0F766E)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" },
  centered: { minHeight: "70dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", color: "var(--text-2, #7A8390)", fontSize: 16, lineHeight: 1.5 },
};
