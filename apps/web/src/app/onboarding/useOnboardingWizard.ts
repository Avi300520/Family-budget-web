"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { isHouseholdManager } from "../../lib/settingsView";
import { bootstrapErrorAction } from "../../lib/authRouting";
import {
  createDefaultState, computeTotals, validateStep, buildOnboardingPayload,
  buildStateFromBaseline, suggestedManagedBudget, loadDraft, saveDraft, clearDraft,
  humanizeOnboardingError, incomeRefusedNotice, STEP_ORDER, visibleSteps, pendingSplitBp,
  type StepKey, type WizardState
} from "../../lib/onboarding/model";
import { sepacct } from "../../lib/sepacctApi";
import { agorotFromInput } from "../../lib/sepacct";

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
  stepIndex: number; // 1-based position among this household's interactive steps (welcome..alerts)
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
  completedHouseholdId?: string;
  next: () => void;
  back: () => void;
  skip: () => void;
}

/** The steps that carry a question, for THIS household. `done` is a celebration, not a step, and
 *  a household that is never asked about separate accounts must not see a segment for it — a
 *  progress bar that counts a screen you will not be shown is a progress bar that lies. */
const interactiveSteps = (state: WizardState, editMode: boolean): ReadonlyArray<StepKey> =>
  visibleSteps(state).filter((step) => step !== "done" && !(editMode && step === "separate"));

