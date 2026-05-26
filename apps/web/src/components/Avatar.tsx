/**
 * Avatar — coloured circle showing member initials.
 *
 * Usage:
 *   <Avatar memberId={m.userId} displayName={m.displayName} />
 *   <Avatar memberId={m.userId} displayName={m.displayName} size="lg" />
 *   <Avatar memberId={m.userId} displayName={m.displayName} colorKey={m.color} />
 *
 * Sizes: sm (24px) | md (32px, default) | lg (44px) | xl (60px)
 *
 * From Iteration 6: pass `colorKey` (from DB-stored HouseholdMember.color) to use
 * the persisted colour. Falls back to deterministic hash when colorKey is absent.
 */

import type { MemberColorKey } from "../styles/tokens";
import { colorFor } from "../styles/members";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  /** Household member's userId — used for deterministic colour fallback */
  memberId: string;
  /** Display name — first 1-2 letters shown as initials */
  displayName?: string;
  /** DB-backed colour key (HouseholdMember.color). When present, overrides the hash. */
  colorKey?: string | null;
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
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({
  memberId,
  displayName,
  colorKey,
  size = "md",
  ariaLabel,
  className = "",
  style
}: AvatarProps) {
  const color = colorFor(memberId, (colorKey as MemberColorKey | null) ?? null);
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
