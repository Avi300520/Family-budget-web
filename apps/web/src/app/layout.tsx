import "./globals.css";

export const metadata = {
  title: "עוזר הקניות המשפחתי",
  description: "WhatsApp-first grocery budget assistant"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
