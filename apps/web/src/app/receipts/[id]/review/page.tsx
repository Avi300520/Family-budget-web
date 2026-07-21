"use client";

import { CheckCircle2, Save } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Receipt, ReceiptItem } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../../components/AppShell";
import { LoadState } from "../../../../components/LoadState";
import { api } from "../../../../lib/api";
import { apiBaseUrl } from "../../../../lib/apiBase";

export default function ReceiptReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [receipt, setReceipt] = useState<Receipt>();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [signedImageUrl, setSignedImageUrl] = useState<string>();
  const [merchantName, setMerchantName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [error, setError] = useState<string>();

  async function load() {
    try {
      const result = await api.receiptCorrection(params.id);
      setReceipt(result.receipt);
      setItems(result.items);
      setSignedImageUrl(result.signedImageUrl);
      setMerchantName(result.receipt.parsedJson?.merchantName ?? "");
      setPurchaseDate(result.receipt.parsedJson?.purchaseDate ?? "");
      setTotalAmount(result.receipt.parsedJson?.totalAmount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת קבלה");
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  function updateItem(index: number, field: keyof ReceiptItem, value: string | number) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  async function save() {
    await api.updateReceiptCorrection(params.id, {
      merchantName,
      purchaseDate,
      totalAmount,
      items: items.map((item) => ({
        id: item.id,
        rawLineText: item.rawLineText,
        normalizedProductName: item.normalizedProductName ?? item.rawProductName ?? item.rawLineText,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        status: item.status
      }))
    });
    await load();
  }

  async function confirm() {
    await save();
    await api.confirmReceipt(params.id);
    router.push("/dashboard");
  }

  // 1.3.1/2.4.6: every rendered state needs an <h1>. sr-only so no pixels move.
  if (error) return <AppShell><h1 className="sr-only">תיקון קבלה</h1><LoadState error={error} /></AppShell>;
  if (!receipt) return <AppShell><h1 className="sr-only">תיקון קבלה</h1><LoadState /></AppShell>;

  return (
    <AppShell>
      <h1 className="page-title">תיקון קבלה</h1>
      <section className="grid two">
        <div className="panel form">
          <label>
            חנות
            <input className="input" value={merchantName} onChange={(event) => setMerchantName(event.target.value)} />
          </label>
          <label>
            תאריך
            <input className="input" dir="ltr" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
          </label>
          <label>
            סך הכל
            <input className="input" type="number" value={totalAmount} onChange={(event) => setTotalAmount(Number(event.target.value))} />
          </label>
          <div className="row">
            <button className="button secondary" onClick={save}>
              <Save size={18} aria-hidden />
              שמירה
            </button>
            <button className="button" onClick={confirm}>
              <CheckCircle2 size={18} aria-hidden />
              אישור
            </button>
          </div>
        </div>
        <div className="panel">
          {signedImageUrl && <img alt="receipt" src={`${apiBaseUrl()}${signedImageUrl}`} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line)" }} />}
        </div>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>נתוני OCR</h2>
        <div className="list">
          <div className="row between">
            <span className="muted">סטטוס</span>
            <strong>{receipt.status}</strong>
          </div>
          <div className="row between">
            <span className="muted">ספק</span>
            <strong>{receipt.ocrProvider ?? "לא עובד עדיין"}</strong>
          </div>
          <div className="row between">
            <span className="muted">אמינות</span>
            <strong>{typeof receipt.confidenceScore === "number" ? `${Math.round(receipt.confidenceScore * 100)}%` : "לא זמין"}</strong>
          </div>
          {receipt.failureReason && <div className="status error">{receipt.failureReason}</div>}
          {receipt.ocrText ? (
            <textarea className="input" readOnly value={receipt.ocrText} rows={8} style={{ width: "100%", resize: "vertical" }} />
          ) : (
            <div className="muted">אין טקסט OCR אמיתי להצגה.</div>
          )}
        </div>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>שורות</h2>
        <div className="list">
          {items.map((item, index) => (
            <div className="row" key={item.id}>
              <input className="input" style={{ flex: 2 }} aria-label={`שם המוצר - שורה ${index + 1}`} value={item.normalizedProductName ?? ""} onChange={(event) => updateItem(index, "normalizedProductName", event.target.value)} />
              <input className="input" style={{ flex: 1 }} type="number" aria-label={`סכום השורה - שורה ${index + 1}`} value={item.lineTotal} onChange={(event) => updateItem(index, "lineTotal", Number(event.target.value))} />
              <select className="select" style={{ flex: 1 }} aria-label={`סטטוס השורה - שורה ${index + 1}`} value={item.status} onChange={(event) => updateItem(index, "status", event.target.value)}>
                <option value="parsed">parsed</option>
                <option value="corrected">corrected</option>
                <option value="ignored">ignored</option>
              </select>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
