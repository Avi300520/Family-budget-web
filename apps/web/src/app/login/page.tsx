"use client";

import { Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "../../lib/api";

const COUNTRY_CODES = [
  { code: "+972", label: "🇮🇱 +972" },
  { code: "+1",   label: "🇺🇸 +1"   },
  { code: "+44",  label: "🇬🇧 +44"  },
  { code: "+33",  label: "🇫🇷 +33"  },
  { code: "+49",  label: "🇩🇪 +49"  },
];

function normalizePhone(countryCode: string, local: string): string {
  const digits = local.replace(/\D/g, "");
  const stripped = digits.startsWith("0") ? digits.slice(1) : digits;
  return `${countryCode}${stripped}`;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [countryCode, setCountryCode] = useState("+972");
  const [localPhone, setLocalPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading || status) return;
    setError(undefined);
    setStatus(undefined);

    const digits = localPhone.replace(/\D/g, "");
    if (digits.length < 7) {
      setError("המספר נראה לא תקין. בדקו את הקידומת והמספר ונסו שוב.");
      return;
    }

    const fullPhone = normalizePhone(countryCode, localPhone);
    const next = searchParams.get("next") ?? undefined;

    setLoading(true);
    try {
      await api.requestMagicLink(fullPhone, next);
      setStatus("שלחנו לך קישור לוואטסאפ — לחץ עליו כדי להיכנס.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "לא הצלחנו לשלוח קישור כרגע. בדקו את המספר ונסו שוב."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-box">
        <h1 className="page-title">כניסה דרך WhatsApp</h1>
        <form className="form" onSubmit={submit}>
          <label>
            מספר טלפון
            <div style={{ display: "flex", gap: 8 }}>
              <select
                className="input"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                style={{ flex: "0 0 auto", width: 110 }}
                dir="ltr"
                aria-label="קוד מדינה"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <input
                className="input"
                dir="ltr"
                type="tel"
                inputMode="tel"
                value={localPhone}
                autoComplete="tel-national"
                placeholder="050-123-4567"
                onChange={(e) => setLocalPhone(e.target.value)}
                style={{ flex: 1 }}
                aria-label="מספר טלפון"
              />
            </div>
          </label>
          <button className="button" type="submit" disabled={loading || !!status}>
            <Send size={18} aria-hidden />
            {loading ? "שולח..." : "שליחת קישור"}
          </button>
          {status && <div className="status">{status}</div>}
          {error && <div className="status error">{error}</div>}
        </form>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
