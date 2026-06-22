"use client";

// Onboarding wizard steps. Each step is a presentational component driven by the
// shared WizardState + a `set` updater from useOnboardingWizard. Hebrew, RTL,
// mobile-first; controls come from controls.tsx and reuse the site's tokens.

import { Plus, Trash2 } from "lucide-react";
import type { FrequencyId, ReportCatId, SubBudgetCatId, KidAgeBracket } from "@shopping-assistant/shared-types";
import {
  FIXED_PRESETS, REPORT_CATEGORIES, SUB_BUDGET_CATS, KID_AGE_BRACKETS,
  monthlyOf, autoSplitSubBudgets, suggestedManagedBudget,
  type WizardState, type WizardFixedExpense, type WizardTotals
} from "../../lib/onboarding/model";
import {
  Stepper, ChipSelect, OptionCards, MoneyInput, DayChips, FreqPick, Field, MiniToggle, TextInput
} from "./controls";

export interface StepProps {
  state: WizardState;
  set: (partial: Partial<WizardState>) => void;
  totals: WizardTotals;
}

const fmt = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;

function genId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `custom_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

// ── Welcome ─────────────────────────────────────────────────────────────────────
export function WelcomeStep({ state, set }: StepProps) {
  return (
    <OptionCards
      cols={1}
      value={state.mode}
      onChange={(id) => set({ mode: id as WizardState["mode"] })}
      options={[
        { id: "quick", emoji: "⚡", title: "מהיר", sub: "הבסיס בלבד — אפשר להשלים בהמשך" },
        { id: "precise", emoji: "🔍", title: "מדויק", sub: "שאלות נוספות לתמונה מלאה יותר" }
      ]}
    />
  );
}

// ── Profile ─────────────────────────────────────────────────────────────────────
export function ProfileStep({ state, set }: StepProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Field label="סוג הבית">
        <OptionCards
          cols={2}
          value={state.householdType}
          onChange={(id) => set({ householdType: id as WizardState["householdType"] })}
          options={[
            { id: "single", emoji: "🙋", title: "יחיד/ה" },
            { id: "couple", emoji: "💞", title: "זוג" },
            { id: "family", emoji: "👨‍👩‍👧", title: "משפחה" },
            { id: "roomies", emoji: "🏠", title: "שותפים" }
          ]}
        />
      </Field>

      <Field label="השם שלך">
        <TextInput value={state.displayName} onChange={(v) => set({ displayName: v })} placeholder="השם שלך" autoComplete="given-name" />
      </Field>
      <Field label="שם הבית">
        <TextInput value={state.householdName} onChange={(v) => set({ householdName: v })} placeholder="למשל: משפחת לוי" />
      </Field>
      <Field label="עיר / אזור">
        <TextInput value={state.city} onChange={(v) => set({ city: v })} placeholder="העיר או השכונה שלך" />
      </Field>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <Field label="מבוגרים">
          <Stepper value={state.adults} onChange={(v) => set({ adults: v })} min={1} max={12} />
        </Field>
        <Field label="ילדים">
          <Stepper value={state.kids} onChange={(v) => set({ kids: v })} min={0} max={12} />
        </Field>
        <Field label="רכבים">
          <Stepper value={state.cars} onChange={(v) => set({ cars: v })} min={0} max={6} />
        </Field>
      </div>

      {state.kids > 0 && (
        <Field label="גילאי הילדים" hint="אפשר לבחור כמה">
          <ChipSelect
            multi
            value={state.kidAges}
            onChange={(v) => set({ kidAges: v as KidAgeBracket[] })}
            options={KID_AGE_BRACKETS.map((b) => ({ id: b, label: b }))}
          />
        </Field>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 14 }}>
          <input type="checkbox" checked={state.acceptTerms} onChange={(e) => set({ acceptTerms: e.target.checked })} style={{ marginTop: 3 }} />
          <span>קראתי ואני מסכים/ה ל<a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)" }}>תנאי השימוש</a></span>
        </label>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 14 }}>
          <input type="checkbox" checked={state.acceptPrivacy} onChange={(e) => set({ acceptPrivacy: e.target.checked })} style={{ marginTop: 3 }} />
          <span>קראתי ואני מסכים/ה ל<a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)" }}>מדיניות הפרטיות</a></span>
        </label>
      </div>
    </div>
  );
}

// ── Budget cycle ─────────────────────────────────────────────────────────────────
export function CycleStep({ state, set }: StepProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Field label="איך נספר את החודש">
        <OptionCards
          cols={2}
          value={state.basis}
          onChange={(id) => set({ basis: id as WizardState["basis"] })}
          options={[
            { id: "calendar", emoji: "📅", title: "חודש קלנדרי", sub: "מתחדש בתאריך קבוע" },
            { id: "salary", emoji: "💸", title: "לפי משכורת", sub: "מתחדש ביום המשכורת" }
          ]}
        />
      </Field>

      {state.basis === "calendar" ? (
        <Field label="יום תחילת החודש התקציבי" hint="היום בחודש שבו מתחדש התקציב (1–28)">
          <DayChips value={state.startDay} onChange={(v) => set({ startDay: v })} />
        </Field>
      ) : (
        <Field label="יום המשכורת" hint="היום בחודש שבו נכנסת המשכורת (1–28)">
          <DayChips value={state.salaryDay} onChange={(v) => set({ salaryDay: v })} />
        </Field>
      )}

      {state.mode === "precise" && (
        <>
          <Field label="יום חיוב כרטיס האשראי">
            <DayChips value={state.creditDay} onChange={(v) => set({ creditDay: v })} />
          </Field>
          <Field label="מספר מקורות הכנסה">
            <Stepper value={state.incomeCount} onChange={(v) => set({ incomeCount: v })} min={1} max={6} />
          </Field>
        </>
      )}
    </div>
  );
}

// ── Income / managed budget ──────────────────────────────────────────────────────
export function IncomeStep({ state, set }: StepProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <OptionCards
        cols={2}
        value={state.budgetMode}
        onChange={(id) => set({ budgetMode: id as WizardState["budgetMode"] })}
        options={[
          { id: "income", emoji: "📥", title: "להזין הכנסה", sub: "נחשב לבד כמה יש לנהל" },
          { id: "budget", emoji: "🎯", title: "רק תקציב לניהול", sub: "מגדירים סכום חודשי ישירות" }
        ]}
      />
      {state.budgetMode === "income" ? (
        <Field label="הכנסה חודשית נטו (משק הבית)" hint="לא חובה — נעזר בזה כדי להציע תקציב לניהול. הסכום נשאר אצלכם.">
          <MoneyInput size="lg" value={state.income} onChange={(v) => set({ income: v })} placeholder="24,000" autoFocus />
        </Field>
      ) : (
        <Field label="תקציב חודשי לניהול" hint="הסכום שתרצו לנהל מדי חודש.">
          <MoneyInput size="lg" value={state.managedBudget} onChange={(v) => set({ managedBudget: v, managedTouched: true })} placeholder="10,000" autoFocus />
        </Field>
      )}
    </div>
  );
}

// ── Fixed expenses ────────────────────────────────────────────────────────────────
function FixedExpenseCard({ item, onPatch, onRemove }: {
  item: WizardFixedExpense;
  onPatch: (patch: Partial<WizardFixedExpense>) => void;
  onRemove: () => void;
}) {
  const monthly = monthlyOf(typeof item.amount === "number" ? item.amount : 0, item.frequency);
  return (
    <div style={{ background: "var(--cream-2)", border: "1.5px solid var(--cream-4)", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>{item.emoji}</span>
        {item.isCustom ? (
          <input
            className="input"
            value={item.label}
            placeholder="שם ההוצאה"
            onChange={(e) => onPatch({ label: e.target.value })}
            style={{ fontSize: 16, flex: 1 }}
          />
        ) : (
          <span style={{ fontWeight: 700, color: "var(--text-0)", flex: 1 }}>{item.label}</span>
        )}
        <button type="button" onClick={onRemove} aria-label="הסר" style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-2)", padding: 6 }}>
          <Trash2 size={18} aria-hidden />
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 140px", minWidth: 130 }}>
          <MoneyInput value={item.amount} onChange={(v) => onPatch({ amount: v })} placeholder={item.isEstimate ? "הערכה" : "סכום"} />
        </div>
        <FreqPick value={item.frequency} onChange={(v: FrequencyId) => onPatch({ frequency: v })} />
      </div>

      {item.isCustom && (
        <Field label="קטגוריה לדיווח">
          <ChipSelect
            value={item.reportCat}
            onChange={(v) => onPatch({ reportCat: v as ReportCatId })}
            options={REPORT_CATEGORIES.map((c) => ({ id: c.id, label: c.labelHe, emoji: c.icon }))}
          />
        </Field>
      )}

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        {item.isCustom && <MiniToggle label="הסכום מוערך" on={item.isEstimate} onChange={(v) => onPatch({ isEstimate: v })} />}
        <MiniToggle label="🔔 התריעו אם משתנה" on={item.alertOnChange} onChange={(v) => onPatch({ alertOnChange: v })} />
      </div>

      <div className="muted" style={{ fontSize: 12.5 }}>
        ~{fmt(monthly)} לחודש
      </div>
    </div>
  );
}

export function FixedStep({ state, set }: StepProps) {
  const activeKeys = new Set(state.fixed.map((f) => f.key));

  const togglePreset = (presetId: string) => {
    const preset = FIXED_PRESETS.find((p) => p.id === presetId)!;
    if (activeKeys.has(preset.id)) {
      set({ fixed: state.fixed.filter((f) => f.key !== preset.id) });
    } else {
      const entry: WizardFixedExpense = {
        key: preset.id, sourcePresetId: preset.id, isCustom: false, on: true,
        label: preset.label, reportCat: preset.reportCat, emoji: preset.emoji,
        amount: "", frequency: preset.frequency, isEstimate: preset.isEstimate ?? false,
        alertOnChange: false, billingDay: null
      };
      set({ fixed: [...state.fixed, entry] });
    }
  };

  const addCustom = () => {
    const entry: WizardFixedExpense = {
      key: genId(), sourcePresetId: null, isCustom: true, on: true,
      label: "", reportCat: "misc", emoji: "📌", amount: "", frequency: "monthly",
      isEstimate: true, alertOnChange: true, billingDay: null
    };
    set({ fixed: [...state.fixed, entry] });
  };

  const patchItem = (key: string, patch: Partial<WizardFixedExpense>) =>
    set({ fixed: state.fixed.map((f) => (f.key === key ? { ...f, ...patch } : f)) });

  const removeItem = (key: string) => set({ fixed: state.fixed.filter((f) => f.key !== key) });

  const monthlyTotal = state.fixed.reduce((s, f) => (f.on ? s + monthlyOf(typeof f.amount === "number" ? f.amount : 0, f.frequency) : s), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="מה כבר חייב לצאת כל חודש" hint="בחרו מהרשימה — ומלאו סכום. אפשר להוסיף הוצאות משלכם.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FIXED_PRESETS.map((p) => {
            const on = activeKeys.has(p.id);
            return (
              <button type="button" key={p.id} onClick={() => togglePreset(p.id)} aria-pressed={on} style={{
                display: "inline-flex", alignItems: "center", gap: 6, minHeight: 38, padding: "0 12px",
                borderRadius: 999, cursor: "pointer", fontSize: 13.5, fontWeight: 600,
                border: on ? "1.5px solid var(--teal)" : "1.5px solid var(--cream-4)",
                background: on ? "var(--teal-bg)" : "var(--cream-2)",
                color: on ? "var(--teal-dark)" : "var(--text-1)"
              }}>
                <span>{p.emoji}</span>{p.label}{on ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      </Field>

      {state.fixed.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {state.fixed.map((f) => (
            <FixedExpenseCard key={f.key} item={f} onPatch={(patch) => patchItem(f.key, patch)} onRemove={() => removeItem(f.key)} />
          ))}
        </div>
      )}

      <button type="button" onClick={addCustom} style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 46,
        borderRadius: 13, cursor: "pointer", fontWeight: 600, fontSize: 14,
        border: "1.5px dashed var(--cream-4)", background: "var(--cream-1)", color: "var(--text-1)"
      }}>
        <Plus size={18} aria-hidden /> הוצאה קבועה אחרת
      </button>

      <div className="muted" style={{ fontSize: 13 }}>
        סך הוצאות קבועות: <strong className="mono">{fmt(monthlyTotal)}</strong> לחודש
      </div>
    </div>
  );
}

// ── Managed budget + sub-budgets ───────────────────────────────────────────────
export function BudgetStep({ state, set, totals }: StepProps) {
  const suggestion = suggestedManagedBudget(state);
  const setSub = (id: SubBudgetCatId, v: number | "") =>
    set({ subBudgets: { ...state.subBudgets, [id]: typeof v === "number" ? v : 0 } });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Field
        label="תקציב חודשי לניהול"
        hint={state.budgetMode === "income"
          ? `הצענו ${fmt(suggestion)} (הכנסה פחות הוצאות קבועות). אפשר לשנות.`
          : "אפשר לעדכן את הסכום."}
      >
        <MoneyInput size="lg" value={state.managedBudget} onChange={(v) => set({ managedBudget: v, managedTouched: true })} placeholder={String(suggestion || 10000)} />
      </Field>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-0)" }}>חלוקה לקטגוריות (לא חובה)</span>
          <button type="button" onClick={() => set({ subBudgets: autoSplitSubBudgets(totals.managed) })} className="btn sm">חלוקה אוטומטית</button>
        </div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          הוקצה {fmt(totals.allocated)} מתוך {fmt(totals.managed)} · נשאר {fmt(Math.max(0, totals.remaining))}
        </div>
        {SUB_BUDGET_CATS.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, fontSize: 14 }}>{c.icon} {c.labelHe}</span>
            <div style={{ width: 140 }}>
              <MoneyInput value={state.subBudgets[c.id] ?? ""} onChange={(v) => setSub(c.id, v)} placeholder="0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Alerts ────────────────────────────────────────────────────────────────────
const ALERT_ROWS: Array<{ key: keyof WizardState["alerts"]; emoji: string; title: string; sub: string }> = [
  { key: "cat80", emoji: "🟡", title: "קטגוריה מגיעה ל-80%", sub: "נעדכן כשנשאר עוד מעט בקטגוריה" },
  { key: "cat100", emoji: "🔴", title: "חריגה מעבר ל-100%", sub: "התראה כשקטגוריה עברה את התקציב" },
  { key: "billUp", emoji: "📈", title: "חשבון קבוע שעלה", sub: "רק אם עלה משמעותית" },
  { key: "unusual", emoji: "👀", title: "הוצאה חריגה", sub: "סכום שלא אופייני לקטגוריה" },
  { key: "monthly", emoji: "🗓️", title: "סיכום חודשי", sub: "תזכורת לסגירת חודש + תמונת מצב" },
  { key: "weekly", emoji: "📊", title: "סיכום שבועי", sub: "טעימה קצרה של השבוע" }
];

export function AlertsStep({ state, set }: StepProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ALERT_ROWS.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--cream-2)", border: "1px solid var(--cream-3)", borderRadius: 14, padding: 14 }}>
          <span style={{ fontSize: 20 }}>{row.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-0)" }}>{row.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>{row.sub}</div>
          </div>
          <label style={{ display: "inline-flex" }}>
            <input
              type="checkbox"
              checked={state.alerts[row.key]}
              onChange={(e) => set({ alerts: { ...state.alerts, [row.key]: e.target.checked } })}
              aria-label={row.title}
              style={{ width: 20, height: 20 }}
            />
          </label>
        </div>
      ))}
    </div>
  );
}
