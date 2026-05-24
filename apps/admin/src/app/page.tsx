"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Overview = Awaited<ReturnType<typeof api.adminOverview>>;

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview>();
  const [error, setError] = useState<string>();
  const [token, setToken] = useState("change-me-local-admin-token");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [supportHouseholdId, setSupportHouseholdId] = useState("");
  const [supportBody, setSupportBody] = useState("");

  async function load() {
    try {
      setError(undefined);
      setOverview(await api.adminOverview());
      setNeedsLogin(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Admin API error";
      setError(message);
      if (message.toLowerCase().includes("admin")) setNeedsLogin(true);
    }
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    try {
      setError(undefined);
      await api.adminLogin(token);
      setNeedsLogin(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin login failed");
    }
  }

  async function addSupportNote(event: React.FormEvent) {
    event.preventDefault();
    if (!supportHouseholdId || !supportBody) return;
    await api.addSupportNote(supportHouseholdId, supportBody);
    setSupportBody("");
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="shell">
      <aside className="nav">
        <div className="brand">Admin</div>
        <div className="muted">עוזר הקניות המשפחתי</div>
      </aside>
      <main className="main">
        <div className="row between">
          <h1 className="page-title">Operations</h1>
          <button className="button" onClick={load}>
            <RefreshCw size={18} aria-hidden />
            Refresh
          </button>
        </div>
        {needsLogin && (
          <form className="panel row" onSubmit={login}>
            <input className="input" style={{ maxWidth: 360 }} value={token} onChange={(event) => setToken(event.target.value)} />
            <button className="button" type="submit">Admin login</button>
          </form>
        )}
        {error && <div className="panel status error">{error}</div>}
        {!overview && !error && <div className="panel">Loading...</div>}
        {overview && (
          <div className="grid two">
            <section className="panel">
              <h2>Support note</h2>
              <form className="list" onSubmit={addSupportNote}>
                <input className="input" placeholder="household id" value={supportHouseholdId} onChange={(event) => setSupportHouseholdId(event.target.value)} />
                <input className="input" placeholder="note" value={supportBody} onChange={(event) => setSupportBody(event.target.value)} />
                <button className="button" type="submit">Add note</button>
              </form>
            </section>
            <Section title="Households" items={overview.households} render={(item) => {
              const entry = item as { household?: { name?: string; status?: string }; budget?: { spentAmount?: number; remainingAmount?: number }; subscription?: { planCode?: string } };
              return (
                <>
                  <strong>{entry.household?.name ?? "household"}</strong>
                  <div className="muted">{entry.household?.status} · {entry.subscription?.planCode ?? "trial"}</div>
                  <div className="status">spent {entry.budget?.spentAmount ?? 0}</div>
                </>
              );
            }} />
            <Section title="Receipts" items={overview.receipts} render={(receipt) => (
              <>
                <strong>{receipt.parsedJson?.merchantName ?? receipt.id}</strong>
                <div className="muted">{receipt.status} · {receipt.confidenceScore}</div>
              </>
            )} />
            <Section title="Outbox" items={overview.outbox} render={(message) => (
              <>
                <strong>{message.channel} · {message.destination}</strong>
                <div className={`status ${message.status === "failed" ? "error" : message.status === "pending" ? "warn" : ""}`}>{message.status}</div>
                <div className="muted">{String(message.payload.text ?? message.payload.type ?? "")}</div>
              </>
            )} />
            <Section title="Webhooks" items={overview.webhookEvents} render={(event) => (
              <>
                <strong>{event.provider}</strong>
                <div className="muted">{event.eventType}</div>
                <div className={`status ${event.status === "failed" ? "error" : event.status === "duplicate" ? "warn" : ""}`}>{event.status}</div>
              </>
            )} />
            <Section title="Messages" items={overview.messages} render={(message) => (
              <>
                <strong>{message.direction} · {message.messageType}</strong>
                <div className="muted">{message.normalizedText}</div>
              </>
            )} />
            <Section title="Audit" items={overview.auditLogs} render={(item) => {
              const log = item as { action?: string; entityType?: string; createdAt?: string };
              return (
                <>
                  <strong>{log.action}</strong>
                  <div className="muted">{log.entityType} · {log.createdAt}</div>
                </>
              );
            }} />
            <Section title="Entitlements" items={overview.entitlements} render={(item) => {
              const entitlement = item as { householdId?: string; featureCode?: string; limitValue?: number; usedValue?: number };
              return (
                <>
                  <strong>{entitlement.featureCode}</strong>
                  <div className="muted">{entitlement.householdId}</div>
                  <div className="status">{entitlement.usedValue ?? 0}/{entitlement.limitValue ?? "fair"}</div>
                </>
              );
            }} />
            <Section title="Provider logs" items={overview.providerLogs} render={(item) => {
              const log = item as { provider?: string; eventType?: string; status?: string; failureReason?: string };
              return (
                <>
                  <strong>{log.provider} · {log.eventType}</strong>
                  <div className={`status ${log.status === "failed" ? "error" : ""}`}>{log.status}</div>
                  {log.failureReason && <div className="muted">{log.failureReason}</div>}
                </>
              );
            }} />
            <Section title="Analytics" items={overview.analyticsEvents} render={(item) => {
              const event = item as { name?: string; householdId?: string; createdAt?: string };
              return (
                <>
                  <strong>{event.name}</strong>
                  <div className="muted">{event.householdId} · {event.createdAt}</div>
                </>
              );
            }} />
            <Section title="Support notes" items={overview.supportNotes} render={(item) => {
              const note = item as { adminSubject?: string; body?: string; createdAt?: string };
              return (
                <>
                  <strong>{note.adminSubject}</strong>
                  <div>{note.body}</div>
                  <div className="muted">{note.createdAt}</div>
                </>
              );
            }} />
          </div>
        )}
      </main>
    </div>
  );
}

function Section<T>({ title, items, render }: { title: string; items: T[]; render: (item: T) => React.ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="list">
        {items.slice(0, 8).map((item, index) => (
          <div className="item" key={index}>
            {render(item)}
          </div>
        ))}
        {!items.length && <div className="muted">No rows</div>}
      </div>
    </section>
  );
}
