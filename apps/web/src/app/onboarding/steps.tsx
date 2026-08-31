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
import { NotificationsEditor } from "../../components/NotificationsEditor";
import { SEPACCT_UI_ENABLED } from "../../lib/sepacct";

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
        { id: "quick", emoji: "⚡", title: "מהיר", sub: "הבסיס בלבד - אפשר להשלים בהמשך" },
        { id: "precise", emoji: "🔍", title: "מדויק", sub: "שאלות נוספות לתמונה מלאה יותר" }
      ]}
    />
  );
}

// ── Profile ─────────────────────────────────────────────────────────────────────
export function ProfileStep({ state, set }: StepProps) {
  // Quick mode keeps the profile to the essentials (type, name, #adults, #kids).
  // The region/city, #cars and kid age-range chips are precise-only details.
  const precise = state.mode === "precise";
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
        <TextInput value={state.displayName} onChange={(v) => set({ displayName: v })} placeholder="השם שלך" autoComplete="given-name" ariaLabel="השם שלך" />
      </Field>
      <Field label="שם הבית">
        <TextInput value={state.householdName} onChange={(v) => set({ householdName: v })} placeholder="למשל: משפחת לוי" ariaLabel="שם הבית" />
      </Field>
      {precise && (
        <Field label="עיר / אזור" hint="אופציונלי - עוזר להשוואות בעתיד">
          <TextInput value={state.city} onChange={(v) => set({ city: v })} placeholder="העיר או השכונה שלך" ariaLabel="עיר / אזור" />
        </Field>
      )}

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <Field label="מבוגרים">
          <Stepper value={state.adults} onChange={(v) => set({ adults: v })} min={1} max={12} label="מבוגרים" />
        </Field>
        <Field label="ילדים">
          <Stepper value={state.kids} onChange={(v) => set({ kids: v })} min={0} max={12} label="ילדים" />
        </Field>
        {precise && (
          <Field label="רכבים">
            <Stepper value={state.cars} onChange={(v) => set({ cars: v })} min={0} max={6} label="רכבים" />
          </Field>
        )}
      </div>

      {state.kids > 0 && precise && (
        <Field label="גילאי הילדים" hint="אפשר לבחור כמה">
          <ChipSelect
            multi
            value={state.kidAges}
            onChange={(v) => set({ kidAges: v as KidAgeBracket[] })}
            options={KID_AGE_BRACKETS.map((b) => ({ id: b, label: b }))}
          />
        </Field>
      )}

    </div>
  );
}

