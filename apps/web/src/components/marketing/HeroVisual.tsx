// Hero visual: "message in -> dashboard out". Pure presentational server
// component. These are STATIC illustrative marketing mocks (fictional round
// numbers, the "פינג" assistant persona) - NOT wired to live data or the real
// 7-category backend enum. Device-chrome / WhatsApp-green hex values are
// intentional brand/channel colours, not design tokens.

import { PingtallyMark } from "./PingtallyMark";

const WA_GREEN = "#25D366";
// a11y (BATCH-GH, 1.4.3): the brand green is 1.98:1 on white, so it can tint a
// decorative dot but never carry text. 10.5px copy uses the deep variant (5.42:1).
const WA_GREEN_TEXT = "#0E7A40";

function DashboardCard() {
  const cats = [
    { icon: "🛒", name: "סופר ומזון", spent: 4280, budget: 5000, color: "var(--teal)" },
    { icon: "🍕", name: "אוכל בחוץ", spent: 1180, budget: 900, color: "var(--coral)", over: true },
    { icon: "🎨", name: "ילדים וחוגים", spent: 1840, budget: 2000, color: "var(--mustard)" },
  ];
  return (
    <div style={{ width: "100%", background: "var(--cream-2)", borderRadius: "var(--r-5)", border: "1px solid var(--cream-3)", boxShadow: "var(--elev-3)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--cream-3)", background: "var(--cream-1)" }}>
        <PingtallyMark size={24} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>Pingtally</div>
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>· משפחת לוי</div>
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 6 }}>
          {["var(--m-mom)", "var(--m-dad)", "var(--m-teen)"].map((c, i) => (
            <span key={i} style={{ width: 22, height: 22, borderRadius: 999, background: c, border: "2px solid var(--cream-2)", marginInlineStart: i ? -8 : 0 }} />
          ))}
        </div>
      </div>
      <div style={{ padding: 18, display: "grid", gap: 16 }}>
        <div style={{ borderRadius: "var(--r-4)", padding: 18, color: "#FFF", background: "linear-gradient(135deg, var(--teal-deep) 0%, var(--teal) 70%)", position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>הוצאתם החודש</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <span className="mono" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>₪5,240</span>
            <span style={{ fontSize: 12, opacity: 0.8 }}>מתוך ₪8,000</span>
          </div>
          <div style={{ height: 7, background: "rgba(255,255,255,0.2)", borderRadius: 999, marginTop: 12, overflow: "hidden", position: "relative" }}>
            <div style={{ width: "65%", height: "100%", background: "#FFF", borderRadius: 999 }} />
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.18)", fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#A7E8C0" }} /> בקצב טוב · נשארו ₪2,760
          </span>
        </div>
        <div style={{ display: "grid", gap: 11 }}>
          {cats.map((c, i) => {
            const pct = Math.min(100, (c.spent / c.budget) * 100);
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 10, alignItems: "center" }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, fontSize: 14, background: `color-mix(in oklab, ${c.color} 12%, var(--cream-2))`, display: "grid", placeItems: "center" }}>{c.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                    <span className="mono" style={{ color: c.over ? "var(--neg)" : "var(--text-2)" }}>
                      ₪{c.spent.toLocaleString("he-IL")}<span style={{ color: "var(--text-3)" }}> / {c.budget.toLocaleString("he-IL")}</span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: "var(--cream-3)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: c.over ? "var(--neg)" : c.color, borderRadius: 999 }} />
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: c.over ? "var(--neg)" : "var(--text-2)", minWidth: 30, textAlign: "end" }}>
                  {Math.round((c.spent / c.budget) * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Bubble({ sent = false, children }: { sent?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: sent ? "flex-start" : "flex-end", marginBottom: 5 }}>
      <div style={{
        maxWidth: "86%", background: sent ? "#DCF8C6" : "#FFFFFF", borderRadius: 9,
        borderTopRightRadius: sent ? 9 : 2, borderTopLeftRadius: sent ? 2 : 9,
        padding: "7px 10px", fontSize: 12.5, lineHeight: 1.4, color: "#1D1F1E",
        boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
      }}>{children}</div>
    </div>
  );
}

