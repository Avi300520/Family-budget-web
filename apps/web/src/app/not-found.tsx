import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הדף לא נמצא | Pingtally",
  robots: { index: false, follow: false },
};

// Server component, no client JS — reuses the same .legal-* classes as the
// public legal pages (LegalLayout) so the branded shell is consistent.
export default function NotFound() {
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
        <h1 className="legal-title">הדף לא נמצא</h1>
      </header>

      <main id="main" className="legal-body">
        <p>העמוד שחיפשתם לא קיים או שהוסר.</p>
        <p>
          <Link href="/">חזרה לדף הבית</Link>
        </p>
      </main>
    </div>
  );
}
