"use client";

import Link from "next/link";
import { ExternalLink, RefreshCw, Receipt as ReceiptIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { Receipt, ReceiptStatus } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";
import { nis } from "../../lib/format";

// Raw ReceiptStatus enum → Hebrew chip. The frontend never composes its own
// status strings; this is the single mapping the history list reads from.
const STATUS_CHIP: Record<ReceiptStatus, { label: string; cls: string }> = {
  needs_review: { label: "ממתינה לבדיקה", cls: "chip mustard" },
  failed: { label: "קריאה נכשלה", cls: "chip coral" },
  processing: { label: "בעיבוד", cls: "chip ocean" },
  parsed: { label: "זוהתה", cls: "chip ocean" },
  uploaded: { label: "התקבלה", cls: "chip ocean" },
  confirmed: { label: "נקלטה", cls: "chip sage" },
  deleted: { label: "נמחקה", cls: "chip" },
};

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}

// WhatsApp brand mark (the channel receipts arrive through). Inline SVG so we
// can render the actual brand glyph in its brand green - lucide has no WhatsApp
// icon. Path matches the design handoff's window.Icons.Whatsapp.
const WHATSAPP_GREEN = "#25D366";
function WhatsappGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={WHATSAPP_GREEN}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.5 3.5A11 11 0 0 0 3.2 17.3L2 22l4.9-1.2a11 11 0 0 0 16.6-9.4 11 11 0 0 0-3-7.9z" />
      <path
        d="M9 8.5c-.4 0-.7.1-1 .5-.4.4-1.4 1.4-1.4 3.3 0 2 1.4 3.9 1.6 4.2.2.3 2.8 4.4 7 5.4.8.2 1.5.2 2 .1.7-.2 2-.8 2.3-1.6.3-.8.3-1.5.2-1.7-.1-.2-.4-.3-.8-.5-.4-.2-2.3-1.2-2.7-1.3-.4-.2-.7-.2-1 .2-.3.4-1 1.3-1.3 1.5-.2.3-.5.3-.9.1-.4-.2-1.6-.6-3-1.8-1.1-1-1.8-2.2-2-2.6-.2-.4 0-.6.2-.8.2-.2.4-.5.5-.7.2-.2.2-.4.4-.7.1-.2 0-.5 0-.7l-1-2.3c-.3-.7-.5-.6-.8-.6h-.6z"
        fill={WHATSAPP_GREEN}
      />
    </svg>
  );
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [error, setError] = useState<string>();

  async function load() {
    setError(undefined);
    try {
      await api.currentHousehold();
      setReceipts((await api.receipts()).receipts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת קבלות");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell>
      <div className="row between" style={{ alignItems: "flex-start", marginBottom: "var(--sp-5)" }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ margin: "0 0 4px" }}>קבלות</h1>
          <p className="muted" style={{ margin: 0 }}>צילום ושליחת קבלות בוואטסאפ, והשלמת הפרטים אוטומטית.</p>
        </div>
        <button className="btn sm" onClick={load} aria-label="רענון">
          <RefreshCw size={16} aria-hidden />
          רענון
        </button>
      </div>

      {error && <LoadState error={error} />}

      <section
        className="panel"
        style={{
          background: "var(--teal-bg)",
          borderColor: "var(--teal-soft)",
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-4)",
          marginBottom: "var(--sp-5)",
        }}
      >
        <div
          aria-hidden
          style={{
            display: "grid",
            placeItems: "center",
            width: 48,
            height: 48,
            flex: "none",
            borderRadius: "var(--r-3)",
            background: "#E7F8EE",
          }}
        >
          <WhatsappGlyph size={24} />
        </div>
        <div style={{ minWidth: 0 }}>
          <strong style={{ color: "var(--teal-dark)" }}>קבלות נקלטות מהוואטסאפ</strong>
          <div className="muted" style={{ marginTop: 4 }}>
            צלמו את הקבלה ושלחו לצ׳אט - נזהה את הסכום והפרטים אוטומטית. כאן רואים את ההיסטוריה.
          </div>
        </div>
      </section>

      <div className="list">
        {receipts.map((receipt) => {
          const chip = STATUS_CHIP[receipt.status] ?? { label: receipt.status, cls: "chip" };
          const amount = receipt.parsedJson?.totalAmount ?? 0;
          const date = formatDate(receipt.parsedJson?.purchaseDate ?? receipt.createdAt);
          const reviewHref = `/receipts/${receipt.id}/review`;
          return (
            <div className="item-card row between" key={receipt.id}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", minWidth: 0 }}>
                <div
                  aria-hidden
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 40,
                    height: 40,
                    flex: "none",
                    borderRadius: "var(--r-2)",
                    background:
                      "repeating-linear-gradient(135deg, var(--cream-1), var(--cream-1) 6px, var(--cream-3) 6px, var(--cream-3) 7px)",
                    color: "var(--text-3)",
                  }}
                >
                  <ReceiptIcon size={20} aria-hidden />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong>{receipt.parsedJson?.merchantName ?? "קבלה"}</strong>
                  <div
                    className="muted"
                    style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginTop: 4, flexWrap: "wrap" }}
                  >
                    <span className={chip.cls}>{chip.label}</span>
                    {date && <span>{date}</span>}
                    {amount > 0 && <span className="mono">{nis(amount)}</span>}
                  </div>
                </div>
              </div>
              {receipt.status === "failed" ? (
                <Link
                  className="btn sm"
                  href={reviewHref}
                  style={{ color: "var(--coral-dark)", borderColor: "var(--coral-soft)" }}
                >
                  <RefreshCw size={15} aria-hidden />
                  נסו שוב
                </Link>
              ) : (
                <Link className="btn sm primary" href={reviewHref}>
                  <ExternalLink size={16} aria-hidden />
                  פתיחה
                </Link>
              )}
            </div>
          );
        })}
        {!receipts.length && !error && <div className="panel muted">אין קבלות עדיין</div>}
      </div>
    </AppShell>
  );
}
