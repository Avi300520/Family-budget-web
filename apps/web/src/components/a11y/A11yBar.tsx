"use client";

/**
 * Site-wide accessibility chrome (BATCH-GH).
 *
 * Mounted as the FIRST child of <body> in app/layout.tsx, so the skip link is
 * the first focusable element in the document on every route (audit §7: the
 * statement's skip-link claim was true on marketing only).
 *
 * The `.skip-link` styles live in app/globals.css (visually hidden until it
 * takes focus).
 */

import AccessibilityMenu from "./AccessibilityMenu";

export default function A11yBar() {
  // The href stays "#main" so the link works with JS disabled on any page that
  // has <main id="main">. The handler adds the fallback: pages whose <main> has
  // no id (and pages where the landmark is added later) still get a working
  // skip, and the target is made programmatically focusable so focus - not just
  // the scroll position - actually moves.
  const onSkip = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target =
      document.getElementById("main") ?? document.querySelector<HTMLElement>("main");
    if (!target) return;
    e.preventDefault();
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus();
    target.scrollIntoView();
  };

  return (
    <>
      <a className="skip-link" href="#main" onClick={onSkip}>
        דילוג לתוכן הראשי
      </a>
      <AccessibilityMenu />
    </>
  );
}
