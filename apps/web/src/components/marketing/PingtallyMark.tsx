// Pingtally master brand mark + lockup (server component, pure SVG).
// MarkBubbleBars: a teal WhatsApp-style chat bubble (with a tail) holding three
// ascending cream "tally" bars - message in, counted, ordered. This is the
// owner-approved Pingtally identity; it replaces the deprecated "ק" tile.

const CREAM = "#FBF8F1";

export function PingtallyMark({
  size = 38,
  bubble = "var(--teal, #0F766E)",
}: {
  size?: number;
  bubble?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      role="img"
      aria-label="Pingtally"
      focusable="false"
    >
      {/* bubble body */}
      <rect x="3" y="3" width="38" height="32" rx="11" fill={bubble} />
      {/* tail (bottom-start) */}
      <path d="M14 33 L14 41 L23 33 Z" fill={bubble} />
      {/* three ascending tally bars, bottom-aligned */}
      <rect x="13" y="22" width="4.5" height="7" rx="2.25" fill={CREAM} />
      <rect x="19.75" y="18" width="4.5" height="11" rx="2.25" fill={CREAM} />
      <rect x="26.5" y="14" width="4.5" height="15" rx="2.25" fill={CREAM} />
    </svg>
  );
}

// Full lockup: mark + wordmark + Hebrew descriptor. `href` makes it a link.
export function PingtallyLockup({
  size = 38,
  showDesc = true,
}: {
  size?: number;
  showDesc?: boolean;
}) {
  return (
    <span className="pt-lockup">
      <PingtallyMark size={size} />
      <span className="pt-lockup__txt">
        <span className="pt-lockup__name">Pingtally</span>
        {showDesc && (
          <span className="pt-lockup__desc">ניהול כלכלת הבית מתוך וואטסאפ</span>
        )}
      </span>
    </span>
  );
}
