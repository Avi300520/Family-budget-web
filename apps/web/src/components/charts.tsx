/**
 * charts.tsx — Family Budget internal chart library.
 *
 * All components:
 *   • Pure SVG (or CSS div) — zero external dependencies.
 *   • Fully typed in TypeScript — no `any`.
 *   • All colours from props or tokens.ts var(--…) strings.
 *   • Handle empty data, zero values, and single-point data without crash
 *     or invalid SVG (e.g. zero-length strokeDasharray).
 *   • Presentation only — no data fetching, no side effects.
 *
 * Exports:
 *   Donut, ProgressRing, Thermometer, BarsChart, StackedBar,
 *   Sparkline, ActivityHeatmap
 */

import React from "react";
import { colorFor } from "../styles/members";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  if (!isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/** Ensures a value is non-negative and finite (for chart quantitative data). */
function safePositiveNumber(val: number): number {
  if (!isFinite(val) || val < 0) return 0;
  return val;
}

function initials(name?: string): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ─── Donut ─────────────────────────────────────────────────────────────────────
/**
 * Multi-segment donut chart with optional centre label.
 *
 * @example
 * <Donut
 *   segments={[
 *     { value: 600, color: "var(--teal)",  label: "מזון"  },
 *     { value: 200, color: "var(--coral)", label: "בידור" },
 *   ]}
 *   totalLabel="נוצל"
 *   totalValue="800"
 *   totalSub="₪"
 * />
 */
export interface DonutSegment {
  value: number;
  color: string;
  label?: string;
}

export interface DonutProps {
  /** Outer diameter in px. Default 180. */
  size?: number;
  /** Ring width in px. Default 22. */
  thickness?: number;
  segments?: DonutSegment[];
  /** Small uppercase label above the centre number. */
  totalLabel?: string;
  /** Large centre number (formatted string, e.g. "4,230"). */
  totalValue?: string;
  /** Subscript below the centre number. */
  totalSub?: string;
  /** Accessibility label for the donut. Shown if provided. */
  ariaLabel?: string;
}

export function Donut({
  size = 180,
  thickness = 22,
  segments = [],
  totalLabel,
  totalValue,
  totalSub,
  ariaLabel,
}: DonutProps) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  // Sanitize segment values before calculating total
  const sanitized = segments.map((s) => ({
    ...s,
    value: safePositiveNumber(s.value),
  }));
  const total = sanitized.reduce((s, x) => s + x.value, 0) || 1;

  // Build arcs
  let acc = 0;
  const arcs = sanitized
    .filter((s) => s.value > 0)
    .map((s, i) => {
      const len = clamp((s.value / total) * c, 0.01, c - 0.01);
      const off = c - acc;
      acc += len;
      return { key: i, stroke: s.color, len, off };
    });

  const hasLabel = totalLabel || totalValue || totalSub;

  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden={!ariaLabel}
      >
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--cream-3)"
          strokeWidth={thickness}
        />
        {/* segments */}
        {arcs.map(({ key, stroke, len, off }) => (
          <circle
            key={key}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={off}
            strokeLinecap="butt"
          />
        ))}
        {/* empty-state full ring when no data */}
        {arcs.length === 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--cream-3)"
            strokeWidth={thickness}
            strokeDasharray={`${c * 0.08} ${c * 0.92}`}
            strokeLinecap="round"
            opacity={0.6}
          />
        )}
      </svg>
      {hasLabel && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          {totalLabel && (
            <div className="label" style={{ marginBottom: 4 }}>
              {totalLabel}
            </div>
          )}
          {totalValue && (
            <div
              className="mono"
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "var(--text-0)",
                letterSpacing: "-0.01em",
              }}
            >
              {totalValue}
            </div>
          )}
          {totalSub && (
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
              {totalSub}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ProgressRing ──────────────────────────────────────────────────────────────
/**
 * Single-value progress ring.  `value` is a fraction 0–1.
 * Pass children to render inside the ring.
 *
 * @example
 * <ProgressRing value={0.72} color="var(--teal)">
 *   <span className="mono" style={{ fontSize: 14 }}>72%</span>
 * </ProgressRing>
 */
export interface ProgressRingProps {
  size?: number;
  thickness?: number;
  /** Fraction 0–1. Clamped. */
  value?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  /** Accessibility label for the ring. Shown if provided. */
  ariaLabel?: string;
}

export function ProgressRing({
  size = 80,
  thickness = 8,
  value = 0,
  color = "var(--teal)",
  trackColor = "var(--cream-3)",
  children,
  ariaLabel,
}: ProgressRingProps) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = clamp(value, 0, 1);
  // minimum visible arc of 0.5% so it never collapses to nothing
  const arc = pct > 0 ? clamp(pct * c, 0.5, c) : 0;

  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden={!ariaLabel}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        {arc > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeDasharray={`${arc} ${c}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      {children && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Thermometer ───────────────────────────────────────────────────────────────
/**
 * Vertical thermometer fill — for project goal progress.
 * `pct` is a fraction 0–1.
 *
 * @example
 * <Thermometer pct={0.45} color="var(--coral)" height={120} />
 */
export interface ThermometerProps {
  /** Fraction 0–1. Clamped. */
  pct: number;
  color?: string;
  /** Total height including bulb. Default 140. */
  height?: number;
}

export function Thermometer({
  pct,
  color = "var(--teal)",
  height = 140,
}: ThermometerProps) {
  const p = clamp(pct, 0, 1);
  // Bulb is 28px, tube takes remaining height
  const bulbSize = 28;
  const tubeHeight = Math.max(height - bulbSize, 20);

  return (
    <div
      style={{
        position: "relative",
        width: 28,
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
      aria-label={`${Math.round(p * 100)}%`}
      role="meter"
      aria-valuenow={Math.round(p * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* tube */}
      <div
        style={{
          width: 16,
          height: tubeHeight,
          background: "var(--cream-3)",
          borderRadius: 999,
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-end",
          border: "1px solid var(--cream-4)",
        }}
      >
        {p > 0 && (
          <div
            style={{
              width: "100%",
              height: `${p * 100}%`,
              background: color,
              borderRadius: "999px 999px 0 0",
              transition: "height 400ms var(--ease)",
            }}
          />
        )}
      </div>
      {/* bulb */}
      <div
        style={{
          width: bulbSize,
          height: bulbSize,
          borderRadius: 999,
          background: p > 0 ? color : "var(--cream-3)",
          marginTop: -4,
          border: "3px solid var(--cream-2)",
          boxShadow: "var(--elev-1)",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

// ─── BarsChart ─────────────────────────────────────────────────────────────────
/**
 * Vertical bar chart — weekly/daily spending.
 *
 * @example
 * <BarsChart
 *   data={[
 *     { label: "א׳", value: 180, valueLabel: "180₪" },
 *     { label: "ב׳", value: 320, valueLabel: "320₪", highlight: true },
 *   ]}
 * />
 */
export interface BarsDatum {
  label: string;
  value: number;
  /** Formatted string shown above bar. Falls back to `value`. */
  valueLabel?: string;
  /** Whether to use the accent colour (vs muted). */
  highlight?: boolean;
}

export interface BarsChartProps {
  data?: BarsDatum[];
  height?: number;
  color?: string;
  /** Override max value (useful for consistent scale across charts). */
  max?: number;
  /** Accessibility label for the chart. Shown if provided. */
  ariaLabel?: string;
}

export function BarsChart({
  data = [],
  height = 140,
  color = "var(--teal)",
  max,
  ariaLabel,
}: BarsChartProps) {
  // Sanitize data values before processing
  const sanitized = data.map((d) => ({
    ...d,
    value: safePositiveNumber(d.value),
  }));

  if (sanitized.length === 0) {
    return (
      <div
        style={{
          height: height + 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label={ariaLabel || "אין נתונים"}
      >
        <span className="muted" style={{ fontSize: 13 }}>
          אין נתונים
        </span>
      </div>
    );
  }

  const maxVal = max || Math.max(...sanitized.map((d) => d.value), 1);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        height: height + 28,
      }}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      aria-hidden={!ariaLabel}
    >
      {sanitized.map((d, i) => {
        const barH = Math.max((d.value / maxVal) * height, d.value > 0 ? 4 : 2);
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
            title={`${d.label}: ${d.valueLabel ?? d.value}`}
          >
            <div
              className="mono"
              style={{ fontSize: 10, color: "var(--text-2)", fontWeight: 500 }}
            >
              {d.valueLabel ?? d.value}
            </div>
            <div
              style={{
                width: "100%",
                height: barH,
                borderRadius: 6,
                background: d.highlight ? color : "var(--cream-3)",
                border: d.highlight ? "none" : "1px solid var(--cream-4)",
                transition: "height 400ms var(--ease)",
              }}
            />
            <div style={{ fontSize: 11, color: "var(--text-2)" }}>
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── StackedBar ────────────────────────────────────────────────────────────────
/**
 * Horizontal stacked bar — per-category or per-member spending breakdown.
 *
 * @example
 * <StackedBar
 *   data={[
 *     { label: "מזון",  value: 600, color: "var(--teal)"  },
 *     { label: "דלק",   value: 200, color: "var(--coral)" },
 *   ]}
 * />
 */
export interface StackedBarDatum {
  label: string;
  value: number;
  color: string;
}

export interface StackedBarProps {
  data?: StackedBarDatum[];
  /** Bar height in px. Default 32. */
  height?: number;
  /** Border radius in px. Default 8. */
  radius?: number;
  /** Accessibility label for the bar. Shown if provided. */
  ariaLabel?: string;
}

export function StackedBar({
  data = [],
  height = 32,
  radius = 8,
  ariaLabel,
}: StackedBarProps) {
  // Sanitize data values before processing
  const sanitized = data.map((d) => ({
    ...d,
    value: safePositiveNumber(d.value),
  }));
  const total = sanitized.reduce((s, d) => s + d.value, 0) || 1;
  const nonZero = sanitized.filter((d) => d.value > 0);

  if (nonZero.length === 0) {
    return (
      <div
        style={{
          height,
          borderRadius: radius,
          background: "var(--cream-3)",
        }}
        aria-label={ariaLabel || "אין נתונים"}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        height,
        borderRadius: radius,
        overflow: "hidden",
        background: "var(--cream-3)",
      }}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      aria-hidden={!ariaLabel}
    >
      {nonZero.map((d, i) => (
        <div
          key={i}
          title={`${d.label}: ${d.value}`}
          style={{
            background: d.color,
            width: `${(d.value / total) * 100}%`,
            transition: "width 400ms var(--ease)",
            minWidth: 2,
          }}
        />
      ))}
    </div>
  );
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────
/**
 * Inline SVG line chart — shows a trend without axes.
 * Pass 2+ data points; single-point renders as a dot.
 *
 * @example
 * <Sparkline data={[120, 340, 280, 450, 390]} color="var(--teal)" />
 */
export interface SparklineProps {
  data?: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  /** Whether to fill the area under the line. */
  filled?: boolean;
  /** Accessibility label for the sparkline. Shown if provided. */
  ariaLabel?: string;
}

export function Sparkline({
  data = [],
  width = 80,
  height = 32,
  color = "var(--teal)",
  strokeWidth = 2,
  filled = false,
  ariaLabel,
}: SparklineProps) {
  const nonEmpty = data.filter((v) => isFinite(v));

  if (nonEmpty.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-label={ariaLabel}
        aria-hidden={!ariaLabel}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--cream-3)"
          strokeWidth={strokeWidth}
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  const min = Math.min(...nonEmpty);
  const max = Math.max(...nonEmpty);
  const range = max - min || 1;
  const pad = strokeWidth;

  const toX = (i: number) =>
    nonEmpty.length === 1
      ? width / 2
      : (i / (nonEmpty.length - 1)) * (width - pad * 2) + pad;

  const toY = (v: number) =>
    height - pad - ((v - min) / range) * (height - pad * 2);

  const points = nonEmpty.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

  // Closed path for fill: line points + baseline corners
  const fillPath = nonEmpty.length > 1
    ? `M${toX(0)},${toY(nonEmpty[0]!)} ` +
      nonEmpty.slice(1).map((v, i) => `L${toX(i + 1)},${toY(v)}`).join(" ") +
      ` L${toX(nonEmpty.length - 1)},${height} L${toX(0)},${height} Z`
    : "";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      style={{ overflow: "visible" }}
    >
      {filled && fillPath && (
        <path d={fillPath} fill={color} fillOpacity={0.12} />
      )}
      {nonEmpty.length === 1 ? (
        <circle cx={width / 2} cy={toY(nonEmpty[0]!)} r={strokeWidth * 1.5} fill={color} />
      ) : (
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

// ─── ActivityHeatmap ───────────────────────────────────────────────────────────
/**
 * Heatmap grid of last N days × family members.
 * Each cell's intensity = number of actions that day (0 = empty).
 *
 * @example
 * <ActivityHeatmap
 *   members={[
 *     { userId: "abc", displayName: "מיכל", counts: [0,2,1,3,0,4,1,2,0,1,3,2,1,0] },
 *   ]}
 * />
 */
export interface HeatmapMember {
  userId: string;
  displayName?: string;
  /** Pre-computed colour (e.g. from DB). Falls back to colorFor(userId). */
  color?: string;
  /** Activity count per day, oldest → newest. Length = days prop. */
  counts: number[];
}

export interface ActivityHeatmapProps {
  members?: HeatmapMember[];
  /** Number of days to show. Default 14. */
  days?: number;
}

/** Map intensity 0–4+ to an opacity level for the member colour. */
const HEAT_OPACITY: Record<number, number> = { 0: 0, 1: 0.2, 2: 0.45, 3: 0.7, 4: 1 };

export function ActivityHeatmap({
  members = [],
  days = 14,
}: ActivityHeatmapProps) {
  if (members.length === 0) {
    return (
      <div className="muted" style={{ fontSize: 13, padding: "8px 0" }}>
        אין נתוני פעילות
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {members.map((m) => {
        const memberColor = m.color ?? colorFor(m.userId);
        // Show last N days (newest), not first N (oldest)
        const counts = m.counts.slice(-days);
        // Pad with zeros if fewer than `days` entries
        const paddedCounts: number[] =
          counts.length < days
            ? [...Array(days - counts.length).fill(0), ...counts]
            : counts;

        return (
          <div
            key={m.userId}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            {/* member label */}
            <div
              style={{
                width: 72,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <span
                className="avatar sm"
                style={{ background: memberColor }}
                aria-hidden="true"
              >
                {initials(m.displayName)}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-1)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.displayName?.split(/\s+/)[0] ?? ""}
              </span>
            </div>
            {/* day cells */}
            <div style={{ display: "flex", gap: 3, flex: 1 }}>
              {paddedCounts.map((v, i) => {
                const intensity = HEAT_OPACITY[Math.min(v, 4)] ?? 1;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 18,
                      borderRadius: 3,
                      background:
                        intensity === 0 ? "var(--cream-3)" : memberColor,
                      opacity: intensity === 0 ? 1 : intensity,
                      transition: "opacity 200ms var(--ease)",
                    }}
                    title={`יום ${i + 1}: ${v} פעולות`}
                    aria-label={`יום ${i + 1}: ${v} פעולות`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
