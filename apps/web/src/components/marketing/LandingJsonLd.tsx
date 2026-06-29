// Structured data for the landing (server component, rendered into initial HTML).
// Organization + WebSite + SoftwareApplication (with pricing AggregateOffer and
// alternateName "קופה משפחתית") + FAQPage (the 12 curated items from faqData).
//
// Deliberately NO HowTo, NO AggregateRating/Review, NO certifications - none are
// truthfully supportable (see docs/marketing/CLAIMS_ALLOWLIST.md). Treat FAQPage
// as AI/LLM citation support, not a guaranteed Google rich result.

import { SITE_URL } from "../../lib/siteUrl";
import { FAQ_SCHEMA_ITEMS } from "./faqData";

const APP_DESCRIPTION =
  "Pingtally עוזר לעשות סדר בהוצאות, קבלות, קניות ותקציבים מתוך WhatsApp - בלי סיסמה, בלי אפליקציה ובלי חיבור לחשבון בנק. מתאים לאדם אחד, זוג, משפחה או דירת שותפים.";

export function LandingJsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Pingtally",
        alternateName: "קופה משפחתית",
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/pingtally-icon.png`,
        email: "office@pingtally.com",
        areaServed: "IL",
        contactPoint: {
          "@type": "ContactPoint",
          email: "office@pingtally.com",
          contactType: "customer support",
          availableLanguage: ["he"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: "Pingtally",
        inLanguage: "he-IL",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: "Pingtally",
        alternateName: "קופה משפחתית",
        applicationCategory: "FinanceApplication",
        operatingSystem: "WhatsApp, Web",
        inLanguage: "he-IL",
        url: `${SITE_URL}/`,
        description: APP_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "ILS",
          lowPrice: "19.90",
          highPrice: "39.90",
          offerCount: 3,
          offers: [
            { "@type": "Offer", name: "אישי / זוגי", price: "19.90", priceCurrency: "ILS" },
            { "@type": "Offer", name: "משפחה", price: "29.90", priceCurrency: "ILS" },
            { "@type": "Offer", name: "משפחה 4+", price: "39.90", priceCurrency: "ILS" },
          ],
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: FAQ_SCHEMA_ITEMS.map((i) => ({
          "@type": "Question",
          name: i.q,
          acceptedAnswer: { "@type": "Answer", text: i.a },
        })),
      },
    ],
  };

  // Static, developer-authored content (no user input). Escape "<" to < so a
  // "</script>" / "<!--" breakout is impossible regardless of content - the
  // recommended hardening for inline JSON-LD.
  const json = JSON.stringify(graph).replace(/</g, "\\u003c");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
