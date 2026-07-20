import Link from "next/link";
import { Suspense } from "react";
import { LegalTopNav } from "./LegalTopNav";

/**
 * Standalone wrapper for the public legal pages (/privacy, /terms).
 *
 * Deliberately NOT wrapped in <AppShell>: these pages must render for anyone,
 * logged in or not. They call no auth guard and no /me, so they stay public and
 * read like a plain legal document rather than the authenticated dashboard.
 */
export function LegalLayout({
  title,
  lastUpdated,
  pdfHref,
  pdfLabel,
  children,
}: {
  title: string;
  lastUpdated: string;
  pdfHref: string;
  pdfLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="legal-page">
      {/* Suspense: useSearchParams in the client island; the page still prerenders. */}
      <Suspense fallback={null}>
        <LegalTopNav />
      </Suspense>
      <header className="legal-head">
        <Link href="/" className="legal-brand">
          <span className="legal-brand__mark">P</span>
          <span>
            <span className="legal-brand__name">קופה משפחתית</span>
            <span className="legal-brand__sub">Pingtally</span>
          </span>
        </Link>
        <h1 className="legal-title">{title}</h1>
        <div className="legal-meta">
          <span>עדכון אחרון: {lastUpdated}</span>
          <a href={pdfHref} target="_blank" rel="noopener noreferrer">{pdfLabel}</a>
        </div>
      </header>

      {/* a11y (P1-5, WCAG 1.3.1): the legal body IS the page's primary content, so
          it is the <main> landmark. `id="main"` is the site-wide skip-link target.
          The former <article> wrapper carried no extra semantics here; .legal-body
          keeps every descendant style rule, so the rendered pixels are unchanged. */}
      <main id="main" className="legal-body">{children}</main>

      <footer className="legal-foot">
        <Link href="/privacy">מדיניות פרטיות</Link>
        <span aria-hidden>·</span>
        <Link href="/terms">תנאי שימוש</Link>
      </footer>
    </div>
  );
}
