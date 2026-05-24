"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import { useState } from "react";
import { api } from "../../lib/api";

export default function LoginPage() {
  const [phone, setPhone] = useState("+972501234567");
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);
    try {
      await api.requestMagicLink(phone);
      setStatus("קישור נשלח ל-Dev inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחת קישור");
    }
  }

  return (
    <div className="login-page">
      <section className="login-box">
        <h1 className="page-title">כניסה דרך WhatsApp</h1>
        <form className="form" onSubmit={submit}>
          <label>
            טלפון
            <input className="input" dir="ltr" type="tel" value={phone} autoComplete="tel" onChange={(event) => setPhone(event.target.value)} />
          </label>
          <button className="button" type="submit">
            <Send size={18} aria-hidden />
            שליחת קישור
          </button>
          {status && <div className="status">{status}</div>}
          {error && <div className="status error">{error}</div>}
          <Link className="dev-link" href="/dev-inbox">
            פתיחת Dev inbox
          </Link>
        </form>
      </section>
    </div>
  );
}
