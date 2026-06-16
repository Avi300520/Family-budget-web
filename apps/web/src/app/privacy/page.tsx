"use client";

import { ShieldCheck } from "lucide-react";
import { AppShell } from "../../components/AppShell";

export default function PrivacyPage() {
  return (
    <AppShell>
      <h1 className="page-title">פרטיות ותנאים</h1>
      <section className="grid two">
        <div className="panel">
          <h2>
            <ShieldCheck size={18} aria-hidden /> קבלות ופרטיות
          </h2>
          <p className="muted">
            תמונות הקבלה נשמרות באחסון פרטי ונפתחות רק דרך קישורים חתומים קצרי-תוקף.
          </p>
          <div className="status">שמירת תמונות: עד 30 יום</div>
        </div>
        <div className="panel">
          <h2>הנתונים שלך</h2>
          <p className="muted">
            לייצוא ההוצאות כקובץ CSV — היכנסו ל<strong>הגדרות → ייצוא נתונים</strong>.
          </p>
          <p className="muted">
            למחיקת נתונים או חשבון, פנו אלינו ונטפל בבקשה.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
