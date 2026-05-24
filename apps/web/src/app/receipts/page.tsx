"use client";

import Link from "next/link";
import { ExternalLink, RefreshCw, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import type { Receipt } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [householdId, setHouseholdId] = useState<string>();
  const [error, setError] = useState<string>();

  async function load() {
    setError(undefined);
    try {
      const current = await api.currentHousehold();
      setHouseholdId(current.household.id);
      setReceipts((await api.receipts()).receipts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת קבלות");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function uploadReceipt(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !householdId) return;
    const imageBase64 = await fileToBase64(file);
    await api.uploadReceiptImage(householdId, { imageBase64, filename: file.name, contentType: file.type || "image/jpeg" });
    await load();
  }

  return (
    <AppShell>
      <div className="row between">
        <h1 className="page-title">קבלות</h1>
        <button className="button secondary" onClick={load}>
          <RefreshCw size={18} aria-hidden />
          רענון
        </button>
      </div>
      {error && <LoadState error={error} />}
      <section className="panel" style={{ marginBottom: 16 }}>
        <label className="button secondary">
          <Upload size={18} aria-hidden />
          העלאת קבלה
          <input type="file" accept="image/*" onChange={uploadReceipt} style={{ display: "none" }} />
        </label>
      </section>
      <div className="list">
        {receipts.map((receipt) => (
          <div className="item-card row between" key={receipt.id}>
            <div>
              <strong>{receipt.parsedJson?.merchantName ?? "קבלה"}</strong>
              <div className="muted">{receipt.parsedJson?.totalAmount ?? 0} ש"ח · {receipt.status}</div>
            </div>
            <Link className="button" href={`/receipts/${receipt.id}/review`}>
              <ExternalLink size={18} aria-hidden />
              פתיחה
            </Link>
          </div>
        ))}
        {!receipts.length && !error && <div className="panel muted">אין קבלות עדיין</div>}
      </div>
    </AppShell>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