function PhoneCard() {
  const groups = [
    { emoji: "🥦", name: "פירות וירקות", items: ["אבוקדו"] },
    { emoji: "🥛", name: "מוצרי חלב וקירור", items: ["חלב x2"] },
    { emoji: "🌽", name: "מזווה / יבשים", items: ["אורז פרסי"] },
    { emoji: "👶", name: "תינוקות וילדים", items: ["שמפו לילדים"] },
  ];
  return (
    <div style={{ width: 264, borderRadius: 30, background: "#0F1411", padding: 7, boxShadow: "var(--elev-3), 0 24px 48px rgba(15,42,40,0.28)" }}>
      <div style={{ borderRadius: 24, overflow: "hidden", background: "#E5DDD5", position: "relative" }}>
        <div style={{ position: "absolute", top: 8, insetInlineStart: "50%", transform: "translateX(-50%)", width: 84, height: 20, background: "#0F1411", borderRadius: 999, zIndex: 2 }} />
        <div style={{ background: "#F6F6F6", padding: "26px 12px 8px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: "var(--teal)", display: "grid", placeItems: "center", color: "#FFF", fontWeight: 800, fontSize: 14 }}>פ</div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#000" }}>פינג</div>
            <div style={{ fontSize: 10.5, color: WA_GREEN_TEXT }}>מקליד…</div>
          </div>
        </div>
        <div style={{ padding: "11px 9px 13px", backgroundImage: "radial-gradient(circle at 10% 20%, rgba(255,255,255,0.4) 1px, transparent 1px), radial-gradient(circle at 80% 50%, rgba(0,0,0,0.04) 1px, transparent 1px)", backgroundSize: "50px 50px, 70px 70px" }}>
          <Bubble sent>קפה בארומה 18</Bubble>
          <Bubble>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, minWidth: 178 }}>
              <div>✅ נרשם: <strong>18 ש&quot;ח בארומה</strong> (מסעדות וקפה).</div>
              <div style={{ marginTop: 3 }}>💰 נשארו <strong>2,760 ש&quot;ח</strong> לתקציב החודשי.</div>
              <div style={{ marginTop: 4, color: "#667781" }}>אפשר גם לשלוח קבלה, ואשמור אותה עם ההוצאה.</div>
            </div>
          </Bubble>
          <Bubble sent>2 חלב, אורז פרסי, שמפו לילדים, אבוקדו</Bubble>
          <Bubble>
            <div style={{ fontSize: 12.5, lineHeight: 1.45, minWidth: 188 }}>
              <div style={{ fontWeight: 700, marginBottom: 7 }}>🛒 הוספתי 4 פריטים:</div>
              {groups.map((c, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, color: "#0B5C56" }}>{c.emoji} {c.name}:</div>
                  {c.items.map((it, j) => (<div key={j} style={{ color: "#1D1F1E" }}>• {it}</div>))}
                </div>
              ))}
            </div>
          </Bubble>
        </div>
      </div>
    </div>
  );
}

export function HeroVisual() {
  return (
    // a11y (P2-4, WCAG 1.1.1): this whole block is a DECORATIVE illustration of
    // the product. Its numbers (5,240 / 8,000 / 2,760), category rows and chat
    // bubbles are fictional marketing mocks, so exposing them would read to a
    // screen-reader user as if they were that user's real financial data. The
    // hero's <h1> + lead paragraph already carry the equivalent information in
    // text. Nothing inside is focusable (no a/button/input/tabindex), so
    // aria-hidden here cannot hide an interactive element.
    <div style={{ width: "100%", paddingTop: 8 }} aria-hidden="true">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px", minWidth: 240, maxWidth: 340, position: "relative" }}>
          <div style={{ position: "absolute", top: -13, insetInlineEnd: 14, zIndex: 3, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, background: "var(--ink-0)", color: "var(--on-dark-0)", fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 999, boxShadow: "var(--elev-2)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: WA_GREEN }} />
            מה שכתבתם, מסודר כאן
          </div>
          <div style={{ paddingTop: 16 }}><DashboardCard /></div>
        </div>
        <div style={{ flexShrink: 0 }}><PhoneCard /></div>
      </div>
    </div>
  );
}
