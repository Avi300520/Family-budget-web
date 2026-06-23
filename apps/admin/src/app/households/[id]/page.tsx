"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, isTransportError, toErrorMessage } from "../../../lib/api";

// Shared-types DTOs and the AdminGrantKind union live in @shopping-assistant/shared-types,
// which is NOT directly resolvable from the admin app (only api-client is symlinked) and is
// not re-exported by api-client. We derive every shape from the api-client return/param types
// — the same `Awaited<ReturnType<...>>` convention the Operations page uses for adminOverview —
// so they stay in lock-step with the contract with no extra import.
type AdminGrantKind = Parameters<typeof api.adminGrant>[1];
type Household360 = Awaited<ReturnType<typeof api.adminGetHousehold>>;
type Member = Household360["members"][number];
type Invite = Household360["invites"][number];
type Billing = Household360["billing"];
type SubscriptionEvent = Billing["events"][number];
type UsageMeter = Billing["usageMeters"][number];
type AuditEntry = Awaited<ReturnType<typeof api.adminHouseholdAudit>>["audit"][number];
type SupportNote = Awaited<ReturnType<typeof api.adminHouseholdNotes>>["notes"][number];

const DANGER: React.CSSProperties = { background: "var(--rose)" };
const SUBTLE: React.CSSProperties = { background: "var(--nav)" };

const GRANT_KINDS: AdminGrantKind[] = ["extend_trial", "free_month", "goodwill", "internal_test"];
const TABS = ["Members", "Billing", "Activity", "Ops", "Notes & Audit"] as const;
type Tab = (typeof TABS)[number];

