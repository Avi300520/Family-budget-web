"use client";

import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { AppShell } from "../../components/AppShell";

export default function PrivacyPage() {
  return (
    <AppShell>
      <h1 className="page-title">פרטיות</h1>
      <section className="grid two">
        <div className="panel">
          <h2>
            <ShieldCheck size={18} aria-hidden /> קבלות
          </h2>
          <p className="muted">תמונות מקור נשמרות ב-private storage ונפתחות דרך signed URLs קצרי חיים בלבד.</p>
          <div className="status">Retention: 30 days</div>
        </div>
        <div className="panel">
          <h2>פעולות</h2>
          <div className="row">
            <button className="button secondary">
              <Download size={18} aria-hidden />
              Export
            </button>
            <button className="button warn">
              <Trash2 size={18} aria-hidden />
              Delete request
            </button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
