"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, isAuthError, isTransportError, toErrorMessage } from "../../lib/api";
import { AdminRail } from "../AdminRail";
import { isPreviewHost, DEMO_BANNER, demoOverview } from "../../lib/demo";

// Advanced / legacy operational tools. NOT a primary destination — reachable only
// via the rail's "Advanced tools" link. The high-value summary (counts + integrity)
// and household lookup live on the unified Dashboard; this page keeps the raw
// operational feeds + user management for the rarer support cases.

type Overview = Awaited<ReturnType<typeof api.adminOverview>>;

export default function AdvancedToolsPage() {
  const [overview, setOverview] = useState<Overview>();
  const [adminEmail, setAdminEmail] = useState<string>();
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string }>();
  const [supportHouseholdId, setSupportHouseholdId] = useState("");
  const [supportBody, setSupportBody] = useState("");
  // Preview-only visual demo (never on the production host); disables writes.
  const [demoMode, setDemoMode] = useState(false);

  function note(err: unknown, context?: string) {
    const authish = isAuthError(err) || isTransportError(err);
    if (authish && isPreviewHost()) {
      setDemoMode(true);
      setNotice({ tone: "info", text: DEMO_BANNER });
      setOverview((p) => p ?? demoOverview);
      return;
    }
    if (authish) {
      setNotice({
        tone: "info",
        text: "Authenticated data is only available on admin.pingtally.com behind Cloudflare Access. This preview shows the layout only."
      });
    } else {
      setNotice({ tone: "error", text: toErrorMessage(err, context) });
    }
  }

  async function load() {
    try {
      setNotice(undefined);
      const [me, data] = await Promise.all([api.adminAuthMe(), api.adminOverview()]);
      setAdminEmail(me.adminEmail);
      setOverview(data);
    } catch (err) {
      note(err, "operational feeds");
    }
  }

  async function addSupportNote(event: React.FormEvent) {
    event.preventDefault();
    if (demoMode) return;
    if (!supportHouseholdId || supportBody.trim().length < 3) return;
    try {
      await api.addSupportNote(supportHouseholdId, supportBody.trim());
      setSupportBody("");
      await load();
    } catch (err) {
      note(err, "the support note");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="shell">
      <AdminRail active="advanced" adminEmail={adminEmail} />
      <main className="main">
        <div className="row between">
          <h1 className="page-title">Advanced tools</h1>
          <button className="button" onClick={load}>
            <RefreshCw size={18} aria-hidden />
            Refresh
          </button>
        </div>
        <p className="muted" style={{ marginTop: -8 }}>
          Raw operational feeds + legacy user management. For day-to-day support use the <Link href="/">Dashboard</Link> and the household 360.
        </p>

        {notice && (
          <div
            className={notice.tone === "error" ? "panel status error" : "panel"}
            style={notice.tone === "info" ? { borderInlineStart: "3px solid var(--amber)" } : undefined}
          >
            {notice.text}
          </div>
        )}

        <section className="panel">
          <h2>Legacy tools</h2>
          <Link href="/users" className="button" style={{ background: "var(--nav)" }}>User management →</Link>
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>Per-user lookup, session revoke, and QA reset. Most user context is now visible inside the household 360.</div>
        </section>

        {!overview && !notice && <div className="panel">Loading…</div>}

        {overview && (
          <div className="grid two">
            <section className="panel">
              <h2>Add support note</h2>
              <form className="list" onSubmit={addSupportNote}>
                <input className="input" placeholder="household id" value={supportHouseholdId} onChange={(e) => setSupportHouseholdId(e.target.value)} />
                <input className="input" placeholder="note (min 3 chars)" value={supportBody} onChange={(e) => setSupportBody(e.target.value)} disabled={demoMode} />
                <button className="button" type="submit" disabled={demoMode} title={demoMode ? "Disabled in preview demo mode" : undefined}>Add note</button>
              </form>
            </section>

            <Section title="Receipts" items={overview.receipts} render={(receipt) => (
              <>
                <strong>{receipt.merchantName ?? receipt.id}</strong>
                <div className="muted">{receipt.status} · {receipt.confidenceScore}</div>
              </>
            )} />

            <Section title="Outbox" items={overview.outbox} render={(message) => {
              // Queue/send state (status) is distinct from PROVIDER delivery state.
              // The body is never shown (it can carry a magic-link token) — metadata only.
              const delivery = message.deliveryStatus;
              let label: string;
              let cls = "";
              if (message.status === "failed") { label = "Send failed"; cls = "error"; }
              else if (message.status === "pending") { label = "Queued"; cls = "warn"; }
              else if (delivery === "failed") { label = `Failed: ${[message.deliveryErrorCode, message.deliveryErrorTitle].filter(Boolean).join(" ")}`.trim(); cls = "error"; }
              else if (delivery === "read") { label = "Read"; }
              else if (delivery === "delivered") { label = "Delivered"; }
              else { label = "Accepted by WhatsApp"; cls = "warn"; }
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

            {/* Messages: metadata ONLY — the message body (normalizedText) is WhatsApp
                conversation content and is intentionally never rendered in the admin. */}
            <Section title="Messages" items={overview.messages} render={(message) => (
              <>
                <strong>{message.direction} · {message.messageType}</strong>
                <div className="muted">{[message.intent, message.processingStatus, message.createdAt].filter(Boolean).join(" · ")}</div>
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
              const note2 = item as { adminSubject?: string; body?: string; createdAt?: string };
              return (
                <>
                  <strong>{note2.adminSubject}</strong>
                  <div>{note2.body}</div>
                  <div className="muted">{note2.createdAt}</div>
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
