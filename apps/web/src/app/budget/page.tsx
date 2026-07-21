"use client";

import Link from "next/link";
import { Archive, FolderPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BudgetCurrent, Household, ProjectBudget } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";
import { heDate } from "../../lib/format";

function progressColor(pct: number): string {
  if (pct >= 100) return "rose";
  if (pct >= 75) return "amber";
  return "";
}

export default function BudgetPage() {
  const [household, setHousehold] = useState<Household>();
  const [budget, setBudget] = useState<BudgetCurrent>();
  const [projects, setProjects] = useState<ProjectBudget[]>([]);
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  // Form/action-scoped errors: a create or delete failure must NOT flow into `error`,
  // which replaces the whole page (see the early returns below) and unmounts the form.
  const [formError, setFormError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [invalidField, setInvalidField] = useState<"name" | "total">();
  // Attempt counter, used only as the alert's `key` so a repeated identical validation
  // message still remounts the alert node and is therefore announced again.
  const [formErrorAt, setFormErrorAt] = useState(0);
  const [notice, setNotice] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const totalRef = useRef<HTMLInputElement>(null);
  const projectsHeadingRef = useRef<HTMLHeadingElement>(null);

  async function load() {
    setError(undefined);
    try {
      const current = await api.currentHousehold();
      setHousehold(current.household);
      const [budgetData, projectsData] = await Promise.all([
        api.budgetCurrent(current.household.id),
        api.listProjectBudgets(current.household.id)
      ]);
      setBudget(budgetData);
      setProjects(projectsData.budgets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את התקציב.");
    }
  }

  useEffect(() => { load(); }, []);

  // 3.3.1 - the focus move MUST happen after React has committed aria-invalid /
  // aria-describedby on the field and mounted #pb-form-error. Focusing synchronously
  // inside the submit handler lands on a field the reader still sees as valid.
  useEffect(() => {
    if (!invalidField) return;
    (invalidField === "name" ? nameRef.current : totalRef.current)?.focus();
  }, [invalidField]);

  async function createBudget(event: React.FormEvent) {
    event.preventDefault();
    // Re-entry guard replaces `disabled` on the submit button: disabling a control
    // as a result of activating it drops focus to <body> (2.4.3).
    if (!household || creating) return;
    // 3.3.1/3.3.3 - name the problem and put focus on the first invalid field.
    // The form is noValidate, so this announced message replaces the native
    // constraint bubble (transient, unassociated, not focus-managed).
    // role="alert" only fires when the alert node is INSERTED, so re-submitting with the same
    // problem writes an identical string into the already-mounted alert and says nothing. The
    // alert is keyed on `formErrorAt` (below) so it remounts per attempt and speaks every time.
    // Focus is moved from the effect above, after React has committed aria-invalid.
    const amount = Number(total);
    if (!name.trim()) {
      setInvalidField("name");
      setFormError("צריך למלא שם לפרויקט.");
      setFormErrorAt((n) => n + 1);
      return;
    }
    if (!total.trim() || !Number.isFinite(amount) || amount < 1 || amount > 10000000) {
      setInvalidField("total");
      setFormError("הסכום חייב להיות מספר בין 1 ל-10,000,000.");
      setFormErrorAt((n) => n + 1);
      return;
    }
    setInvalidField(undefined);
    setFormError(undefined);
    setNotice("");
    setCreating(true);
    try {
      const body: { name: string; totalAmount: number; endDate?: string } = {
        name: name.trim(),
        totalAmount: amount
      };
      if (endDate) body.endDate = endDate;
      await api.createProjectBudget(household.id, body);
      setName("");
      setTotal("");
      setEndDate("");
      setNotice("תקציב הפרויקט נוצר.");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "לא הצלחנו ליצור תקציב פרויקט.");
    } finally {
      setCreating(false);
    }
  }

  async function archiveBudget(budgetId: string) {
    if (!household) return;
    if (!confirm("להסיר את תקציב הפרויקט? ההוצאות שכבר נרשמו יישארו.")) return;
    setActionError(undefined);
    setNotice("");
    // Captured before the round-trip: `confirm()` hands focus back to the archive
    // button, and that button is what load() is about to unmount.
    const initiator = document.activeElement;
    try {
      await api.deleteProjectBudget(household.id, budgetId);
      await load();
      setNotice("תקציב הפרויקט הוסר.");
      // The row that held focus is unmounted by load(); park focus on the section
      // heading instead of letting it fall to <body> (2.4.3). Orphan guard: only
      // reclaim focus when it is still on that doomed button or has already fallen
      // to <body>. A keyboard user who Tabbed onward during the round-trip keeps
      // their own focus. (React has not committed the removal yet at this point,
      // so `activeElement` is still the button - hence the explicit comparison.)
      const ae = document.activeElement;
      if (ae && ae !== document.body && ae !== initiator) return;
      projectsHeadingRef.current?.focus();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "לא הצלחנו להסיר את התקציב.");
    }
  }

  // Every rendered STATE needs its own <h1> - loading and error included.
  if (error) return <AppShell><h1 className="page-title">תקציב</h1><LoadState error={error} /></AppShell>;
  if (!household || !budget) return <AppShell><h1 className="page-title">תקציב</h1><LoadState /></AppShell>;

  const activeProjects = projects.filter((p) => p.isActive);
  const householdPct = budget.budgetAmount > 0 ? Math.min(100, Math.round((budget.spentAmount / budget.budgetAmount) * 100)) : 0;

  return (
    <AppShell>
      <h1 className="page-title">תקציב</h1>
      {/* Always mounted, so a text change is announced. Create/delete outcomes
          and the saving state have no other visible-to-AT signal. */}
      <span className="sr-only" role="status">{creating ? "שומר..." : notice}</span>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>התקציב החודשי של הבית</h2>
        <div className="grid three" style={{ marginTop: 12 }}>
          <div>
            <div className="muted">סך הכל</div>
            <div className="metric">{budget.budgetAmount.toLocaleString()} ₪</div>
          </div>
          <div>
            <div className="muted">הוצא</div>
            <div className="metric">{budget.spentAmount.toLocaleString()} ₪</div>
          </div>
          <div>
            <div className="muted">נותר</div>
            <div className="metric">{budget.remainingAmount.toLocaleString()} ₪</div>
          </div>
        </div>
        <div className="progress" style={{ marginTop: 12 }}>
          <div className={`progress-fill ${progressColor(householdPct)}`} style={{ width: `${householdPct}%` }} />
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>נוצלו {householdPct}% מהתקציב החודשי</div>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2 ref={projectsHeadingRef} tabIndex={-1}>תקציבי פרויקט פעילים</h2>
        <p className="muted" style={{ marginTop: 4, marginBottom: 12 }}>תקציבים מוגדרי-זמן (חופשה, שיפוץ וכו'). להוצאה: שלח ב-WhatsApp עם <code>#שם-הפרויקט</code>.</p>
        {actionError && <div className="status error" role="alert" style={{ marginBottom: 12 }}>{actionError}</div>}
        {activeProjects.length === 0 ? (
          <p className="muted">אין תקציבי פרויקט פעילים.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activeProjects.map((p) => {
              // heDate returns null for a missing/unparseable value, so the raw API
              // string is never dropped into the JSX (it rendered a full JS Date here).
              const endLabel = heDate(p.endDate);
              return (
              <div key={p.id} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)" }}>
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <Link href={`/budget/project/${p.id}`} style={{ color: "inherit", textDecoration: "none", flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                      תקציב: {p.totalAmount.toLocaleString()} ₪
                      {endLabel && ` · עד ${endLabel}`}
                      <span style={{ marginInlineStart: 8 }}>· הצג הוצאות →</span>
                    </div>
                  </Link>
                  <button className="button secondary" onClick={() => archiveBudget(p.id)} style={{ padding: "4px 8px" }}>
                    <Archive size={14} aria-hidden />
                    {/* sr-only text INSIDE the content, not an aria-label: the name and
                        the pixels cannot drift apart, and it names the target row. */}
                    <span className="sr-only">{`הסר את תקציב הפרויקט ${p.name}`}</span>
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>הוסף תקציב פרויקט</h2>
        {/* noValidate: our own announced + associated error replaces the native
            constraint bubble, which is transient and not exposed to AT. */}
        <form className="form" onSubmit={createBudget} noValidate style={{ marginTop: 12 }}>
          <label htmlFor="pb-name">
            שם הפרויקט
            <input
              id="pb-name"
              ref={nameRef}
              className="input"
              value={name}
              placeholder='למשל: "שיפוץ" / "חופשה ביוון"'
              aria-invalid={invalidField === "name" || undefined}
              aria-describedby={invalidField === "name" ? "pb-form-error" : undefined}
              onChange={(e) => { setName(e.target.value); if (invalidField === "name") { setInvalidField(undefined); setFormError(undefined); } }}
            />
          </label>
          <label htmlFor="pb-total">
            סכום כולל (₪)
            <input
              id="pb-total"
              ref={totalRef}
              className="input"
              type="number"
              inputMode="numeric"
              step={1}
              min={1}
              max={10000000}
              value={total}
              placeholder="למשל: 15000"
              aria-invalid={invalidField === "total" || undefined}
              aria-describedby={invalidField === "total" ? "pb-form-error" : undefined}
              onChange={(e) => { setTotal(e.target.value); if (invalidField === "total") { setInvalidField(undefined); setFormError(undefined); } }}
            />
          </label>
          <label htmlFor="pb-end">
            תאריך סיום (אופציונלי)
            <input id="pb-end" className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          {formError && <div key={formErrorAt} id="pb-form-error" className="status error" role="alert">{formError}</div>}
          {/* Never `disabled` here (2.4.3): the button disables itself on activation
              and focus would drop to <body>. Re-entry is guarded in createBudget. */}
          <button className="button" type="submit" aria-busy={creating || undefined}>
            <FolderPlus size={18} aria-hidden />
            צור תקציב
          </button>
        </form>
      </section>
    </AppShell>
  );
}
