"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { isHouseholdManager } from "../../lib/settingsView";
import { bootstrapErrorAction } from "../../lib/authRouting";
import {
  createDefaultState, computeTotals, validateStep, buildOnboardingPayload,
  buildStateFromBaseline, suggestedManagedBudget, loadDraft, saveDraft, clearDraft,
  humanizeOnboardingError, incomeRefusedNotice, STEP_ORDER, type StepKey, type WizardState
} from "../../lib/onboarding/model";

// Steps where an empty answer is acceptable and a "skip" affordance is offered.
const SKIPPABLE: ReadonlySet<StepKey> = new Set(["fixed", "alerts"]);

/** Edit mode (?mode=edit): re-enter the wizard to complete/correct an existing
 *  household baseline instead of creating a new one. Read once from the URL. */
function readEditMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("mode") === "edit";
  } catch {
    return false;
  }
}

export interface WizardController {
  ready: boolean;
  done: boolean;
  state: WizardState;
  set: (partial: Partial<WizardState>) => void;
  stepKey: StepKey;
  stepIndex: number; // 1-based position among the 7 interactive steps (welcome..alerts)
  stepCount: number;
  canSkip: boolean;
  primaryLabel: string;
  /** True when re-entered via ?mode=edit to update an existing baseline (owner/admin). */
  editMode: boolean;
  error?: string;
  /**
   * SEPACCT §A60. A save that SUCCEEDED but did not store everything that was sent. Rendered as a
   * status, not as an error, because both halves of that sentence are true — and never as silence,
   * because "a refusal that looks like success is worse than either accepting or rejecting".
   */
  notice?: string;
  working: boolean;
  householdType: WizardState["householdType"];
  next: () => void;
  back: () => void;
  skip: () => void;
}

const INTERACTIVE: ReadonlyArray<StepKey> = STEP_ORDER.filter((s) => s !== "done");

