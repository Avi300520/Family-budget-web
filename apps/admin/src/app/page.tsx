"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, isAuthError, isTransportError, toErrorMessage } from "../lib/api";
import { AdminRail } from "./AdminRail";
import { isPreviewHost, DEMO_BANNER, demoCounts, demoIntegrity, demoSearchRows } from "../lib/demo";

// Derive every shape from the api-client return/param types (shared-types is not
// re-exported by api-client). Same convention used across the admin app.
type Counts = Awaited<ReturnType<typeof api.adminOverviewCounts>>;
type Integrity = Awaited<ReturnType<typeof api.adminIntegrity>>;
type SearchResponse = Awaited<ReturnType<typeof api.adminSearchHouseholds>>;
type HouseholdRow = SearchResponse["households"][number];
type AdminHouseholdSearchBy = Parameters<typeof api.adminSearchHouseholds>[0];

export default function AdminDashboard() {
  const [adminEmail, setAdminEmail] = useState<string>();
  const [counts, setCounts] = useState<Counts>();
  const [integrity, setIntegrity] = useState<Integrity>();
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string }>();

  const [by, setBy] = useState<AdminHouseholdSearchBy>("phone");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<HouseholdRow[]>();

  // An auth/transport failure (e.g. this Vercel preview, which is NOT behind
  // Cloudflare Access) is expected. On a PREVIEW host we render a clearly-labeled
  // visual demo so the layout is reviewable; on the production host (never a
  // preview host) we only ever show the calm re-auth notice — never demo data.
  // A real HTTP error is shown honestly. `setX(p => p ?? demo)` never clobbers
  // real data that already loaded.
  function note(err: unknown, context?: string) {
    const authish = isAuthError(err) || isTransportError(err);
    if (authish && isPreviewHost()) {
      setNotice({ tone: "info", text: DEMO_BANNER });
      setCounts((p) => p ?? demoCounts);
      setIntegrity((p) => p ?? demoIntegrity);
      setResults((p) => p ?? demoSearchRows);
      return;
    }
    // Production (non-preview): show the HONEST message — re-authenticate for 401/403,
    // a clear reload-to-reauth notice for a transport/Access-challenged request, or the
    // real status for any other error. NEVER the preview "layout only" copy here.
    setNotice({ tone: authish ? "info" : "error", text: toErrorMessage(err, context) });
  }

  useEffect(() => {
    api.adminAuthMe().then((me) => setAdminEmail(me.adminEmail)).catch((err) => note(err, "admin identity"));
    api.adminOverviewCounts().then(setCounts).catch((err) => note(err, "overview counts"));
    api.adminIntegrity().then(setIntegrity).catch((err) => note(err, "integrity"));
  }, []);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      const res = await api.adminSearchHouseholds(by, q.trim());
      setResults(res.households);
      setNotice(undefined);
    } catch (err) {
      note(err, "household search");
    } finally {
      setBusy(false);
    }
  }

  const integrityRows: Array<[string, number]> = integrity
    ? [
        ["Ownerless households", integrity.ownerlessHouseholds.length],
        ["Owner-column mismatch", integrity.ownerColumnMismatch.length],
        ["Users in >1 household", integrity.multiHouseholdUsers.length],
        ["Duplicate phones", integrity.duplicatePhones.length],
        ["Stale invites", integrity.staleInvites.length],
        ["Failed sends", integrity.failedOutboxCount + integrity.failedWebhookCount],
        ["Billing mismatch", integrity.billingMismatchCount]
      ]
    : [];

  return (
    <div className="shell">
      <AdminRail active="dashboard" adminEmail={adminEmail} />
      <main className="main">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="muted" style={{ marginTop: -8 }}>
          One workspace for every household account. Search a household to open its 360 view — members, billing,
          activity, ops, notes &amp; audit all live inside the account.
        </p>

        {notice && (
          <div
            className={notice.tone === "error" ? "panel status error" : "panel"}
            style={notice.tone === "info" ? { borderInlineStart: "3px solid var(--amber)" } : undefined}
          >
            {notice.text}
          </div>
        )}

        {/* Household lookup — the primary entry point into Household 360. */}
        <section className="panel">
          <h2>Find a household</h2>
          <form className="row" onSubmit={search}>
            <select className="input" style={{ maxWidth: 150 }} value={by} onChange={(e) => setBy(e.target.value as AdminHouseholdSearchBy)}>
              <option value="phone">Phone</option>
              <option value="owner">Owner name</option>
              <option value="id">Household ID</option>
              <option value="user_id">User ID</option>
              <option value="status">Status</option>
            </select>
            <input className="input" style={{ maxWidth: 360 }} placeholder="search term" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="button" type="submit" disabled={busy}>{busy ? "…" : "Search"}</button>
          </form>
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>Owner phone is masked. Full reveal is audited, inside the household 360.</div>
          {results && (
            <div className="list" style={{ marginTop: 12 }}>
              {results.map((r) => (
                <Link
                  key={r.householdId}
                  href={`/households/${r.householdId}`}
                  className="item"
                  style={{ textAlign: "start", display: "block", color: "inherit", textDecoration: "none" }}
                >
                  <div className="row between">
                    <strong>{r.name || "(no name)"}</strong>
                    {r.integrityFlagCount > 0 && (
                      <span className="status error">{r.integrityFlagCount} integrity {r.integrityFlagCount === 1 ? "flag" : "flags"}</span>
                    )}
                  </div>
                  <div className="muted">{r.ownerDisplayName ? `${r.ownerDisplayName} · ` : ""}{r.ownerPhoneMasked}</div>
                  <div className="row" style={{ marginTop: 4 }}>
                    <span className="status">{r.status}</span>
                    <span className="status">{r.planLabel}</span>
                    <span className="status">{r.effectiveBillingStatus}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{r.memberCount} {r.memberCount === 1 ? "member" : "members"}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>id {r.householdId}{r.lastWaActivityAt ? ` · last WA ${r.lastWaActivityAt}` : ""}</div>
                </Link>
              ))}
              {!results.length && <div className="muted">No households found.</div>}
            </div>
          )}
        </section>

        {/* At a glance — bounded counts. */}
        {counts && (
          <section className="panel">
            <h2>At a glance</h2>
            <div className="row">
              {Object.entries(counts.householdsByStatus).map(([status, n]) => (
                <span key={status} className="status">{status} {n}</span>
              ))}
              <span className="status">active trials {counts.activeTrials}</span>
              <span className={`status ${counts.integrityFlagCount > 0 ? "error" : ""}`}>integrity flags {counts.integrityFlagCount}</span>
              <span className={`status ${counts.failedSendsCount > 0 ? "warn" : ""}`}>failed sends {counts.failedSendsCount}</span>
              <span className="status">WA active 7d {counts.waActiveThisWeek}</span>
              <span className="status">dashboard active 7d {counts.dashboardActiveThisWeek}</span>
            </div>
          </section>
        )}

        {/* Integrity & support queue. */}
        {integrity && (
          <section className="panel">
            <h2>Integrity &amp; support queue</h2>
            <div className="grid two">
              {integrityRows.map(([label, n]) => (
                <div className="item" key={label}>
                  <strong className={n > 0 ? undefined : "muted"}>{n}</strong>
                  <div className="muted">{label}</div>
                </div>
              ))}
            </div>
            {integrity.ownerlessHouseholds.length > 0 && (
              <div className="list" style={{ marginTop: 10 }}>
                <div className="muted">Ownerless households — open to repair:</div>
                {integrity.ownerlessHouseholds.map((h) => (
                  <Link key={h.householdId} href={`/households/${h.householdId}`} className="item" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
                    <div className="row between">
                      <strong>{h.name || h.householdId}</strong>
                      <span className="status error">ownerless</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {!counts && !integrity && !notice && <div className="panel">Loading…</div>}
      </main>
    </div>
  );
}
