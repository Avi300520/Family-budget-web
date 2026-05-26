/**
 * Avatar — coloured circle showing member initials.
 *
 * Usage:
 *   <Avatar memberId={m.userId} displayName={m.displayName} />
 *   <Avatar memberId={m.userId} displayName={m.displayName} size="lg" />
 *
 * Sizes: sm (24px) | md (32px, default) | lg (44px) | xl (60px)
 *
 * Color is derived deterministically from memberId via colorFor() in
 * members.ts — stable across SSR/CSR, no flicker.  Iteration 6 will
 * switch to DB-stored colours; the API shape change is backward-compatible.
 */

import { colorFor } from "../styles/members";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  /** Household member's userId — used for deterministic colour lookup */
  memberId: string;
  /** Display name — first 1-2 letters shown as initials */
  displayName?: string;
  /** Circle diameter. Default "md" (32px). */
  size?: AvatarSize;
  /** Accessible label override. Defaults to displayName. */
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

function initials(name?: string): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  // First letter of first word + first letter of last word
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({
  memberId,
  displayName,
  size = "md",
  ariaLabel,
  className = "",
  style
}: AvatarProps) {
  const color = colorFor(memberId);
  const sizeClass = size === "md" ? "avatar" : `avatar ${size}`;
  const cls = className ? `${sizeClass} ${className}` : sizeClass;
  const label = ariaLabel ?? displayName ?? memberId;

  return (
    <span
      className={cls}
      style={{ background: color, ...style }}
      aria-label={label}
      title={displayName}
      role="img"
    >
      {initials(displayName)}
    </span>
  );
}
