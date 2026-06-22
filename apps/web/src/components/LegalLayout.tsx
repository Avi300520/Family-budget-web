import Link from "next/link";

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

      <article className="legal-body">{children}</article>

      <footer className="legal-foot">
        <Link href="/privacy">מדיניות פרטיות</Link>
        <span aria-hidden>·</span>
        <Link href="/terms">תנאי שימוש</Link>
        <span aria-hidden>·</span>
        <Link href="/login">חזרה לכניסה</Link>
      </footer>
    </div>
  );
}
