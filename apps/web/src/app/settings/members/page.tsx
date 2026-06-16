"use client";

import { Check, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Household, HouseholdMember, HouseholdRole } from "@shopping-assistant/shared-types";
import { ApiClientError } from "@shopping-assistant/api-client";
import { AppShell } from "../../../components/AppShell";
import { Avatar } from "../../../components/Avatar";
import { LoadState } from "../../../components/LoadState";
import { PhoneInput } from "../../../components/PhoneInput";
import { api } from "../../../lib/api";
import { DEFAULT_COUNTRY_ISO, dialForIso, toE164 } from "../../../lib/countryCodes";
import { useViewer } from "../../../lib/useViewer";
import { canManageHouseholdMembers, isOwnerOrAdmin } from "../../../lib/settingsView";

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  admin: "מנהל",
  adult_member: "חבר מבוגר",
  limited_member: "חבר מוגבל"
};

type MemberRow = HouseholdMember & { displayName?: string; phoneE164?: string };

/**
 * Honest Hebrew error copy (2026-06-12 invite-403 incident): an auth/session
 * failure must never be reported as "check the phone number". The api-client
 * already self-heals a stale CSRF once via /me — if the failure still reaches
 * here, the session itself needs a fresh login.
 */
function describeMemberActionError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) {
    if (err.code === "auth.csrf_invalid" || err.code === "auth.unauthorized" || err.status === 401) {
      return "החיבור לחשבון פג. רעננו את הדף ונסו שוב — ואם זה חוזר, התחברו מחדש.";
    }
    if (err.code === "auth.forbidden") {
      return "רק בעלים או מנהל יכולים לבצע את הפעולה הזו.";
    }
  }
  return fallback;
}

