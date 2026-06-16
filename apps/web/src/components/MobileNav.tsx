"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, MoreHorizontal, type LucideIcon } from "lucide-react";
import { selectPrimary, groupMore } from "../lib/mobileNav";

// A nav destination, identical in shape to AppShell's NavLink (single source of
// truth — AppShell passes its already role-filtered links straight in, so the
// mobile bar can NEVER show something the desktop nav/role gate would hide).
export interface MobileNavLink {
  href: string;
  label: string;
  /** Optional shorter label for the compact bottom tab (falls back to label). */
  short?: string;
  icon: LucideIcon;
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({ links, onLogout }: { links: MobileNavLink[]; onLogout?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on route change (selection navigates → pathname changes).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape; return focus to the trigger. Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const primary = selectPrimary(links);
  const grouped = groupMore(links, primary);
  const moreActive = open || grouped.some((g) => g.items.some((l) => isActive(pathname, l.href)));

  return (
    <>
      <nav className="bottom-tab-bar" aria-label="ניווט תחתון">
        {primary.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="bottom-tab"
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
            >
              <Icon size={20} aria-hidden />
              <span className="bottom-tab-label">{link.short ?? link.label}</span>
            </Link>
          );
        })}
        <button
          ref={moreButtonRef}
          type="button"
          className="bottom-tab bottom-tab-more"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-current={moreActive ? "page" : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="bottom-tab-more-icon" aria-hidden>
            <MoreHorizontal size={20} />
          </span>
          <span className="bottom-tab-label">עוד</span>
        </button>
      </nav>

      {open && (
        <>
          <div className="mobile-more-backdrop" onClick={close} aria-hidden />
          <div className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="תפריט">
            <div className="mobile-more-handle">
              <span className="mobile-more-grip" aria-hidden />
              <button ref={closeButtonRef} type="button" className="btn ghost mobile-more-close" onClick={close} aria-label="סגירה">
                ✕
              </button>
            </div>
            {grouped.map((group) => (
              <div className="mobile-more-group" key={group.title}>
                <div className="label mobile-more-group-title">{group.title}</div>
                <div className="mobile-more-links">
                  {group.items.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="mobile-more-link"
                        aria-current={isActive(pathname, link.href) ? "page" : undefined}
                        onClick={close}
                      >
                        <Icon size={18} aria-hidden />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                  {/* Logout lives under the חשבון group (wired in Phase 2). */}
                  {group.title === "חשבון" && onLogout && (
                    <button
                      type="button"
                      className="mobile-more-link mobile-more-logout"
                      onClick={() => {
                        close();
                        onLogout();
                      }}
                    >
                      <LogOut size={18} aria-hidden />
                      <span>התנתקות</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
