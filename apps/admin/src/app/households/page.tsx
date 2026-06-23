"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, isTransportError, toErrorMessage } from "../../lib/api";

// Derive the row shape from the api-client return type (the shared-types DTOs and
// the AdminHouseholdSearchBy union live in @shopping-assistant/shared-types, which is
// NOT directly resolvable from the admin app — only api-client is symlinked — and the
// api-client does not re-export them). We mirror the existing `Awaited<ReturnType<...>>`
// convention the Operations page uses for adminOverview. The `by` union is the first
// parameter of adminSearchHouseholds, so it stays in lock-step with the contract.
type SearchResponse = Awaited<ReturnType<typeof api.adminSearchHouseholds>>;
type HouseholdRow = SearchResponse["households"][number];
type AdminHouseholdSearchBy = Parameters<typeof api.adminSearchHouseholds>[0];

export default function AdminHouseholdsPage() {
  const [error, setError] = useState<string>();
  const [canReload, setCanReload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>();

  const [by, setBy] = useState<AdminHouseholdSearchBy>("phone");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<HouseholdRow[]>();

  function fail(err: unknown, context?: string) {
    setError(toErrorMessage(err, context));
    // Reload only for a transport/Access-challenge failure (no HTTP status); a real
    // 4xx/5xx is shown honestly with its status and is not "fixed" by reloading.
    setCanReload(isTransportError(err));
  }

  // Identify the verified Cloudflare Access admin on load (surfaces an Access error early).
  useEffect(() => {
    api.adminAuthMe().then((me) => setAdminEmail(me.adminEmail)).catch((err) => fail(err, "admin identity"));
  }, []);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await api.adminSearchHouseholds(by, q.trim());
      setResults(res.households);
    } catch (err) {
      fail(err, "household search");
    } finally {
      setBusy(false);
    }
  }

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
          <h1 className="page-title">Households</h1>
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
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>Owner phone is masked. Full reveal is audited, on the household page.</div>
        </section>

        {results && (
          <section className="panel">
            <h2>Results ({results.length})</h2>
            <div className="list">
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
                    <span className={`status ${billingClass(r.effectiveBillingStatus)}`}>{r.effectiveBillingStatus}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{r.memberCount} {r.memberCount === 1 ? "member" : "members"}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>id {r.householdId}{r.lastWaActivityAt ? ` · last WA ${r.lastWaActivityAt}` : ""}</div>
                </Link>
              ))}
              {!results.length && <div className="muted">No households found.</div>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function billingClass(status: string): string {
  if (status === "active" || status === "paid") return "";
  if (status === "expired" || status === "canceled" || status === "cancelled") return "error";
  return "warn";
}
