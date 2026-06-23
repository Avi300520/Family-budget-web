import Link from "next/link";

/**
 * The single admin navigation rail. Admin V2 is ONE unified workspace centered on
 * Household 360 — so there is exactly ONE primary destination (Dashboard). Legacy
 * operational detail + user management live behind the secondary "Advanced tools"
 * link, NOT as co-equal primary tabs.
 */
export function AdminRail({ active, adminEmail }: { active?: "dashboard" | "advanced"; adminEmail?: string }) {
  return (
    <aside className="nav">
      <div className="brand">Admin · Household 360</div>
      <div className="list">
        <Link href="/" style={{ color: "white", fontWeight: active === "dashboard" ? 800 : 400 }}>
          Dashboard
        </Link>
      </div>
      <div style={{ marginTop: "auto" }}>
        <Link
          href="/advanced"
          style={{ display: "block", fontSize: 12, marginBottom: 10, color: active === "advanced" ? "#fff" : "#94a3b8" }}
        >
          Advanced tools →
        </Link>
        {adminEmail && (
          <div className="muted" style={{ fontSize: 12, color: "#cbd5e1" }}>
            Signed in via Cloudflare Access
            <br />
            {adminEmail}
          </div>
        )}
      </div>
    </aside>
  );
}