export default function MembersPage() {
  const viewer = useViewer();
  // A household manager (owner/admin or an adult_member co-manager) may invite/edit/remove
  // members; this mirrors the backend gate so we never render an action that 403s.
  const canManage = viewer.status === "ready" && canManageHouseholdMembers(viewer.caps);
  // Assigning the admin role / changing a member's role stays owner/admin-only (a co-manager
  // cannot mint managers) — so the role controls are gated more tightly than `canManage`.
  const canAssignRoles = isOwnerOrAdmin(viewer.caps);
  const [household, setHousehold] = useState<Household>();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteCountryIso, setInviteCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [inviteLocalPhone, setInviteLocalPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string>();
  const [inviteRole, setInviteRole] = useState("adult_member");
  const [inviteLimit, setInviteLimit] = useState<string>("");
  const [joinLink, setJoinLink] = useState<string>();
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  // Inline-edit state. Only one member is editable at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<HouseholdRole>("adult_member");
  const [editBudget, setEditBudget] = useState<string>("");
  // Co-manager flag (permissions.all) — owner/admin only; grants an adult_member full
  // household-management capability (spouse / co-manager).
  const [editCoManager, setEditCoManager] = useState(false);

  async function load() {
    setError(undefined);
    try {
      const current = await api.currentHousehold();
      setHousehold(current.household);
      const { members: list } = await api.listMembers(current.household.id);
      setMembers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את רשימת החברים.");
    }
  }

  useEffect(() => { load(); }, []);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (!household) return;
    setPhoneError(undefined);
    const e164 = toE164(dialForIso(inviteCountryIso), inviteLocalPhone);
    if (!e164) {
      setPhoneError("מספר הטלפון לא נראה תקין.");
      return;
    }
    setWorking(true);
    setError(undefined);
    setJoinLink(undefined);
    try {
      const personalBudgetMonthly = inviteLimit === "" ? null : Number(inviteLimit);
      const result = await api.inviteMember(household.id, {
        phone: e164,
        displayName: inviteName.trim() || undefined,
        role: inviteRole,
        personalBudgetMonthly
      });
      setJoinLink(result.joinLink);
      setInviteName("");
      setInviteLocalPhone("");
      setInviteLimit("");
      await load();
    } catch (err) {
      setError(describeMemberActionError(err, "לא הצלחנו לשלוח את ההזמנה. בדקו את המספר ונסו שוב."));
    } finally {
      setWorking(false);
    }
  }

  async function removeMember(memberId: string) {
    if (!household) return;
    if (!confirm("להסיר את החבר?")) return;
    setError(undefined);
    try {
      await api.removeMember(household.id, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      setError(describeMemberActionError(err, "לא הצלחנו להסיר את החבר."));
    }
  }

  function beginEdit(m: MemberRow) {
    setEditingId(m.id);
    setEditRole(m.role);
    setEditBudget(m.personalBudgetMonthly != null ? String(m.personalBudgetMonthly) : "");
    setEditCoManager((m.permissions as { all?: boolean } | undefined)?.all === true);
    setError(undefined);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(memberId: string) {
    if (!household) return;
    setError(undefined);
    try {
      const body: { role?: HouseholdRole; personalBudgetMonthly?: number | null; permissions?: { all: boolean } } = {};
      // Role + permissions changes are owner/admin-only; a co-manager edits the personal
      // budget only and must NOT send them (the backend would 403 on a privilege change).
      if (canAssignRoles) {
        body.role = editRole;
        // The co-manager flag only applies to an adult_member; for other roles it is moot.
        if (editRole === "adult_member") body.permissions = { all: editCoManager };
      }
      body.personalBudgetMonthly = editBudget.trim() === "" ? null : Number(editBudget);
      await api.updateMember(household.id, memberId, body);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(describeMemberActionError(err, "לא הצלחנו לעדכן את החבר."));
    }
  }

  if (!household) return <AppShell><LoadState error={error} /></AppShell>;

  const activeMembers = members.filter((m) => m.status === "active");

  return (
    <AppShell>
      <h1 className="page-title">חברי הבית — {household.name}</h1>

      <section className="panel" style={{ marginBottom: 24 }}>
        <h2>חברים פעילים</h2>
        {activeMembers.length === 0 && <p className="muted">אין חברים נוספים עדיין.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {activeMembers.map((m) => {
            const isEditing = editingId === m.id;
            const displayName = m.displayName ?? m.phoneE164 ?? "חבר";
            return (
              <div key={m.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--cream-3)" }}>
                {!isEditing ? (
                  <div className="row between" style={{ alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar memberId={m.userId} displayName={m.displayName} colorKey={m.color} size="lg" />
                      <div>
                        <span style={{ fontWeight: 700 }}>{displayName}</span>
                        <span className="muted" style={{ marginInlineStart: 8, fontSize: "0.85rem" }}>{ROLE_LABELS[m.role] ?? m.role}</span>
                        {m.phoneE164 && m.displayName && (
                          <span className="muted" style={{ marginInlineStart: 8, fontSize: "0.8rem" }} dir="ltr">{m.phoneE164}</span>
                        )}
                        {m.personalBudgetMonthly != null && (
                          <span className="muted" style={{ marginInlineStart: 8, fontSize: "0.85rem" }}>
                            · תקציב אישי {m.personalBudgetMonthly.toLocaleString()} ₪/חודש
                          </span>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div style={{ display: "flex", gap: 6 }}>
                        {m.role !== "owner" && (
                          <button className="button secondary" onClick={() => beginEdit(m)} style={{ padding: "4px 8px" }} title="ערוך">
                            <Pencil size={14} aria-hidden />
                          </button>
                        )}
                        {m.role !== "owner" && (
                          <button className="button secondary" onClick={() => removeMember(m.id)} style={{ padding: "4px 8px" }} title="הסר">
                            <Trash2 size={14} aria-hidden />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar memberId={m.userId} displayName={m.displayName} colorKey={m.color} size="lg" />
                      <span style={{ fontWeight: 700 }}>{displayName}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {canAssignRoles && (
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                          תפקיד
                          <select className="input" value={editRole} onChange={(e) => setEditRole(e.target.value as HouseholdRole)}>
                            <option value="admin">מנהל</option>
                            <option value="adult_member">חבר מבוגר</option>
                            <option value="limited_member">חבר מוגבל</option>
                          </select>
                        </label>
                      )}
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                        תקציב אישי חודשי (₪, ריק = ללא)
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={100000}
                          value={editBudget}
                          placeholder="למשל: 300"
                          onChange={(e) => setEditBudget(e.target.value)}
                        />
                      </label>
                    </div>
                    {canAssignRoles && editRole === "adult_member" && (
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={editCoManager}
                          onChange={(e) => setEditCoManager(e.target.checked)}
                        />
                        מנהל/ת שותף/ה — גישת ניהול מלאה (הזמנת חברים, הגדרות בית ותקציבים)
                      </label>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="button" onClick={() => saveEdit(m.id)} style={{ padding: "4px 10px" }}>
                        <Check size={14} aria-hidden /> שמירה
                      </button>
                      <button className="button secondary" onClick={cancelEdit} style={{ padding: "4px 10px" }}>
                        <X size={14} aria-hidden /> ביטול
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {viewer.status === "ready" && !canManage && (
        <section className="panel">
          <p className="muted">לצפייה בלבד. ניהול חברי הבית (הזמנה, עריכה והסרה) זמין לבעלים, למנהל ולבן/בת זוג מנהל/ת.</p>
        </section>
      )}

      {canManage && (
      <section className="panel">
        <h2>מוסיפים בן משפחה</h2>
        <p className="muted" style={{ marginTop: 4, marginBottom: 12 }}>נשלח לו הזמנה בוואטסאפ. הוא מצטרף בלחיצה.</p>
        <form className="form" onSubmit={invite}>
          <label>
            שם
            <input
              className="input"
              value={inviteName}
              placeholder="למשל: דוד"
              autoComplete="name"
              onChange={(e) => setInviteName(e.target.value)}
            />
          </label>
          <div>
            <label htmlFor="invite-phone" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>מספר טלפון</label>
            <PhoneInput
              id="invite-phone"
              countryIso={inviteCountryIso}
              onCountryChange={(iso) => { setInviteCountryIso(iso); setPhoneError(undefined); }}
              phone={inviteLocalPhone}
              onPhoneChange={(v) => { setInviteLocalPhone(v); setPhoneError(undefined); }}
              placeholder="052-660-6680"
              phoneAriaLabel="מספר טלפון מקומי"
              invalid={Boolean(phoneError)}
            />
            {phoneError && (
              <div style={{ color: "var(--neg)", fontSize: "0.82rem", marginTop: 4 }}>
                {phoneError}
              </div>
            )}
          </div>
          <label>
            תפקיד
            <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {/* Inviting an admin mints a manager — owner/admin only. */}
              {canAssignRoles && <option value="admin">מנהל</option>}
              <option value="adult_member">חבר מבוגר</option>
              <option value="limited_member">חבר מוגבל</option>
            </select>
          </label>
          <label>
            תקציב אישי חודשי (₪, אופציונלי)
            <input
              className="input"
              type="number"
              min={1}
              max={100000}
              value={inviteLimit}
              placeholder="למשל: 300"
              onChange={(e) => setInviteLimit(e.target.value)}
            />
          </label>
          <button className="button" type="submit" disabled={working || !inviteLocalPhone.trim()}>
            <UserPlus size={18} aria-hidden />
            שליחת הזמנה
          </button>
        </form>

        {joinLink && (
          <div className="status" style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8 }}>ההזמנה נשלחה בוואטסאפ 👍</div>
            <a className="button secondary" href={joinLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              פתח את קישור ההצטרפות
            </a>
          </div>
        )}
        {error && <div className="status error" style={{ marginTop: 12 }}>{error}</div>}
      </section>
      )}
    </AppShell>
  );
}
