"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { api } from "../../lib/api";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(undefined);
    setStatus(undefined);
    const trimmed = phone.trim();
    if (!trimmed) {
      setError("המספר נראה לא תקין. בדקו את הקידומת והמספר ונסו שוב.");
      return;
    }
    setLoading(true);
    try {
      await api.requestMagicLink(trimmed);
      setStatus("הקישור בדרך אליכם 📩 פתחו את וואטסאפ והיכנסו בלחיצה.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לשלוח קישור כרגע. בדקו את המספר ונסו שוב.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <h1 className="login-hero-headline">פחות ניהול.<br />יותר משפחה.</h1>
        <p className="login-hero-sub">הוצאות, קניות, פרויקטים ובקשות מהילדים, הכל מתנהל בוואטסאפ.</p>
        <ul className="login-chips">
          <li>הוצאות וקבלות</li>
          <li>רשימות קניות</li>
          <li>פרויקטים משפחתיים</li>
          <li>בקשות מהילדים</li>
          <li>כל המשפחה במקום אחד</li>
        </ul>
      </section>
      <section className="login-box">
        <h2 className="page-title">נכנסים דרך וואטסאפ</h2>
        <p className="login-subtitle muted">נשלח לכם קישור כניסה מאובטח לוואטסאפ. בלי סיסמאות, בלי להוריד אפליקציה חדשה.</p>
        <form className="form" onSubmit={submit}>
          <label>
            מספר טלפון
            <input
              className="input"
              dir="ltr"
              type="tel"
              inputMode="tel"
              value={phone}
              autoComplete="tel"
              placeholder="+972501234567"
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <button className="button" type="submit" disabled={loading}>
            <Send size={18} aria-hidden />
            {loading ? "שולח..." : "שליחת קישור כניסה"}
          </button>
          {status && <div className="status">{status}</div>}
          {error && <div className="status error">{error}</div>}
        </form>
        <p className="login-footer muted" style={{ fontSize: 12, marginTop: 16 }}>
          בכניסה אתם מסכימים לתנאי השימוש ולמדיניות הפרטיות.
        </p>
      </section>
    </div>
  );
}