// ── Budget cycle ─────────────────────────────────────────────────────────────────
// ── SEPACCT `CC_UX_BUILD` item 4, spec screen A — **THE WIZARD ASKS, AND STILL DOES NOT DECIDE.**
//
// §A60 turned this step read-only, and it was right to. The version before it wrote
// `state.separateAccounts` and `buildOnboardingPayload` sent it as
// `state.separateAccounts || undefined` — so "ביחד" was a one-way door that returned `200 OK` and
// changed nothing, and "בנפרד" landed an arrangement with NO declaration stamp: hidden income on
// one surface, "joint" on the other, no start notice, and a split the announcing route would have
// refused. A control that looks like a decision and is not is §A60's own complaint one layer up.
//
// 🔑 **THE FIX WAS NEVER "DO NOT ASK". IT WAS "DO NOT DECIDE HERE".** The control is back, and the
// answer still does not travel in the onboarding payload — `buildOnboardingPayload`'s `profile`
// carries no `separateAccounts` key and `model.test.ts` still pins that. What the answer does now is
// drive one `PUT /households/:id/separate-accounts` AFTER `POST /onboarding/complete` returns,
// which is the route that validates the split, stores the ratio and mints the stamp when it can.
// The wizard collects; the announcing route decides. Both halves of §A60 survive.
//
// ⚠️ ONE SCREEN, NOT TWO. The ratio opens INLINE under the "בנפרד" card the moment it is chosen.
// The spec's hole 5: the previous design answered "people have no attention span" by adding two
// steps. A seventh question in a row is how a wizard gets abandoned.
//
// ⚠️ AND THE RATIO IS TYPED, NEVER DERIVED (`A61`). There is no "split it by income" option, and
// there will not be one: you know your own income and you see your own share on every expense, so
// `partner = (mine ÷ myShare) − mine` publishes the figure `member_income` exists to protect. A
// couple who wants income-proportional computes it and types 62.
export function SeparateAccountsStep({ state, set }: StepProps) {
  const separate = state.separateAccounts;
  const half = state.separateSharePct === 50;
  const pct = typeof state.separateSharePct === "number" ? state.separateSharePct : 50;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p className="muted" style={{ margin: 0 }}>אפשר לשנות בכל שלב.</p>
      <OptionCards
        cols={1}
        value={separate ? "apart" : "together"}
        onChange={(id) => set({ separateAccounts: id === "apart" })}
        options={[
          { id: "together", emoji: "🤝", title: "יחד", sub: "קופה אחת. רואים את אותם מספרים." },
          { id: "apart", emoji: "🧾", title: "בנפרד", sub: "לכל אחד הכסף שלו, וההוצאות המשותפות מתחלקות ביניכם." }
        ]}
      />

      {separate && (
        <section className="panel" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>איך מתחלק?</h2>
          <OptionCards
            cols={2}
            value={half ? "half" : "other"}
            // Leaving "יחס אחר" seeds 60 rather than keeping 50: a person who taps it has already
            // said they do not want half, and a control that opens showing the answer they just
            // rejected reads as broken.
            onChange={(id) => set({ separateSharePct: id === "half" ? 50 : (pct === 50 ? 60 : pct) })}
            options={[
              { id: "half", title: "חצי חצי" },
              { id: "other", title: "יחס אחר" }
            ]}
          />
          {!half && (
            <div className="row" style={{ gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <Field label="החלק שלך" htmlFor="sep-share">
                {/* Every number is a left-to-right island. Two percentages on one RTL line
                    transpose visually with every character correct, which is the failure
                    `SPLIT_CONTROL_DESIGN.md` names; the `%` sits OUTSIDE the value for the
                    same reason. */}
                <div className="row" style={{ gap: 6, alignItems: "center" }}>
                  <input
                    id="sep-share" className="input mono" type="number" inputMode="decimal"
                    min={1} max={99} step={1} dir="ltr" style={{ width: 96 }}
                    value={state.separateSharePct}
                    onChange={(e) => set({ separateSharePct: e.target.value === "" ? "" : Number(e.target.value) })}
                  />
                  <span aria-hidden>%</span>
                </div>
              </Field>
              <p className="muted" style={{ margin: 0 }}>
                {"החלק של בן/בת הזוג: "}
                <bdi className="mono" dir="ltr">{Math.max(0, Math.min(100, 100 - pct))}</bdi>
                {"%"}
              </p>
            </div>
          )}
          <p className="status" style={{ display: "block" }}>
            היחס נשמר עכשיו ומתחיל לפעול כשמצטרף בן/בת הזוג. עד אז אין מה לחלק.
          </p>
        </section>
      )}
    </div>
  );
}

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
        <Field label="יום תחילת החודש התקציבי" hint="היום בחודש שבו מתחדש התקציב (1-28)">
          <DayChips value={state.startDay} onChange={(v) => set({ startDay: v })} />
        </Field>
      ) : (
        <Field label="יום המשכורת" hint="היום בחודש שבו נכנסת המשכורת (1-28)">
          <DayChips value={state.salaryDay} onChange={(v) => set({ salaryDay: v })} />
        </Field>
      )}

      {state.mode === "precise" && (
        <>
          <Field label="יום חיוב כרטיס האשראי">
            <DayChips value={state.creditDay} onChange={(v) => set({ creditDay: v })} />
          </Field>
          <Field label="מספר מקורות הכנסה">
            <Stepper value={state.incomeCount} onChange={(v) => set({ incomeCount: v })} min={1} max={6} label="מספר מקורות הכנסה" />
          </Field>
        </>
      )}
    </div>
  );
}