export function useOnboardingWizard(): WizardController {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<WizardState>(createDefaultState);
  const [index, setIndex] = useState(0); // index into `steps` — the VISIBLE spine, see below
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [working, setWorking] = useState(false);
  const [completedHouseholdId, setCompletedHouseholdId] = useState<string>();
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

  // ── `CC_UX_BUILD` item 4 — THE SPINE IS NOW STATE-DEPENDENT, AND THE INDEX IS CLAMPED TO IT.
  //
  // `STEP_ORDER` is the BUILD's sequence (the SEPACCT step is filtered out when the UI flag is
  // unset); `visibleSteps` is THIS HOUSEHOLD's, and a `יחיד/ה` is not asked how it divides money
  // with nobody. The clamp is not defensive noise: `householdType` is chosen on `profile`, which
  // comes BEFORE `separate`, so going back and switching to `יחיד/ה` shortens the array under a
  // live index. Without it the last step lands on `undefined` and the wizard renders nothing.
  const steps = useMemo(() => interactiveSteps(state, editMode), [state, editMode]);
  const stepKey = (steps[Math.min(index, steps.length - 1)] ?? "welcome") as StepKey;
  const totals = useMemo(() => computeTotals(state), [state]);

  const goTo = useCallback((nextIndex: number) => {
    setError(undefined);
    setNotice(undefined);
    // Entering the managed-budget step in income mode: prefill the suggestion once.
    const target = steps[nextIndex];
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
      if (msg) { setError(msg); setIndex(Math.max(0, steps.indexOf(s))); return; }
    }
    setWorking(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const payload = buildOnboardingPayload(state);
      // Same endpoint for first-time and edit: the backend UPSERTs the existing household
      // in place (no duplicate), keeps members/invites/expenses, and re-redacts the result.
      const saved = await api.completeOnboarding(payload);
      if (saved.household?.id) setCompletedHouseholdId(saved.household.id);
      // SEPACCT §A60 — the save landed, and one field of it may not have. This happens when the
      // arrangement was declared between our prefill and this POST (a partner in WhatsApp, another
      // tab): the income we sent was dropped, and the SERVER says so on the response. Say it ON THE
      // STEP WHERE THEY TYPED IT, and adopt the redaction so the next save carries the mark rather
      // than rebuilding a zero over the stored figure. Deliberately does NOT navigate away — in
      // edit mode a `replace("/dashboard")` here would be the silence this ruling forbids.
      //
      // ⚠️ `incomeRefused` is the SERVER's own answer and this must never go back to inferring one
      // from the returned household: a save that DECLARES the arrangement is redacted in its own
      // response and refused nothing, and `R-1` measured that inference firing on 100% of them.
      const refused = incomeRefusedNotice(saved);
      if (refused) {
        setState((s) => ({ ...s, incomeRedacted: true, income: "" }));
        setNotice(refused);
        setIndex(Math.max(0, steps.indexOf("income")));
        if (typeof window !== "undefined") window.scrollTo({ top: 0 });
        return;
      }
      // ── `CC_UX_BUILD` item 4 — **THE ANSWER POSTS AFTER COMPLETION, NEVER INSIDE THE PAYLOAD.**
      //
      // `buildOnboardingPayload`'s `profile` still carries no `separateAccounts` key and
      // `model.test.ts` still pins that — §A60's ruling is untouched. What the wizard's answer does
      // is drive the announcing route, here, once the household exists and has an id.
      //
      // 🔑 THIS ORDER IS THE ONLY ONE THAT WORKS, and it is a property of the server rather than a
      // preference. `carrySeparateAccounts` makes the whole-document baseline overwrite IGNORE
      // both arrangement keys for a household carrying a declaration stamp, and a wizard answer
      // that lands without one reads as UNDECLARED at every gate — *"an answer whose date nobody
      // can produce is a suggestion"*. So the baseline goes first and the arrangement second.
      //
      // ⚠️ EACH CALL FAILS ON ITS OWN AND SAYS SO. §A60: a refusal that looks like success is worse
      // than either outcome. The household HAS been created by this point, so the wizard does not
      // go backwards — it finishes, and the done screen names the surface that can complete what
      // did not land. Silence here would leave a household believing it is splitting when it is not,
      // which is the exact failure this whole run exists to close.
      // ⚠️ FIRST RUN ONLY, AND `?mode=edit` IS THE CASE THAT MATTERS. In edit mode the household
      // already exists and may already be DECLARED with two adults named, so posting the pending
      // one-share shape would be refused `400 split.invalid` and the person would be told their
      // ratio failed to save when nothing was wrong with it. An existing household changes its
      // arrangement on `/settings/separate-accounts`, which is the only surface that can.
      if (!editMode && state.separateAccounts !== null && saved.household?.id && saved.user?.id) {
        const householdId = saved.household.id;
        const missed: string[] = [];
        const shareBp = pendingSplitBp(state.separateSharePct);
        if (state.separateAccounts === false) {
          try {
            await sepacct.saveConfig(householdId, { separateAccounts: false, defaultSplit: [] });
          } catch { missed.push("בחירת אופן ניהול הכסף"); }
        } else if (shareBp === null) {
          missed.push("יחס החלוקה");
        } else {
          try {
            // The PENDING shape: one share, naming the person who answered, with the counterpart
            // unnamed because the counterpart has not joined. The backend stores it and does NOT
            // declare; the declaration is minted when the second adult arrives and the remainder
            // becomes theirs.
            await sepacct.saveConfig(householdId, {
              separateAccounts: true,
              defaultSplit: [{ userId: saved.user.id, shareBp }]
            });
          } catch { missed.push("יחס החלוקה"); }
        }
        const income = agorotFromInput(String(state.ownIncome ?? ""));
        if (state.separateAccounts && income.ok && income.agorot !== null) {
          try {
            await sepacct.saveOwnIncome(householdId, income.agorot);
          } catch { missed.push("ההכנסה שלך"); }
        }
        if (missed.length > 0) {
          // ⚠️ THE VERB AGREES WITH THE COUNT. `missed.join(" ו")` with ONE item rendered
          // "יחס החלוקה לא נשמרו" — a plural verb on a singular subject, on the single most
          // anxious screen in the flow, in a sentence already telling somebody a money setting
          // did not save.
          const verb = missed.length === 1 ? "לא נשמר" : "לא נשמרו";
          setNotice(`הבית נוצר, אבל ${missed.join(" ו")} ${verb}. אפשר להשלים את זה בהגדרות, בעמוד ״הפרדת כספים״.`);
        }
      }
      if (editMode) {
        // Baseline updated — return to the dashboard (no first-time "done" celebration).
        router.replace("/dashboard");
        return;
      }
      if (userIdRef.current) clearDraft(userIdRef.current);
      goTo(Math.max(0, steps.indexOf("done")));
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
    goTo(Math.min(steps.length - 1, index + 1));
  }, [stepKey, state, index, goTo, submit]);

  const back = useCallback(() => {
    if (index === 0) return;
    goTo(Math.max(0, index - 1));
  }, [index, goTo]);

  const skip = useCallback(() => {
    if (!SKIPPABLE.has(stepKey)) return;
    if (stepKey === "alerts") { void submit(); return; }
    goTo(Math.min(steps.length - 1, index + 1));
  }, [stepKey, index, goTo, submit]);

  const primaryLabel =
    stepKey === "welcome" ? (editMode ? "ממשיכים" : "מתחילים")
    : stepKey === "alerts" ? (editMode ? "שמירת השינויים" : "סיום")
    : "המשך";
  const interactive = interactiveSteps(state, editMode);
  const stepIndex = interactive.indexOf(stepKey) + 1;

  return {
    ready,
    done: stepKey === "done",
    state,
    set,
    stepKey,
    stepIndex,
    stepCount: interactive.length,
    canSkip: SKIPPABLE.has(stepKey),
    primaryLabel,
    editMode,
    error,
    notice,
    working,
    householdType: state.householdType,
    completedHouseholdId,
    next,
    back,
    skip
  };
}

export { computeTotals };
