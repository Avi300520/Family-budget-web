"use client";

// Reusable onboarding controls — typed TSX ports of the design-system prototype
// primitives. Visuals reference the same CSS variable tokens the rest of the site
// uses (tokens.css). Inline styles (as in the prototype) keep these self-contained
// and avoid global-CSS import constraints in the app router.

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import type { FrequencyId } from "@shopping-assistant/shared-types";
import { FREQUENCIES } from "../../lib/onboarding/model";
import { parseMoneyInput } from "../../lib/moneyInput";

const focusBorder = (on: boolean) => (on ? "var(--teal)" : "var(--cream-4)");

// ── Stepper (− value +) ────────────────────────────────────────────────────────
export function Stepper({ value, onChange, min = 0, max = 12, suffix }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  const btn: CSSProperties = {
    width: 38, height: 38, borderRadius: 10, border: "1.5px solid var(--cream-4)",
    background: "var(--cream-2)", color: "var(--text-0)", fontSize: 20, fontWeight: 600,
    display: "grid", placeItems: "center", cursor: "pointer", lineHeight: 1, userSelect: "none"
  };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
      <button type="button" style={{ ...btn, opacity: value <= min ? 0.4 : 1 }} onClick={() => set(value - 1)} aria-label="פחות">−</button>
      <div style={{ minWidth: 48, textAlign: "center" }}>
        <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{value}</span>
        {suffix && <span style={{ fontSize: 13, color: "var(--text-2)", marginInlineStart: 4 }}>{suffix}</span>}
      </div>
      <button type="button" style={{ ...btn, opacity: value >= max ? 0.4 : 1 }} onClick={() => set(value + 1)} aria-label="עוד">+</button>
    </div>
  );
}

// ── ChipSelect (single or multi) ───────────────────────────────────────────────
type ChipOption = string | { id: string; label: string; emoji?: string };
export function ChipSelect({ options, value, onChange, multi = false }: {
  options: ReadonlyArray<ChipOption>;
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) {
  const arr = Array.isArray(value) ? value : [];
  const isOn = (v: string) => (multi ? arr.includes(v) : value === v);
  const toggle = (v: string) => {
    if (!multi) return onChange(v);
    onChange(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.id;
        const lab = typeof o === "string" ? o : o.label;
        const emoji = typeof o === "string" ? undefined : o.emoji;
        const on = isOn(val);
        return (
          <button type="button" key={val} onClick={() => toggle(val)} aria-pressed={on} style={{
            display: "inline-flex", alignItems: "center", gap: 7, minHeight: 40, padding: "0 16px",
            borderRadius: 999, cursor: "pointer", fontSize: 14, fontWeight: 600,
            border: on ? "1.5px solid var(--teal)" : "1.5px solid var(--cream-4)",
            background: on ? "var(--teal-bg)" : "var(--cream-2)",
            color: on ? "var(--teal-dark)" : "var(--text-1)"
          }}>
            {emoji && <span style={{ fontSize: 16 }}>{emoji}</span>}
            {lab}
            {multi && on && <span style={{ fontSize: 13 }}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── OptionCards — big selectable cards ─────────────────────────────────────────
export function OptionCards({ options, value, onChange, cols = 2 }: {
  options: ReadonlyArray<{ id: string; emoji?: string; title?: string; label?: string; sub?: string }>;
  value: string;
  onChange: (id: string) => void;
  cols?: number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 12 }}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button type="button" key={o.id} onClick={() => onChange(o.id)} aria-pressed={on} style={{
            textAlign: "start", padding: 16, borderRadius: 16, cursor: "pointer",
            border: on ? "2px solid var(--teal)" : "1.5px solid var(--cream-4)",
            background: on ? "var(--teal-bg)" : "var(--cream-2)",
            boxShadow: on ? "var(--elev-2)" : "none",
            display: "flex", flexDirection: "column", gap: 6
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 26 }}>{o.emoji}</span>
              <span style={{
                width: 22, height: 22, borderRadius: 999, flexShrink: 0,
                border: on ? "none" : "1.5px solid var(--cream-4)",
                background: on ? "var(--teal)" : "transparent",
                display: "grid", placeItems: "center", color: "#fff", fontSize: 13
              }}>{on ? "✓" : ""}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--text-0)" }}>{o.title || o.label}</div>
            {o.sub && <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45 }}>{o.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}

// ── Toggle switch ──────────────────────────────────────────────────────────────
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label} style={{
      width: 46, height: 28, borderRadius: 999, border: "none", padding: 3, cursor: "pointer",
      background: on ? "var(--teal)" : "var(--cream-4)", flexShrink: 0, display: "flex",
      justifyContent: on ? "flex-end" : "flex-start", transition: "background var(--dur-2) var(--ease)"
    }}>
      <span style={{ width: 22, height: 22, borderRadius: 999, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

// ── MiniToggle — inline label + small switch ───────────────────────────────────
export function MiniToggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-1)" }}>
      <Toggle on={on} onChange={onChange} label={label} />
      <span>{label}</span>
    </label>
  );
}

// ── MoneyInput (₪ prefixed, mono, LTR digits) ──────────────────────────────────
export function MoneyInput({ value, onChange, placeholder = "0", autoFocus = false, size = "md" }: {
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  autoFocus?: boolean;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus && ref.current) ref.current.focus(); }, [autoFocus]);
  // Local text buffer: a mid-typing value like "89." parses to 89, and re-deriving the
  // display from that number would erase the "." the user just typed. So we keep the raw
  // (normalized) text and only re-sync from `value` when the parent diverges from what the
  // buffer parses to (external prefill / reset) — during typing they track, so it's a no-op.
  const fmt = (v: number | "") => (v === 0 || v ? String(v) : "");
  const [text, setText] = useState<string>(() => fmt(value));
  useEffect(() => {
    if (parseMoneyInput(text) !== value) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const h = size === "lg" ? 58 : 48;
  const fs = size === "lg" ? 24 : 18;
  return (
    // direction:ltr keeps the ₪ prefix (insetInlineStart) and the input's
    // paddingInlineStart on the SAME (left) side, so the glyph never overlaps the
    // right-aligned digits in the RTL page.
    <div style={{ position: "relative", width: "100%", direction: "ltr" }}>
      <span className="mono" aria-hidden style={{
        position: "absolute", insetInlineStart: 14, top: "50%", transform: "translateY(-50%)",
        color: "var(--text-2)", fontSize: fs, pointerEvents: "none"
      }}>₪</span>
      <input
        ref={ref}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          setText(next.replace(/[^\d.]/g, "").match(/^\d*\.?\d*/)?.[0] ?? "");
          onChange(parseMoneyInput(next));
        }}
        className="mono"
        style={{
          width: "100%", height: h, paddingInlineStart: 34, paddingInlineEnd: 14,
          fontSize: fs, fontWeight: 700, direction: "ltr", textAlign: "end",
          borderRadius: 14, border: "1.5px solid var(--cream-4)", background: "var(--cream-2)",
          color: "var(--text-0)", outline: "none"
        }}
        onFocus={(e) => { e.target.style.borderColor = focusBorder(true); }}
        onBlur={(e) => { e.target.style.borderColor = focusBorder(false); }}
      />
    </div>
  );
}

