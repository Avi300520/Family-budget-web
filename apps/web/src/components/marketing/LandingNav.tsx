"use client";

// Sticky landing nav. Burger stays available at 320px (the CTA button collapses
// below 360px but navigation never disappears - responsive-proof requirement).

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { PingtallyLockup } from "./PingtallyMark";

const LINKS = [
  { href: "#outcomes", label: "מה זה פותר" },
  { href: "#how", label: "איך זה עובד" },
  { href: "#trust", label: "אבטחה ופרטיות" },
  { href: "#pricing", label: "מחיר" },
  { href: "#faq", label: "שאלות" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);

  // BATCH-GI F5 (2.1.2) — the authenticated shell already closes its drawer on Escape; the
  // landing did not, so a keyboard user who opened this menu had no way out but Tab-through.
  // Closing returns focus to the burger, which is what re-opens it (the disclosure contract).
  // Document-level, not onKeyDown on the header: the menu can be opened by pointer, leaving
  // focus on <body>, where a bubbling handler would never fire.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // defaultPrevented: the accessibility panel binds its own document Escape handler and marks
      // the event handled. Without this check, closing that panel on `/` also stole focus to the
      // burger here (both listeners are on `document`, so stopPropagation cannot separate them).
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      setOpen(false);
      burgerRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="pt-nav">
      <div className="pt-wrap pt-nav__in">
        <a href="#top" aria-label="Pingtally - לראש העמוד">
          <PingtallyLockup size={38} />
        </a>

        <nav className="pt-nav__links" aria-label="ניווט ראשי">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="pt-nav__cta">
          <span className="pt-nav__micro">
            בלי סיסמה · בלי אפליקציה
          </span>
          <a href="#start" className="pt-btn pt-btn--primary pt-btn--sm">
            מתחילים בחינם
          </a>
          <button
            ref={burgerRef}
            type="button"
            className="pt-burger"
            aria-label={open ? "סגירת תפריט" : "פתיחת תפריט"}
            aria-expanded={open}
            aria-controls="pt-mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {/* aria-hidden is safe here: the button's name comes from its
                aria-label above, so hiding the glyph never leaves it nameless. */}
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className="pt-mobile-menu" id="pt-mobile-menu" data-open={open}>
        <div className="pt-wrap">
          <nav aria-label="ניווט נייד">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
            <a href="#start" onClick={() => setOpen(false)}>
              מתחילים בחינם
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
