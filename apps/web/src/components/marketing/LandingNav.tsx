"use client";

// Sticky landing nav. Burger stays available at 320px (the CTA button collapses
// below 360px but navigation never disappears - responsive-proof requirement).

import { useState } from "react";
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
            type="button"
            className="pt-burger"
            aria-label={open ? "סגירת תפריט" : "פתיחת תפריט"}
            aria-expanded={open}
            aria-controls="pt-mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
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