export function useOnboardingWizard(): WizardController {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<WizardState>(createDefaultState);
  const [index, setIndex] = useState(0); // index into STEP_ORDER
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [working, setWorking] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Bootstrap: resolve the user, redirect if already onboarded, restore draft ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (cancelled) return;
        const wantsEdit = readEditMode();
        if (me.household) {
          // Edit mode completes/corrects an EXISTING baseline. Matching the backend
          // manager gate on POST /onboarding/complete, only a household manager
          // (owner/admin or an adult_member co-manager with permissions.all) may
          // overwrite the household — anyone else (and any non-edit entry) goes to the
          // dashboard instead of re-running the wizard.
          const canEdit = isHouseholdManager({ role: me.membership?.role, permissions: me.membership?.permissions });
          if (!wantsEdit || !canEdit) {
            router.replace("/dashboard");
            return;
          }
          setEditMode(true);
          setState(buildStateFromBaseline(
            {
              financialBaseline: me.household.financialBaseline,
              name: me.household.name,
              monthlyBudgetAmount: me.household.monthlyBudgetAmount,
              defaultCity: me.household.defaultCity,
              budgetCycleDay: me.household.budgetCycleDay
            },
            me.user.displayName ?? undefined
          ));
          // Intentionally do NOT set userIdRef in edit mode: that disables draft
          // autosave/restore, so a first-time onboarding draft is never polluted or
          // resurrected over the live baseline being edited.
          return;
        }
        const uid = me.user.id;
        userIdRef.current = uid;
        const draft = loadDraft(uid, Date.now());
        if (draft) {
          setState(draft);
        } else if (me.user.displayName) {
          setState((s) => ({ ...s, displayName: me.user.displayName ?? "" }));
        }
      } catch (err) {
        if (cancelled) return;
        // WP-P1-FE / NF-M17: only a genuine 401 means "not logged in" → /login. A transient
        // network failure or a 5xx must NOT bounce the user to login (that discards their
        // authenticated context on a blip) — surface a retry message and stay put instead.
        if (bootstrapErrorAction(err) === "login") {
          router.replace("/login");
          return;
        }
        setError("אירעה שגיאת רשת. רעננו את הדף ונסו שוב.");
        return;
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // ── Draft autosave (debounced) ──────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !userIdRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (userIdRef.current) saveDraft(userIdRef.current, state, Date.now());
    }, 400);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state, ready]);

  const set = useCallback((partial: Partial<WizardState>) => {
    setError(undefined);
    setNotice(undefined);
    setState((s) => ({ ...s, ...partial }));
  }, []);

  const stepKey = STEP_ORDER[index] as StepKey;
  const totals = useMemo(() => computeTotals(state), [state]);

  const goTo = useCallback((nextIndex: number) => {
    setError(undefined);
    setNotice(undefined);
    // Entering the managed-budget step in income mode: prefill the suggestion once.
    const target = STEP_ORDER[nextIndex];
    setState((s) => {
      if (target === "budget" && s.budgetMode === "income" && !s.managedTouched) {
        return { ...s, managedBudget: suggestedManagedBudget(s) };
      }
      return s;
    });
    setIndex(nextIndex);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  const submit = useCallback(async () => {
    // Re-check the required steps before committing (navigation already gates them).
    for (const s of ["profile", "income", "budget"] as StepKey[]) {
      const msg = validateStep(s, state);
      if (msg) { setError(msg); setIndex(STEP_ORDER.indexOf(s)); return; }
    }
    setWorking(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const payload = buildOnboardingPayload(state);
      // Same endpoint for first-time and edit: the backend UPSERTs the existing household
      // in place (no duplicate), keeps members/invites/expenses, and re-redacts the result.
      const saved = await api.completeOnboarding(payload);
      // SEPACCT §A60 — the save landed, and one field of it may not have. This happens when the
      // arrangement was declared between our prefill and this POST (a partner in WhatsApp, another
      // tab): the income we sent was refused and the response came back redacted. Say so ON THE
      // STEP WHERE THEY TYPED IT, and adopt the redaction so the next save carries the mark rather
      // than rebuilding a zero over the stored figure. Deliberately does NOT navigate away — in
      // edit mode a `replace("/dashboard")` here would be the silence this ruling forbids.
      const refused = incomeRefusedNotice(payload, saved.household);
      if (refused) {
        setState((s) => ({ ...s, incomeRedacted: true, income: "" }));
        setNotice(refused);
        setIndex(STEP_ORDER.indexOf("income"));
        if (typeof window !== "undefined") window.scrollTo({ top: 0 });
        return;
      }
      if (editMode) {
        // Baseline updated — return to the dashboard (no first-time "done" celebration).
        router.replace("/dashboard");
        return;
      }
      if (userIdRef.current) clearDraft(userIdRef.current);
      goTo(STEP_ORDER.indexOf("done"));
    } catch (err) {
      // Translate the API error to Hebrew by code; never surface a raw English / JSON message.
      setError(humanizeOnboardingError(err));
    } finally {
      setWorking(false);
    }
  }, [state, goTo, editMode, router]);

  const next = useCallback(() => {
    const msg = validateStep(stepKey, state);
    if (msg) { setError(msg); return; }
    if (stepKey === "alerts") { void submit(); return; }
    goTo(Math.min(STEP_ORDER.length - 1, index + 1));
  }, [stepKey, state, index, goTo, submit]);

  const back = useCallback(() => {
    if (index === 0) return;
    goTo(Math.max(0, index - 1));
  }, [index, goTo]);

  const skip = useCallback(() => {
    if (!SKIPPABLE.has(stepKey)) return;
    if (stepKey === "alerts") { void submit(); return; }
    goTo(Math.min(STEP_ORDER.length - 1, index + 1));
  }, [stepKey, index, goTo, submit]);

  const primaryLabel =
    stepKey === "welcome" ? (editMode ? "ממשיכים" : "מתחילים")
    : stepKey === "alerts" ? (editMode ? "שמירת השינויים" : "סיום")
    : "המשך";
  const stepIndex = INTERACTIVE.indexOf(stepKey) + 1;

  return {
    ready,
    done: stepKey === "done",
    state,
    set,
    stepKey,
    stepIndex,
    stepCount: INTERACTIVE.length,
    canSkip: SKIPPABLE.has(stepKey),
    primaryLabel,
    editMode,
    error,
    notice,
    working,
    householdType: state.householdType,
    next,
    back,
    skip
  };
}

export { computeTotals };