export default function AdminHousehold360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [error, setError] = useState<string>();
  const [canReload, setCanReload] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>();
  const [tab, setTab] = useState<Tab>("Members");

  const [detail, setDetail] = useState<Household360>();
  const [notes, setNotes] = useState<SupportNote[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  // Transient revealed full phones, keyed by memberId. NEVER persisted or logged.
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const [grantKind, setGrantKind] = useState<AdminGrantKind>("extend_trial");
  const [repairMemberId, setRepairMemberId] = useState("");
  const [noteBody, setNoteBody] = useState("");

  function fail(err: unknown, context?: string) {
    setError(toErrorMessage(err, context));
    setCanReload(isTransportError(err));
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

  async function load() {
    try {
      setError(undefined);
      const [d, n, a] = await Promise.all([
        api.adminGetHousehold(id),
        api.adminHouseholdNotes(id),
        api.adminHouseholdAudit(id)
      ]);
      setDetail(d);
      setNotes(n.notes);
      setAudit(a.audit);
    } catch (err) {
      fail(err, "household details");
    }
  }

  useEffect(() => {
    api.adminAuthMe().then((me) => setAdminEmail(me.adminEmail)).catch((err) => fail(err, "admin identity"));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Member reveal ───────────────────────────────────────────────────────
  async function revealPhone(memberId: string) {
    const reason = askReason("reveal phone");
    if (!reason) return;
    try {
      const res = await api.adminRevealPhone(id, memberId, reason);
      // Transient, local-state-only. Never written to logs or storage.
      setRevealed((prev) => ({ ...prev, [memberId]: res.value }));
    } catch (err) {
      fail(err, "phone reveal");
    }
  }

  // ── Billing grants ──────────────────────────────────────────────────────
  async function grant() {
    const reason = askReason(`grant ${grantKind}`);
    if (!reason) return;
    try {
      const res = await api.adminGrant(id, grantKind, reason);
      setDetail((prev) => (prev ? { ...prev, billing: res.billing } : prev));
      await refreshAudit();
    } catch (err) {
      fail(err, "the grant");
    }
  }

  async function revokeGrant(correlationId: string) {
    const reason = askReason("revoke grant");
    if (!reason) return;
    try {
      const res = await api.adminRevokeGrant(id, correlationId, reason);
      setDetail((prev) => (prev ? { ...prev, billing: res.billing } : prev));
      await refreshAudit();
    } catch (err) {
      fail(err, "the grant revoke");
    }
  }

  // ── Dangerous: repair owner ─────────────────────────────────────────────
  async function repairOwner() {
    if (!repairMemberId) {
      setError("Select a member to promote to owner first.");
      return;
    }
    if (!window.confirm("REPAIR OWNER is a destructive integrity fix: it promotes the selected active member to owner of this household. Use it ONLY to recover an ownerless / mismatched household. Proceed?")) return;
    const reason = askReason("repair owner");
    if (!reason) return;
    try {
      await api.adminRepairOwner(id, repairMemberId, reason);
      setRepairMemberId("");
      await load();
    } catch (err) {
      fail(err, "the owner repair");
    }
  }

  // ── Notes ───────────────────────────────────────────────────────────────
  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (noteBody.trim().length < 3) {
      setError("A note of at least 3 characters is required.");
      return;
    }
    try {
      await api.adminAddHouseholdNote(id, noteBody.trim());
      setNoteBody("");
      const n = await api.adminHouseholdNotes(id);
      setNotes(n.notes);
      await refreshAudit();
    } catch (err) {
      fail(err, "the note");
    }
  }

  async function refreshAudit() {
    try {
      const a = await api.adminHouseholdAudit(id);
      setAudit(a.audit);
    } catch {
      // non-fatal: the primary action already succeeded.
    }
  }

  const h = detail?.household;
  // Active members are the only valid repair-owner targets.
  const activeMembers = detail?.members.filter((m) => m.status === "active") ?? [];

  return (
    <div className="shell">
      <aside className="nav">
        <div className="brand">Admin</div>
        <div className="list">
          <Link href="/" style={{ color: "white" }}>Operations</Link>
          <Link href="/households" style={{ color: "white", fontWeight: 800 }}>Households</Link>
          <Link href="/users" style={{ color: "white" }}>User management</Link>
        </div>
        {adminEmail && <div className="muted" style={{ marginTop: "auto", fontSize: 12, color: "#cbd5e1" }}>Signed in via Cloudflare Access<br />{adminEmail}</div>}
      </aside>
      <main className="main">
        <div className="row between">
          <h1 className="page-title">{h?.name ?? "Household"}</h1>
          <Link href="/households" className="button" style={SUBTLE}>← Back to search</Link>
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

        {!detail && !error && <div className="panel">Loading…</div>}

        {detail && h && (
          <>
            <section className="panel">
              <div className="row between">
                <div>
                  <strong>{h.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>id {h.id} · created {h.createdAt}</div>
                  <div className="muted">
                    owner {detail.owner?.displayName ?? "(unknown)"} · {detail.owner?.phoneMasked ?? "—"}
                  </div>
                </div>
                <span className="status">{h.status}</span>
              </div>
              {detail.integrityFlags.length > 0 && (
                <div className="row" style={{ marginTop: 10 }}>
                  {detail.integrityFlags.map((flag) => (
                    <span key={flag} className="status error">{flag}</span>
                  ))}
                </div>
              )}
            </section>

            <div className="row" style={{ marginTop: 4, marginBottom: 4 }}>
              {TABS.map((t) => (
                <button
                  key={t}
                  className="button"
                  style={t === tab ? undefined : SUBTLE}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "Members" && (
              <MembersTab members={detail.members} revealed={revealed} onReveal={revealPhone} />
            )}

            {tab === "Billing" && (
              <BillingTab
                billing={detail.billing}
                grantKind={grantKind}
                setGrantKind={setGrantKind}
                onGrant={grant}
                onRevokeGrant={revokeGrant}
              />
            )}

            {tab === "Activity" && <ActivityTab counts={detail.counts} />}

            {tab === "Ops" && (
              <OpsTab
                ops={detail.ops}
                integrityFlags={detail.integrityFlags}
                activeMembers={activeMembers}
                repairMemberId={repairMemberId}
                setRepairMemberId={setRepairMemberId}
                onRepairOwner={repairOwner}
              />
            )}

            {tab === "Notes & Audit" && (
              <NotesAuditTab notes={notes} audit={audit} noteBody={noteBody} setNoteBody={setNoteBody} onAddNote={addNote} />
            )}

            <InvitesSection invites={detail.invites} />
          </>
        )}
      </main>
    </div>
  );
}

// ── Members ─────────────────────────────────────────────────────────────────
function MembersTab({
  members,
  revealed,
  onReveal
}: {
  members: Member[];
  revealed: Record<string, string>;
  onReveal: (memberId: string) => void;
}) {
  return (
    <section className="panel">
      <h2>Members ({members.length})</h2>
      <div className="list">
        {members.map((m) => {
          const removed = m.status === "removed";
          const shownPhone = revealed[m.memberId];
          return (
            <div className="item" key={m.memberId} style={removed ? { opacity: 0.6 } : undefined}>
              <div className="row between">
                <strong>{m.displayName ?? "(no name)"}</strong>
                <div className="row">
                  {m.isOwner && <span className="status">owner</span>}
                  <span className={`status ${m.status === "active" ? "" : m.status === "removed" ? "error" : "warn"}`}>{m.status}</span>
                  {m.onboardingStuck && <span className="status warn">onboarding stuck</span>}
                </div>
              </div>
              <div className="row" style={{ marginTop: 4 }}>
                <span className="muted">{shownPhone ?? m.phoneMasked}</span>
                {shownPhone ? (
                  <span className="status warn">revealed (transient)</span>
                ) : (
                  <button className="button" style={SUBTLE} onClick={() => onReveal(m.memberId)}>Reveal</button>
                )}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{m.role} · joined {m.joinedAt}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                WA in {m.lastWaInboundAt ?? "—"} · WA out {m.lastWaOutboundAt ?? "—"} · dashboard {m.dashboardLastSeenAt ?? "—"}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>user {m.userId}</div>
            </div>
          );
        })}
        {!members.length && <div className="muted">No members.</div>}
      </div>
    </section>
  );
}

// ── Billing ───────────────────────────────────────────────────────────────
function BillingTab({
  billing,
  grantKind,
  setGrantKind,
  onGrant,
  onRevokeGrant
}: {
  billing: Billing;
  grantKind: AdminGrantKind;
  setGrantKind: (k: AdminGrantKind) => void;
  onGrant: () => void;
  onRevokeGrant: (correlationId: string) => void;
}) {
  // Active manual grants = manual_grant events whose correlationId has no matching
  // manual_grant_revoked.revokesCorrelationId in the same timeline.
  const revokedIds = new Set(
    billing.events
      .filter((e) => e.eventType === "manual_grant_revoked" && e.revokesCorrelationId)
      .map((e) => e.revokesCorrelationId as string)
  );

  return (
    <>
      <section className="panel">
        <div className="row between">
          <h2>Billing</h2>
          {/* isManualGrant and isPaid are mutually exclusive — never both. */}
          {billing.isManualGrant ? (
            <span className="status warn">Manual Grant</span>
          ) : billing.isPaid ? (
            <span className="status">Paid</span>
          ) : (
            <span className="status warn">Not paid</span>
          )}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="status">{billing.effectiveStatus}</span>
          <span className="status">{billing.planLabel}</span>
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          {billing.rawStatus ? `raw status ${billing.rawStatus} · ` : ""}
          {billing.planCode ? `plan code ${billing.planCode} · ` : ""}
          {billing.provider ? `provider ${billing.provider}` : "no provider"}
        </div>
        <div className="list" style={{ marginTop: 8 }}>
          {billing.trialEndsAt && (
            <div className="muted" style={{ fontSize: 13 }}>
              trial ends {billing.trialEndsAt}
              {typeof billing.trialDaysRemaining === "number" ? ` · ${billing.trialDaysRemaining} days remaining` : ""}
            </div>
          )}
          {billing.currentPeriodEnd && (
            <div className="muted" style={{ fontSize: 13 }}>current period ends {billing.currentPeriodEnd}{billing.cancelAtPeriodEnd ? " · cancels at period end" : ""}</div>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Usage meters</h2>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Entitlement usage — distinct from grants; access is never inferred from these.</div>
        <div className="list">
          {billing.usageMeters.map((meter: UsageMeter) => (
            <div className="item" key={meter.id}>
              <strong>{meter.featureCode}</strong>
              <div className="status">{meter.usedValue}/{meter.limitValue ?? "fair"}</div>
              {(meter.periodStart || meter.periodEnd) && (
                <div className="muted" style={{ fontSize: 12 }}>{meter.periodStart ?? "—"} → {meter.periodEnd ?? "—"}</div>
              )}
            </div>
          ))}
          {!billing.usageMeters.length && <div className="muted">No usage meters.</div>}
        </div>
      </section>

      <section className="panel">
        <h2>Grant access</h2>
        <div className="row">
          <select className="input" style={{ maxWidth: 200 }} value={grantKind} onChange={(e) => setGrantKind(e.target.value as AdminGrantKind)}>
            {GRANT_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <button className="button" onClick={onGrant}>Grant</button>
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>A grant is free access — labeled distinctly, never faking paid provider state. Requires a reason (recorded in the audit log).</div>
      </section>

      <section className="panel">
        <h2>Grant history</h2>
        <div className="list">
          {billing.events.map((e: SubscriptionEvent) => {
            const isActiveGrant = e.eventType === "manual_grant" && !!e.correlationId && !revokedIds.has(e.correlationId);
            return (
              <div className="item" key={e.id}>
                <div className="row between">
                  <strong>{e.eventType}{e.grantKind ? ` · ${e.grantKind}` : ""}</strong>
                  {isActiveGrant && (
                    <button className="button" style={DANGER} onClick={() => onRevokeGrant(e.correlationId as string)}>Revoke</button>
                  )}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {e.createdAt}
                  {e.adminSubject ? ` · ${e.adminSubject}` : ""}
                  {e.reason ? ` · "${e.reason}"` : ""}
                </div>
                {(e.startsAt || e.endsAt) && (
                  <div className="muted" style={{ fontSize: 12 }}>{e.startsAt ?? "—"} → {e.endsAt ?? "—"}</div>
                )}
              </div>
            );
          })}
          {!billing.events.length && <div className="muted">No grant history.</div>}
        </div>
      </section>
    </>
  );
}

// ── Activity ────────────────────────────────────────────────────────────────
function ActivityTab({ counts }: { counts: Household360["counts"] }) {
  const rows: Array<[string, number]> = [
    ["Members", counts.members],
    ["Active members", counts.activeMembers],
    ["Purchases", counts.purchases],
    ["Receipts", counts.receipts],
    ["Shopping items", counts.shoppingItems]
  ];
  return (
    <section className="panel">
      <h2>Activity</h2>
      <div className="grid two">
        {rows.map(([label, value]) => (
          <div className="item" key={label}>
            <strong>{value}</strong>
            <div className="muted">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Ops ─────────────────────────────────────────────────────────────────────
function OpsTab({
  ops,
  integrityFlags,
  activeMembers,
  repairMemberId,
  setRepairMemberId,
  onRepairOwner
}: {
  ops: Household360["ops"];
  integrityFlags: string[];
  activeMembers: Member[];
  repairMemberId: string;
  setRepairMemberId: (id: string) => void;
  onRepairOwner: () => void;
}) {
  return (
    <>
      <section className="panel">
        <h2>Operational health</h2>
        <div className="grid two">
          <div className="item">
            <strong>{ops.failedWaMessageCount}</strong>
            <div className="muted">failed WA messages</div>
          </div>
          <div className="item">
            <strong>{ops.pendingInviteCount}</strong>
            <div className="muted">pending invites</div>
          </div>
          <div className="item">
            <strong>{ops.staleInviteCount}</strong>
            <div className="muted">stale invites</div>
          </div>
        </div>
        <h3 style={{ marginBottom: 6 }}>Integrity flags</h3>
        <div className="row">
          {integrityFlags.map((flag) => (
            <span key={flag} className="status error">{flag}</span>
          ))}
          {!integrityFlags.length && <span className="muted">None.</span>}
        </div>
      </section>

      <section className="panel" style={{ borderColor: "var(--rose)" }}>
        <h2 style={{ color: "var(--rose)" }}>Danger zone — repair owner</h2>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          Promotes an active member to owner. Use ONLY to recover an ownerless or owner-mismatched household. Confirmation + a reason are required, and the action is audited.
        </div>
        <div className="row">
          <select className="input" style={{ maxWidth: 280 }} value={repairMemberId} onChange={(e) => setRepairMemberId(e.target.value)}>
            <option value="">Select an active member…</option>
            {activeMembers.map((m) => (
              <option key={m.memberId} value={m.memberId}>{m.displayName ?? m.userId} ({m.role}){m.isOwner ? " · owner" : ""}</option>
            ))}
          </select>
          <button className="button" style={DANGER} onClick={onRepairOwner}>Repair owner</button>
        </div>
      </section>
    </>
  );
}

// ── Notes & Audit ─────────────────────────────────────────────────────────
function NotesAuditTab({
  notes,
  audit,
  noteBody,
  setNoteBody,
  onAddNote
}: {
  notes: SupportNote[];
  audit: AuditEntry[];
  noteBody: string;
  setNoteBody: (v: string) => void;
  onAddNote: (event: React.FormEvent) => void;
}) {
  return (
    <div className="grid two">
      <section className="panel">
        <h2>Support notes ({notes.length})</h2>
        <form className="list" onSubmit={onAddNote}>
          <input className="input" placeholder="note (min 3 chars)" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
          <button className="button" type="submit">Add note</button>
        </form>
        <div className="list" style={{ marginTop: 10 }}>
          {notes.map((n) => (
            <div className="item" key={n.id}>
              <strong>{n.adminSubject}</strong>
              <div>{n.body}</div>
              <div className="muted" style={{ fontSize: 12 }}>{n.createdAt}</div>
            </div>
          ))}
          {!notes.length && <div className="muted">No notes.</div>}
        </div>
      </section>

      <section className="panel">
        <h2>Audit ({audit.length})</h2>
        <div className="list">
          {audit.map((a) => (
            <div className="item" key={a.id}>
              <strong>{a.action}</strong>
              <div className="muted" style={{ fontSize: 12 }}>
                {a.createdAt}
                {a.adminSubject ? ` · ${a.adminSubject}` : ""}
                {a.reason ? ` · "${a.reason}"` : ""}
              </div>
            </div>
          ))}
          {!audit.length && <div className="muted">No admin actions yet.</div>}
        </div>
      </section>
    </div>
  );
}

// ── Invites ─────────────────────────────────────────────────────────────────
function InvitesSection({ invites }: { invites: Invite[] }) {
  const now = Date.now();
  return (
    <section className="panel">
      <h2>Invites ({invites.length})</h2>
      <div className="list">
        {invites.map((inv) => {
          // 'stale' = a still-'pending' invite whose expiry has passed.
          const stale = inv.state === "pending" && Date.parse(inv.expiresAt) < now;
          const cls = inv.state === "consumed" ? "" : inv.state === "expired" || stale ? "error" : "warn";
          const label = stale ? "stale" : inv.state;
          return (
            <div className="item" key={inv.id}>
              <div className="row between">
                <strong>{inv.invitedName ?? "(no name)"}</strong>
                <span className={`status ${cls}`}>{label}</span>
              </div>
              <div className="muted">{inv.invitedPhoneMasked} · {inv.role}</div>
              <div className="muted" style={{ fontSize: 12 }}>expires {inv.expiresAt}{inv.consumedAt ? ` · consumed ${inv.consumedAt}` : ""}</div>
            </div>
          );
        })}
        {!invites.length && <div className="muted">No invites.</div>}
      </div>
    </section>
  );
}
