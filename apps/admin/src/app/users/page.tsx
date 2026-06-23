"use client";

import { useEffect, useState } from "react";
import type {
  AdminAuditEntry,
  AdminUserDetail,
  AdminUserSearchBy,
  AdminUserSummary,
  AdminWebSessionView
} from "@shopping-assistant/api-client";
import Link from "next/link";
import { api, isTransportError, toErrorMessage } from "../../lib/api";
import { AdminRail } from "../AdminRail";

const DANGER: React.CSSProperties = { background: "var(--rose)" };
const SUBTLE: React.CSSProperties = { background: "var(--nav)" };

export default function AdminUsersPage() {
  const [error, setError] = useState<string>();
  const [canReload, setCanReload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>();

  const [by, setBy] = useState<AdminUserSearchBy>("phone");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminUserSummary[]>();

  const [detail, setDetail] = useState<AdminUserDetail>();
  const [sessions, setSessions] = useState<AdminWebSessionView[]>([]);
  const [audit, setAudit] = useState<AdminAuditEntry[]>([]);

  function fail(err: unknown, context?: string) {
    setError(toErrorMessage(err, context));
    // Offer a reload only for a transport/Access-challenge failure (no HTTP status);
    // a real 4xx/5xx is shown honestly with its status and is not "fixed" by reloading.
    setCanReload(isTransportError(err));
  }

  // Identify the verified Cloudflare Access admin on load (also surfaces an Access/session error early).
  useEffect(() => {
    api.adminAuthMe().then((me) => setAdminEmail(me.adminEmail)).catch((err) => fail(err, "admin identity"));
  }, []);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await api.adminSearchUsers(by, q.trim());
      setResults(res.users);
    } catch (err) {
      fail(err, "user search");
    } finally {
      setBusy(false);
    }
  }

  async function openUser(userId: string) {
    setBusy(true);
    setError(undefined);
    try {
      const [d, s, a] = await Promise.all([
        api.adminGetUser(userId),
        api.adminUserSessions(userId),
        api.adminUserAudit(userId)
      ]);
      setDetail(d);
      setSessions(s.sessions);
      setAudit(a.entries);
    } catch (err) {
      fail(err, "user details");
    } finally {
      setBusy(false);
    }
  }

  async function refreshDetail(userId: string) {
    try {
      const [d, s, a] = await Promise.all([
        api.adminGetUser(userId),
        api.adminUserSessions(userId),
        api.adminUserAudit(userId)
      ]);
      setDetail(d);
      setSessions(s.sessions);
      setAudit(a.entries);
    } catch (err) {
      fail(err, "user details");
    }
  }

  function askReason(action: string): string | undefined {
    const reason = window.prompt(`Reason for "${action}" (min 3 chars) — this is recorded in the audit log:`);
    if (reason == null) return undefined; // cancelled
    if (reason.trim().length < 3) {
      setError("A reason of at least 3 characters is required.");
      return undefined;
    }
    return reason.trim();
  }

  async function revokeSession(sessionId: string) {
    if (!detail) return;
    const reason = askReason("revoke session");
    if (!reason) return;
    try {
      await api.adminRevokeSession(detail.user.id, sessionId, reason);
      await refreshDetail(detail.user.id);
    } catch (err) {
      fail(err);
    }
  }

  async function revokeAll() {
    if (!detail) return;
    if (!window.confirm("Revoke ALL active sessions for this user? They will be logged out everywhere.")) return;
    const reason = askReason("revoke all sessions");
    if (!reason) return;
    try {
      await api.adminRevokeAllSessions(detail.user.id, reason);
      await refreshDetail(detail.user.id);
    } catch (err) {
      fail(err);
    }
  }

  async function qaReset() {
    if (!detail) return;
    if (!window.confirm("QA reset (allow-listed test users only — does NOT affect regular users): clears sessions + magic links + non-owned memberships + pending invites to this phone, and sets status→onboarding so onboarding can be re-tested. Owned household, purchases, receipts, budgets and subscriptions are KEPT. Proceed?")) return;
    const reason = askReason("QA reset");
    if (!reason) return;
    // No confirmToken: the production gate is the verified Cloudflare Access admin identity plus
    // the server-side QA-reset allowlist. The browser never sends a secret token.
    try {
      const res = await api.adminQaResetUser(detail.user.id, reason);
      setError(undefined);
      window.alert(`QA reset done. Cleared — sessions: ${res.cleared.sessions}, magic links: ${res.cleared.magicLinks}, memberships removed: ${res.cleared.membershipsRemoved}, pending invites: ${res.cleared.pendingInvitesCancelled}. Preserved owned households: ${res.preserved.ownedHouseholdIds.length}.`);
      await refreshDetail(detail.user.id);
    } catch (err) {
      fail(err);
    }
  }

  // NOTE: deactivate / reactivate are intentionally NOT wired in this MVP. The backend
  // sets status='blocked' + revokes sessions, but the auth/login path does not yet reject
  // blocked users, so an active button would create false confidence. Re-enable once
  // blocked-user login enforcement ships (a documented follow-up).

  const u = detail?.user;

  return (
    <div className="shell">
      <AdminRail active="advanced" adminEmail={adminEmail} />
      <main className="main">
        <div className="row between">
          <h1 className="page-title">User management</h1>
          <Link href="/advanced" className="button" style={{ background: "var(--nav)" }}>← Advanced tools</Link>
        </div>

        {error && (
          <div className="panel status error" style={{ display: "block" }}>
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

        <section className="panel">
          <form className="row" onSubmit={search}>
            <select className="input" style={{ maxWidth: 130 }} value={by} onChange={(e) => setBy(e.target.value as AdminUserSearchBy)}>
              <option value="phone">Phone</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="id">User ID</option>
            </select>
            <input className="input" style={{ maxWidth: 360 }} placeholder="search term" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="button" type="submit" disabled={busy}>{busy ? "…" : "Search"}</button>
          </form>
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>Phone &amp; email are masked. Hard delete is not available.</div>
        </section>

        {results && (
          <section className="panel">
            <h2>Results ({results.length})</h2>
            <div className="list">
              {results.map((r) => (
                <button key={r.id} className="item" style={{ textAlign: "start", cursor: "pointer" }} onClick={() => openUser(r.id)}>
                  <strong>{r.displayName ?? "(no name)"}</strong>
                  <div className="muted">{r.phoneMasked}{r.emailMasked ? ` · ${r.emailMasked}` : ""}</div>
                  <div className="row" style={{ marginTop: 4 }}>
                    <span className={`status ${r.status === "active" ? "" : r.status === "blocked" ? "error" : "warn"}`}>{r.status}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{r.id}</span>
                  </div>
                </button>
              ))}
              {!results.length && <div className="muted">No users found.</div>}
            </div>
          </section>
        )}

        {detail && u && (
          <div className="grid two">
            <section className="panel">
              <div className="row between">
                <h2>{u.displayName ?? "(no name)"}</h2>
                <span className={`status ${u.status === "active" ? "" : u.status === "blocked" ? "error" : "warn"}`}>{u.status}</span>
              </div>
              <div className="muted">{u.phoneMasked}{u.emailMasked ? ` · ${u.emailMasked}` : ""}</div>
              <div className="muted" style={{ fontSize: 12 }}>id {u.id}</div>
              <div className="muted" style={{ fontSize: 12 }}>created {u.createdAt} · updated {u.updatedAt}</div>
              <div className="row" style={{ marginTop: 8 }}>
                <span className="status">{detail.activeSessionCount} active sessions</span>
                <span className="status warn">{detail.activeMagicLinkCount} live magic links</span>
                <span className={`status ${detail.isActive ? "" : "warn"}`}>{detail.isActive ? "appears active" : "not active"}</span>
              </div>

              <h3 style={{ marginBottom: 6 }}>Memberships</h3>
              <div className="list">
                {detail.memberships.map((m) => (
                  <div className="item" key={m.householdId}>
                    <strong>{m.householdName ?? m.householdId}</strong>
                    <div className="muted">{m.role} · {m.memberStatus}{m.isOwner ? " · owner" : ""}</div>
                  </div>
                ))}
                {!detail.memberships.length && <div className="muted">No memberships.</div>}
              </div>

              <h3 style={{ marginBottom: 6 }}>Actions</h3>
              <div className="row">
                <button className="button" style={SUBTLE} onClick={qaReset}>QA reset</button>
                <button className="button" style={DANGER} onClick={revokeAll}>Revoke all sessions</button>
              </div>
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Destructive actions require confirmation + a reason. Hard delete is not available.</div>
              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>Soft deactivate is not enabled in this MVP because login enforcement is not implemented yet.</div>
            </section>

            <section className="panel">
              <h2>Sessions ({sessions.length})</h2>
              <div className="list">
                {sessions.map((s) => (
                  <div className="item" key={s.id}>
                    <div className="row between">
                      <span className={`status ${s.active ? "" : s.revokedAt ? "error" : "warn"}`}>{s.active ? "active" : s.revokedAt ? "revoked" : "expired"}</span>
                      {s.active && <button className="button" style={DANGER} onClick={() => revokeSession(s.id)}>Revoke</button>}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>created {s.createdAt}</div>
                    <div className="muted" style={{ fontSize: 12 }}>last seen {s.lastSeenAt ?? "—"} · expires {s.expiresAt}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{s.ipMasked ?? "no ip"}{s.userAgent ? ` · ${s.userAgent.slice(0, 40)}` : ""}</div>
                  </div>
                ))}
                {!sessions.length && <div className="muted">No sessions.</div>}
              </div>

              <h3 style={{ marginBottom: 6 }}>Recent admin actions</h3>
              <div className="list">
                {audit.map((a) => (
                  <div className="item" key={a.id}>
                    <strong>{a.action}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{a.createdAt}{a.adminSubject ? ` · ${a.adminSubject}` : ""}{a.reason ? ` · "${a.reason}"` : ""}</div>
                  </div>
                ))}
                {!audit.length && <div className="muted">No admin actions yet.</div>}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
