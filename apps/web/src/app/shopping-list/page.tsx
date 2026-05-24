"use client";

import { Check, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Household, ShoppingListItem } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";

export default function ShoppingListPage() {
  const [household, setHousehold] = useState<Household>();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [rawText, setRawText] = useState("חלב");
  const [error, setError] = useState<string>();
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function load() {
    try {
      const current = await api.currentHousehold();
      setHousehold(current.household);
      const list = await api.shoppingList(current.household.id);
      setItems(list.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת הרשימה");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    if (!household) return;
    await api.addShoppingItem(household.id, rawText);
    setRawText("");
    await load();
  }

  async function update(id: string, status: ShoppingListItem["status"]) {
    await api.patchShoppingItem(id, { status });
    await load();
  }

  async function sendToWhatsapp() {
    if (!household || sendStatus === "sending") return;
    setSendStatus("sending");
    try {
      await api.sendShoppingListToWhatsapp(household.id);
      setSendStatus("sent");
      setTimeout(() => setSendStatus("idle"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחה");
      setSendStatus("idle");
    }
  }

  const activeItems = items.filter((item) => item.status === "active");

  if (error) return <AppShell><LoadState error={error} /></AppShell>;
  if (!household) return <AppShell><LoadState /></AppShell>;

  return (
    <AppShell>
      <div className="row between">
        <h1 className="page-title">רשימת קניות</h1>
        {activeItems.length > 0 && (
          <button
            className={`button ${sendStatus === "sent" ? "secondary" : ""}`}
            onClick={sendToWhatsapp}
            disabled={sendStatus === "sending"}
          >
            <Send size={18} aria-hidden />
            {sendStatus === "sending" ? "שולח..." : sendStatus === "sent" ? "נשלח ✓" : `שלח לי לוואטסאפ (${activeItems.length})`}
          </button>
        )}
      </div>
      <form className="row" onSubmit={addItem} style={{ marginTop: 8 }}>
        <input
          className="input"
          style={{ maxWidth: 360 }}
          value={rawText}
          placeholder="למשל: חלב, לחם, ביצים"
          onChange={(event) => setRawText(event.target.value)}
        />
        <button className="button" type="submit">
          <Plus size={18} aria-hidden />
          הוספה
        </button>
      </form>
      <div className="list" style={{ marginTop: 18 }}>
        {items.map((item) => (
          <div className="item-card row between" key={item.id}>
            <div>
              <strong>{item.normalizedName ?? item.rawText}</strong>
              <div className="muted">{item.source} · {item.status}</div>
            </div>
            <div className="row">
              {item.status === "active" && (
                <button className="button secondary" onClick={() => update(item.id, "purchased")}>
                  <Check size={18} aria-hidden />
                  נקנה
                </button>
              )}
              {item.status !== "removed" && (
                <button className="button warn" onClick={() => update(item.id, "removed")}>
                  <Trash2 size={18} aria-hidden />
                  הסרה
                </button>
              )}
            </div>
          </div>
        ))}
        {!activeItems.length && <div className="panel muted">הרשימה ריקה — הוסף פריטים מהוואטסאפ או מהשדה למעלה</div>}
      </div>
    </AppShell>
  );
}