// ── Income / managed budget ──────────────────────────────────────────────────────
export function IncomeStep({ state, set }: StepProps) {
  // ── SEPACCT `CC_UX_BUILD` item 4, spec screen B — **THE ROOT FIX FOR THE VANISHING INCOME.**
  //
  // A household that has just answered "בנפרד" is never asked for a shared household figure. It is
  // asked for its OWN, which is private, which the partner cannot read, and which is written by
  // `PUT …/my-income` after completion rather than by the baseline overwrite.
  //
  // 🔑 THIS IS UPSTREAM OF THE BRANCH BELOW, NOT A SECOND COPY OF IT. The `incomeRedacted` branch
  // explains a figure that has already disappeared, and it exists for every household that had a
  // shared income before it declared. This branch means a household declaring HERE never acquires
  // one — so there is nothing to disappear, nothing to explain, and no rebuilt `0` for the server
  // to refuse. Explaining a disappearance is a fix; not disappearing is better.
  //
  // ⚠️ ORDER MATTERS, AND IT IS THE OPPOSITE OF THE OBVIOUS ONE. The `incomeRedacted` branch below
  // is tested FIRST, because an already-arranged household re-entering the wizard carries both
  // marks and the one that matters to it is the redaction: it had a shared figure, it cannot see
  // it, and the paragraph explaining that is the only place the product says so. This branch is
  // for a household answering for the FIRST time, which has no stored figure and therefore nothing
  // to explain — it is simply never asked for a shared income at all.
  if (state.separateAccounts && !state.incomeRedacted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label="ההכנסה שלך" hint="פרטית. בן/בת הזוג לא רואה את המספר הזה.">
          <MoneyInput size="lg" value={state.ownIncome} onChange={(v) => set({ ownIncome: v })} placeholder="18,000" autoFocus ariaLabel="ההכנסה שלך" />
        </Field>
        {/* The budget is the household's either way — the spec's own table. It is the one figure on
            this screen that both partners see, and it is not derived from either income. */}
        <Field label="תקציב חודשי לניהול" hint="הסכום המשותף של הבית. את זה שניכם רואים.">
          <MoneyInput size="lg" value={state.managedBudget} onChange={(v) => set({ managedBudget: v, managedTouched: true })} placeholder="10,000" ariaLabel="תקציב חודשי לניהול" />
        </Field>
        <p className="muted" style={{ margin: 0 }}>
          אפשר לדלג על ההכנסה. היא לא נדרשת לשום חישוב כאן, והיא נשמרת רק אצלכם.
        </p>
      </div>
    );
  }
  // ── SEPACCT `AMENDMENT_15` §A56 / `AMENDMENT_16` §A60 ──────────────────────────────────────
  // Under separate accounts the server removes `budget.income` from every read — the owner's
  // included, because nothing in the data says whose money it is — and refuses every write of it.
  // Rendering the input anyway posts a figure the product will not store, behind a `200 OK`:
  // "a refusal that looks like success is worse than either accepting or rejecting". So the person
  // is told HERE, on the step where they would have typed it, and edits the shared budget instead.
  if (state.incomeRedacted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* `R-1` — THE MOST LITERAL "WHERE DID MY NUMBER GO" SURFACE IN THE PRODUCT, AND IT WAS THE
            ONE STILL MISSING BOTH HALVES. This is the very field the person typed the figure into.
            The other two surfaces already say the stored amount survives and where their own now
            lives; this one said neither, which is exactly the "the app lost our data" reading. */}
        <p className="status" style={{ display: "block" }}>
          בבית הזה החשבונות מנוהלים בנפרד, ולכן אין הכנסה משותפת לשמור כאן. הסכום שנשמר קודם לא נמחק - הוא רק מפסיק להיות מוצג, וחוזר אם ההסדר מכובה.
          {SEPACCT_UI_ENABLED && <> ההכנסה שלכם עצמכם נשמרת בעמוד ״ההכנסה שלי״ ונראית רק לכם.</>}
        </p>
        <Field label="תקציב חודשי לניהול" hint="הסכום המשותף שתרצו לנהל מדי חודש.">
          <MoneyInput size="lg" value={state.managedBudget} onChange={(v) => set({ managedBudget: v, managedTouched: true })} placeholder="10,000" autoFocus ariaLabel="תקציב חודשי לניהול" />
        </Field>
      </div>
    );
  }
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
        <Field label="הכנסה חודשית נטו (משק הבית)" hint="לא חובה - נעזר בזה כדי להציע תקציב לניהול. הסכום נשאר אצלכם.">
          <MoneyInput size="lg" value={state.income} onChange={(v) => set({ income: v })} placeholder="24,000" autoFocus ariaLabel="הכנסה חודשית נטו (משק הבית)" />
        </Field>
      ) : (
        <Field label="תקציב חודשי לניהול" hint="הסכום שתרצו לנהל מדי חודש.">
          <MoneyInput size="lg" value={state.managedBudget} onChange={(v) => set({ managedBudget: v, managedTouched: true })} placeholder="10,000" autoFocus ariaLabel="תקציב חודשי לניהול" />
        </Field>
      )}
    </div>
  );
}