// ── DayChips — pick a day-of-month (1–28) ──────────────────────────────────────
export function DayChips({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const quick = [1, 5, 10, 15, 25];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {quick.map((d) => {
        const on = value === d;
        return (
          <button type="button" key={d} onClick={() => onChange(d)} style={{
            minWidth: 44, height: 40, padding: "0 12px", borderRadius: 12, cursor: "pointer",
            border: on ? "1.5px solid var(--teal)" : "1.5px solid var(--cream-4)",
            background: on ? "var(--teal-bg)" : "var(--cream-2)",
            color: on ? "var(--teal-dark)" : "var(--text-1)", fontWeight: 700,
            fontFamily: "var(--font-mono)", fontSize: 15
          }}>{d}</button>
        );
      })}
    </div>
  );
}

// ── FreqPick — frequency segmented control ─────────────────────────────────────
export function FreqPick({ value, onChange }: { value: FrequencyId; onChange: (v: FrequencyId) => void }) {
  return (
    <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, background: "var(--cream-1)", padding: 4, borderRadius: 12 }}>
      {FREQUENCIES.map((f) => {
        const on = value === f.id;
        return (
          <button type="button" key={f.id} onClick={() => onChange(f.id)} aria-pressed={on} style={{
            height: 32, padding: "0 12px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600,
            border: "none", background: on ? "var(--cream-2)" : "transparent",
            color: on ? "var(--teal-dark)" : "var(--text-2)",
            boxShadow: on ? "var(--elev-1)" : "none"
          }}>{f.labelHe}</button>
        );
      })}
    </div>
  );
}

// ── Field — label + helper wrapper ─────────────────────────────────────────────
export function Field({ label, hint, children, style }: {
  label?: string; hint?: string; children: ReactNode; style?: CSSProperties;
}) {
  return (
    <div style={style}>
      {label && <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-0)", marginBottom: hint ? 4 : 8 }}>{label}</div>}
      {hint && <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 12, lineHeight: 1.5 }}>{hint}</div>}
      {children}
    </div>
  );
}

// ── TextInput — plain RTL text field (reuses the site .input class) ────────────
export function TextInput({ value, onChange, placeholder, autoComplete }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) {
  return (
    <input
      className="input"
      value={value}
      placeholder={placeholder}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      style={{ fontSize: 16 /* avoid iOS zoom */ }}
    />
  );
}
