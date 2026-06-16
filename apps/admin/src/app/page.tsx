"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, isTransportError, toErrorMessage } from "../lib/api";

type Overview = Awaited<ReturnType<typeof api.adminOverview>>;

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview>();
  const [error, setError] = useState<string>();
  const [canReload, setCanReload] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>();
  const [supportHouseholdId, setSupportHouseholdId] = useState("");
  const [supportBody, setSupportBody] = useState("");

  function fail(err: unknown, context?: string) {
    setError(toErrorMessage(err, context));
    setCanReload(isTransportError(err));
  }

  async function load() {
    try {
      setError(undefined);
      // Identify the verified Cloudflare Access admin first; then load the overview.
      const [me, data] = await Promise.all([api.adminAuthMe(), api.adminOverview()]);
      setAdminEmail(me.adminEmail);
      setOverview(data);
    } catch (err) {
      fail(err, "operations overview");
    }
  }

  async function addSupportNote(event: React.FormEvent) {
    event.preventDefault();
    if (!supportHouseholdId || !supportBody) return;
    try {
      await api.addSupportNote(supportHouseholdId, supportBody);
      setSupportBody("");
      await load();
    } catch (err) {
      fail(err, "the support note");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="shell">
      <aside className="nav">
        <div className="brand">Admin</div>
        <div className="list">
          <Link href="/" style={{ color: "white", fontWeight: 800 }}>Operations</Link>
          <Link href="/users" style={{ color: "white" }}>User management</Link>
        </div>
        {adminEmail && <div className="muted" style={{ marginTop: "auto", fontSize: 12, color: "#cbd5e1" }}>Signed in via Cloudflare Access<br />{adminEmail}</div>}
      </aside>
      <main className="main">
        <div className="row between">
          <h1 className="page-title">Operations</h1>
          <button className="button" onClick={load}>
            <RefreshCw size={18} aria-hidden />
            Refresh
          </button>
        </div>
        {error && (
          <div className="panel status error">
            {error}
            {canReload && (
              <div style={{ marginTop: 8 }}>
                <button className="button" type="button" onClick={() => window.location.reload()}>
                  Reload to re-authenticate
                </button>
              </div>
            )}
          </div>
        )}
        {!overview && !error && <div className="panel">Loading…</div>}
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
                <strong>{receipt.merchantName ?? receipt.id}</strong>
                <div className="muted">{receipt.status} · {receipt.confidenceScore}</div>
              </>
            )} />
            <Section title="Outbox" items={overview.outbox} render={(message) => {
              // Queue/send state (status) is distinct from the PROVIDER delivery
              // state (deliveryStatus). "Accepted by WhatsApp" (Meta took the send)
              // must NOT look like "Delivered"/"Read"; a failed delivery shows the
              // provider error (e.g. 131047). The body is never shown (it can carry
              // a magic-link token) — only safe metadata.
              const delivery = message.deliveryStatus;
              let label: string;
              let cls = "";
              if (message.status === "failed") {
                label = "Send failed";
                cls = "error";
              } else if (message.status === "pending") {
                label = "Queued";
                cls = "warn";
              } else if (delivery === "failed") {
                label = `Failed: ${[message.deliveryErrorCode, message.deliveryErrorTitle].filter(Boolean).join(" ")}`.trim();
                cls = "error";
              } else if (delivery === "read") {
                label = "Read";
              } else if (delivery === "delivered") {
                label = "Delivered";
              } else {
                label = "Accepted by WhatsApp";
                cls = "warn";
              }
              return (
                <>
                  <strong>{message.channel} · {message.destinationMasked}</strong>
                  <div className={`status ${cls}`}>{label}</div>
                  <div className="muted">{[message.kind, message.providerMessageIdMasked].filter(Boolean).join(" · ")}</div>
                </>
              );
            }} />
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