// ── Fixed expenses ────────────────────────────────────────────────────────────────
function FixedExpenseCard({ item, onPatch, onRemove, precise }: {
  item: WizardFixedExpense;
  onPatch: (patch: Partial<WizardFixedExpense>) => void;
  onRemove: () => void;
  precise: boolean;
}) {
  const monthly = monthlyOf(typeof item.amount === "number" ? item.amount : 0, item.frequency);
  return (
    <div style={{ background: "var(--cream-2)", border: "1.5px solid var(--cream-4)", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ fontSize: 22 }}>{item.emoji}</span>
        {item.isCustom ? (
          <input
            className="input"
            value={item.label}
            aria-label="שם ההוצאה"
            placeholder="שם ההוצאה"
            onChange={(e) => onPatch({ label: e.target.value })}
            style={{ fontSize: 16, flex: 1 }}
          />
        ) : (
          <span style={{ fontWeight: 700, color: "var(--text-0)", flex: 1 }}>{item.label}</span>
        )}
        {/* Icon-only control: the name must say WHAT is removed, not just "הסר". */}
        <button type="button" onClick={onRemove} aria-label={item.label.trim() ? `הסר ${item.label.trim()}` : "הסר הוצאה"} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-2)", padding: 6 }}>
          <Trash2 size={18} aria-hidden />
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 140px", minWidth: 130 }}>
          <MoneyInput
            value={item.amount}
            onChange={(v) => onPatch({ amount: v })}
            placeholder={item.isEstimate ? "הערכה" : "סכום"}
            ariaLabel={item.label.trim() ? `סכום - ${item.label.trim()}` : "סכום"}
          />
        </div>
        {precise && <FreqPick value={item.frequency} onChange={(v: FrequencyId) => onPatch({ frequency: v })} />}
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

      {(item.isCustom || precise) && (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {item.isCustom && <MiniToggle label="הסכום מוערך" on={item.isEstimate} onChange={(v) => onPatch({ isEstimate: v })} />}
          {precise && <MiniToggle label="🔔 התריעו אם משתנה" on={item.alertOnChange} onChange={(v) => onPatch({ alertOnChange: v })} />}
        </div>
      )}

      <div className="muted" style={{ fontSize: 12.5 }}>
        ~{fmt(monthly)} לחודש
      </div>
    </div>
  );
}

export function FixedStep({ state, set }: StepProps) {
  // Quick mode keeps each fixed expense to its amount only; the frequency picker and
  // the per-expense change-alert toggle are precise-only.
  const precise = state.mode === "precise";
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
      <Field label="מה כבר חייב לצאת כל חודש" hint="בחרו מהרשימה - ומלאו סכום. אפשר להוסיף הוצאות משלכם.">
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
                <span aria-hidden>{p.emoji}</span>{p.label}{on ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      </Field>

      {state.fixed.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {state.fixed.map((f) => (
            <FixedExpenseCard key={f.key} item={f} precise={precise} onPatch={(patch) => patchItem(f.key, patch)} onRemove={() => removeItem(f.key)} />
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
        <MoneyInput size="lg" value={state.managedBudget} onChange={(v) => set({ managedBudget: v, managedTouched: true })} placeholder={String(suggestion || 10000)} ariaLabel="תקציב חודשי לניהול" />
      </Field>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Real heading for the sub-section; inline resets keep the rendering
              byte-identical to the styled <span> it replaced. */}
          <h2 style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-0)", margin: 0 }}>חלוקה לקטגוריות (לא חובה)</h2>
          <button type="button" onClick={() => set({ subBudgets: autoSplitSubBudgets(totals.managed) })} className="btn sm">חלוקה אוטומטית</button>
        </div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          הוקצה {fmt(totals.allocated)} מתוך {fmt(totals.managed)} · נשאר {fmt(Math.max(0, totals.remaining))}
        </div>
        {SUB_BUDGET_CATS.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, fontSize: 14 }}><span aria-hidden>{c.icon}</span> {c.labelHe}</span>
            <div style={{ width: 140 }}>
              <MoneyInput value={state.subBudgets[c.id] ?? ""} onChange={(v) => setSub(c.id, v)} placeholder="0" ariaLabel={c.labelHe} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Alerts ────────────────────────────────────────────────────────────────────
// Reuses the shared NotificationsEditor (CONTROLLED mode) - the single source of
// truth also mounted in /settings/notifications. Here it does NOT persist: it edits
// the wizard's `alerts` state, which is written as part of completeOnboarding. The
// WhatsApp channel card is hidden in onboarding.
export function AlertsStep({ state, set }: StepProps) {
  return (
    <NotificationsEditor
      value={state.alerts}
      onChange={(next) => set({ alerts: next })}
      showChannel={false}
    />
  );
}
