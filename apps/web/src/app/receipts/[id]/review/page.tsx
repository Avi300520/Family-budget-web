"use client";

import { CheckCircle2, Save } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Receipt, ReceiptItem } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../../components/AppShell";
import { LoadState } from "../../../../components/LoadState";
import { api } from "../../../../lib/api";
import { apiBaseUrl } from "../../../../lib/apiBase";

/**
 * The API speaks Hebrew to users and English to machines, and only one of those belongs on screen.
 *
 * A DomainError written for a person carries Hebrew copy — `receipt.missing_merchant` is
 * "לא הצלחתי לקרוא את שם החנות בקבלה." and says exactly what to do next. A Zod rejection is
 * `"Invalid request body"` and a server fault is `"Unexpected error"` (api/src/http.ts:290,301),
 * both deliberately content-free so they cannot echo request data back. Showing those to a
 * family in a Hebrew RTL form is a raw error code by another name.
 *
 * So: pass the backend's message through when it is Hebrew, and fall back otherwise. The test is
 * the script, not a list of codes, because "user-facing copy is Hebrew" is a project rule and a
 * code table would need editing every time the API grows an error.
 */
function userFacing(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  return /[֐-׿]/.test(message) ? message : fallback;
}

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
  // RCPTFIN — SEPARATE from `error`, deliberately. `error` short-circuits the whole render to
  // <LoadState>, which is right for a failed LOAD and wrong for a failed SAVE: it would replace
  // the form and throw away everything the user had just typed. A write failure has to appear
  // NEXT TO the buttons, with the edits still on screen to retry.
  const [saveError, setSaveError] = useState<string>();

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

  // RCPTFIN — a failed save must SAY so. With the OCR sentinel gone, an unreadable merchant
  // arrives as "" and `receiptCorrectionSchema` requires a non-empty name, so a 400 is now
  // reachable in an ordinary flow. Before this, the button simply did nothing and the user was
  // left guessing — the same silence class as the confirm that booked ₪5,608.30 and told nobody.
  async function save() {
    setSaveError(undefined);
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

  async function saveGuarded() {
    try {
      await save();
      return true;
    } catch (err) {
      setSaveError(userFacing(err, "לא הצלחתי לשמור את התיקון. אפשר לנסות שוב."));
      return false;
    }
  }

  async function confirm() {
    // The confirm still saves first, so a rejected correction must STOP it rather than book the
    // stored parse behind the user's back — which is exactly how "לא זוהה" reached the feed.
    if (!(await saveGuarded())) return;
    try {
      await api.confirmReceipt(params.id);
    } catch (err) {
      setSaveError(userFacing(err, "לא הצלחתי לאשר את הקבלה. אפשר לנסות שוב."));
      return;
    }
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
            {/* RCPTFIN — a native date input, not a free-text field. The owner spent several
                attempts correcting a date by guessing the format until one was accepted; a
                picker cannot emit a shape the API will reject, which turns the server-side
                predicate into a backstop rather than the user's teacher. `dir="ltr"` is gone
                deliberately: the native control owns its own direction and formatting. */}
            <input className="input" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
          </label>
          <label>
            סך הכל
            <input className="input" type="number" value={totalAmount} onChange={(event) => setTotalAmount(Number(event.target.value))} />
          </label>
          {saveError && <div className="status error" role="alert">{saveError}</div>}
          <div className="row">
            <button className="button secondary" onClick={saveGuarded}>
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
