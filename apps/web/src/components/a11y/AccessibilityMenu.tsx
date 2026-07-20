"use client";

/**
 * Accessibility menu (BATCH-GH / audit P0-1).
 *
 * The Israeli accessibility statement promises "שינוי גודל הגופן ... באמצעות
 * תפריט הנגישות המצוי באתר" and no such widget existed. Audit §6 decided a
 * hand-built panel over a third-party overlay (EqualWeb/UserWay): an overlay
 * cannot fix the concrete semantic defects the audit found, its heuristic
 * auto-contrast breaks RTL Hebrew, and it carries a recurring fee.
 *
 * All the styling hooks are already in app/globals.css:
 *   data-a11y-contrast="on" | data-a11y-motion="off" |
 *   data-a11y-links="on"    | data-a11y-font="on"
 * Font scaling is `zoom` on <html> (not a rem scale): this codebase sizes
 * everything in px (audit P2-13), so a root font-size change would move nothing.
 *
 * Non-modal disclosure by design: aria-modal="false", NO focus trap and NO
 * roving tabindex. It is Tab-operable like the rest of the page; a trap on a
 * non-modal panel is a bug, not a feature.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Accessibility } from "lucide-react";
import "./a11y-menu.css";

type Prefs = {
  /** <html> zoom multiplier. */
  scale: number;
  contrast: boolean;
  /** true = animations stopped. */
  motion: boolean;
  links: boolean;
  font: boolean;
};

const STORAGE_KEY = "pingtally:a11y";
const DEFAULTS: Prefs = { scale: 1, contrast: false, motion: false, links: false, font: false };
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.6;
const STEP = 0.1;

// Static ids: the widget is mounted exactly once, in the root layout. Plain
// strings keep the aria-controls / aria-labelledby references readable and
// stable across SSR and hydration.
const PANEL_ID = "a11y-menu-panel";
const FONT_LABEL_ID = "a11y-menu-font-label";

/** 0.9 + 0.1 is 1.0000000000000002 in binary floating point; snap to one decimal. */
function snap(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampScale(n: number): number {
  return snap(Math.min(MAX_SCALE, Math.max(MIN_SCALE, n)));
}

function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULTS;
    return {
      scale: typeof parsed.scale === "number" && isFinite(parsed.scale) ? clampScale(parsed.scale) : 1,
      contrast: parsed.contrast === true,
      motion: parsed.motion === true,
      links: parsed.links === true,
      font: parsed.font === true
    };
  } catch {
    return DEFAULTS;
  }
}

function writePrefs(prefs: Prefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* Safari private mode / storage disabled: preferences just do not persist. */
  }
}

function setFlag(el: HTMLElement, name: string, on: boolean, value: string): void {
  if (on) el.setAttribute(name, value);
  else el.removeAttribute(name);
}

function applyPrefs(prefs: Prefs): void {
  const root = document.documentElement;
  // setProperty/removeProperty rather than style.zoom: `zoom` is not in every
  // TS DOM lib version and this needs no cast.
  if (prefs.scale === 1) root.style.removeProperty("zoom");
  else root.style.setProperty("zoom", String(prefs.scale));
  setFlag(root, "data-a11y-contrast", prefs.contrast, "on");
  setFlag(root, "data-a11y-motion", prefs.motion, "off");
  setFlag(root, "data-a11y-links", prefs.links, "on");
  setFlag(root, "data-a11y-font", prefs.font, "on");
}

function Toggle({
  label,
  pressed,
  onToggle
}: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className="a11y-toggle" aria-pressed={pressed} onClick={onToggle}>
      <span>{label}</span>
      {/* aria-pressed already announces the state; the pill is a visual echo. */}
      <span className="a11y-toggle__state" aria-hidden="true">
        {pressed ? "פועל" : "כבוי"}
      </span>
    </button>
  );
}

export default function AccessibilityMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);

  // Hydration: localStorage is read AFTER mount, never during render, so the SSR
  // markup and the first client render are identical.
  useEffect(() => {
    const stored = readPrefs();
    setPrefs(stored);
    applyPrefs(stored);
  }, []);

  const update = useCallback((next: Prefs) => {
    setPrefs(next);
    applyPrefs(next);
    writePrefs(next);
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) launcherRef.current?.focus();
  }, []);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>("button");
    first?.focus();
  }, [open]);

  // Click/tap outside closes.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Node && wrapRef.current?.contains(target)) return;
      // 2.4.3 — the panel gets `hidden` on close. If focus is still inside it we
      // must move focus out first, or hiding its ancestor blurs it to <body> and
      // the next Tab restarts from the top of the document.
      const inPanel = panelRef.current?.contains(document.activeElement);
      close(Boolean(inPanel));
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  // Escape closes and returns focus. Bound at the document, not as onKeyDown on the
  // wrapper <div>: a keydown handler on a non-interactive element only fires while
  // focus is already inside the widget (so it would miss a stray focus), and it makes
  // the div a static element with an interaction handler (jsx-a11y correctly flags it).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const pct = Math.round(prefs.scale * 100);

  return (
    <div className="a11y-widget" ref={wrapRef}>
      <button
        type="button"
        ref={launcherRef}
        className="a11y-launcher"
        aria-label="תפריט נגישות"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <Accessibility size={24} strokeWidth={2} aria-hidden="true" focusable="false" />
      </button>

      <div
        id={PANEL_ID}
        ref={panelRef}
        className="a11y-panel"
        hidden={!open}
        role="dialog"
        aria-modal="false"
        aria-label="הגדרות נגישות"
      >
        <p className="a11y-panel__title">הגדרות נגישות</p>

        <span className="a11y-group__label" id={FONT_LABEL_ID}>
          גודל הגופן
        </span>
        <div className="a11y-stepper" role="group" aria-labelledby={FONT_LABEL_ID}>
          <button
            type="button"
            className="a11y-btn"
            aria-label="הקטנת גודל הגופן"
            onClick={() => update({ ...prefs, scale: clampScale(prefs.scale - STEP) })}
          >
            <span aria-hidden="true">א-</span>
          </button>
          {/* <output> is an implicit polite live region, so the new percentage is
              announced when the user steps the size. */}
          <output className="a11y-stepper__value" dir="ltr" aria-live="polite">
            {pct}%
          </output>
          <button
            type="button"
            className="a11y-btn"
            aria-label="הגדלת גודל הגופן"
            onClick={() => update({ ...prefs, scale: clampScale(prefs.scale + STEP) })}
          >
            <span aria-hidden="true">א+</span>
          </button>
          <button
            type="button"
            className="a11y-btn"
            aria-label="איפוס גודל הגופן"
            onClick={() => update({ ...prefs, scale: 1 })}
          >
            <span aria-hidden="true">א</span>
          </button>
        </div>

        <Toggle
          label="ניגודיות גבוהה"
          pressed={prefs.contrast}
          onToggle={() => update({ ...prefs, contrast: !prefs.contrast })}
        />
        <Toggle
          label="עצירת אנימציות"
          pressed={prefs.motion}
          onToggle={() => update({ ...prefs, motion: !prefs.motion })}
        />
        <Toggle
          label="הדגשת קישורים"
          pressed={prefs.links}
          onToggle={() => update({ ...prefs, links: !prefs.links })}
        />
        <Toggle
          label="גופן קריא"
          pressed={prefs.font}
          onToggle={() => update({ ...prefs, font: !prefs.font })}
        />

        <button type="button" className="a11y-reset" onClick={() => update({ ...DEFAULTS })}>
          איפוס הגדרות הנגישות
        </button>
      </div>
    </div>
  );
}
