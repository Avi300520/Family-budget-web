import { Heebo, JetBrains_Mono } from "next/font/google";
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

export const metadata = {
  title: "Pingtally | פחות ניהול. יותר משפחה.",
  description: "Pingtally עוזר למשפחות לנהל הוצאות, קניות, פרויקטים ובקשות מהילדים דרך וואטסאפ, עם דשבורד משפחתי פשוט וברור.",
  openGraph: {
    title: "Pingtally | פחות ניהול. יותר משפחה.",
    description: "Pingtally עוזר למשפחות לנהל הוצאות, קניות, פרויקטים ובקשות מהילדים דרך וואטסאפ, עם דשבורד משפחתי פשוט וברור.",
    locale: "he_IL"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
