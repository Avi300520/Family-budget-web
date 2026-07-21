// BATCH-GI F-B / WCAG 4.1.3 (Status Messages) — one polite live region for the whole app.
//
// The audit found that no async result anywhere announces itself: adding an item, marking one
// bought, creating a budget, saving settings and closing a shopping trip were all silent to a
// screen reader. A sighted user sees the row move; nobody else gets anything.
//
// Use this ONLY where there is no visible textual echo with a stable host element. Where a
// component already renders its own `<span className="sr-only" role="status">` (the idiom in
// auth/consume, /join and /onboarding) keep that — it is cheaper and needs no import. This
// module exists for the two cases that idiom cannot serve: the whole view is replaced by the
// action (/l completion), or the element that would host the region unmounts moments later
// (the settings save bar).
//
// ponytail: no provider, no context, no React at all. A module-level DOM node created on first
// use is the whole feature. Ceiling — a single polite queue, so two announcements inside 100ms
// coalesce; if two independent regions are ever genuinely needed, that is the upgrade path.

const REGION_ID = "a11y-announcer";

// A live region must already be in the accessibility tree BEFORE the mutation it reports —
// a region inserted together with its first message is frequently dropped, especially by
// VoiceOver/Safari, which is the primary engine on /l. So `ensureLiveRegion()` is called once
// on mount from the site-wide A11yBar and this stays a lazy fallback for anything that somehow
// announces first. Appending from an effect runs after hydration, so there is no SSR mismatch.
export function ensureLiveRegion(): void {
  region();
}

function region(): HTMLElement | null {
  if (typeof document === "undefined") return null; // SSR / prerender
  const existing = document.getElementById(REGION_ID);
  if (existing) return existing;
  const el = document.createElement("div");
  el.id = REGION_ID;
  el.className = "sr-only";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "true");
  document.body.appendChild(el);
  return el;
}

/**
 * Speak `message` politely (after whatever the screen reader is currently saying).
 *
 * The blank-then-set on a later task is load-bearing twice over: writing the SAME text again is
 * not a DOM mutation, so a repeated message (bought, undo, bought) would be announced once and
 * then never again; and a region created and populated in the same task is often not yet in the
 * accessibility tree, so its first message is dropped. One timeout fixes both.
 */
export function announce(message: string): void {
  const el = region();
  if (!el) return;
  el.textContent = "";
  window.setTimeout(() => {
    el.textContent = message;
  }, 100);
}
