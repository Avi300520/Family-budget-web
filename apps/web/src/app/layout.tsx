import type { Metadata, Viewport } from "next";
import { Heebo, JetBrains_Mono } from "next/font/google";
import { SITE_URL } from "../lib/siteUrl";
import A11yBar from "../components/a11y/A11yBar";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-heebo",
  display: "swap"
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-jetbrains",
  display: "swap"
});

// viewport-fit=cover is required for env(safe-area-inset-*) to apply on notched
// devices (the bottom tab bar + "עוד" sheet pad against the home indicator).
// viewport-fit=cover is required for env(safe-area-inset-*) to apply on notched
// devices (the bottom tab bar + "עוד" sheet pad against the home indicator).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F766E"
};

const TITLE = "Pingtally | ניהול הוצאות, קבלות וקניות מתוך וואטסאפ";
const DESCRIPTION =
  "Pingtally עוזר לעשות סדר בהוצאות, קבלות, קניות ותקציבים מתוך WhatsApp - בלי סיסמה, בלי אפליקציה ובלי חיבור לחשבון בנק. מתאים לאדם אחד, זוג, משפחה או דירת שותפים.";

// Global defaults. metadataBase makes relative OG/twitter image URLs absolute.
// No title.template (legal pages already supply their own "... | Pingtally").
// Per-page canonical is set on the marketing routes (/, /login).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Pingtally",
  openGraph: {
    type: "website",
    siteName: "Pingtally",
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/`,
    locale: "he_IL",
    images: [{ url: "/og-pingtally.png", width: 1200, height: 630, alt: "Pingtally" }]
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-pingtally.png"]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${jetbrains.variable}`}>
      <body>
        {/* Next hoists rendered <link> tags into <head>; this shaves the TLS/DNS
            handshake off the first API call (~300ms est., PageSpeed Insights). */}
        <link rel="preconnect" href="https://api.pingtally.com" />
        {/* Skip link + accessibility menu. First child of <body> so the skip
            link is the first focusable element in the document (BATCH-GH). */}
        <A11yBar />
        {children}
      </body>
    </html>
  );
}
