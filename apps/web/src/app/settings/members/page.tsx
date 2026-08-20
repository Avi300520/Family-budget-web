"use client";

import { Check, MessageCircle, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Household, HouseholdMember, HouseholdRole } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { Avatar } from "../../../components/Avatar";
import { LoadState } from "../../../components/LoadState";
import { PhoneInput } from "../../../components/PhoneInput";
import { announce } from "../../../lib/a11y/announce";
import { api } from "../../../lib/api";
import { DEFAULT_COUNTRY_ISO, dialForIso, toE164 } from "../../../lib/countryCodes";
import { describeMemberActionError } from "../../../lib/memberActionError";
import { useViewer } from "../../../lib/useViewer";
import { canManageHouseholdMembers, isOwnerOrAdmin } from "../../../lib/settingsView";

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  admin: "מנהל",
  adult_member: "חבר מבוגר",
  limited_member: "בן/בת בית"
};

/** Chip accent per role - owner reads as the household anchor (teal). */
const ROLE_CHIP: Record<string, string> = {
  owner: "teal",
  admin: "ocean",
  adult_member: "sage",
  limited_member: "mustard"
};

/**
 * Role picker cards — same submitted values as the former <select> options
 * (admin / adult_member / limited_member); only the presentation changed.
 * `managerOnly` mirrors the old gate: assigning admin is owner/admin-only.
 */
type RoleOption = {
  value: string;
  title: string;
  sub: string;
  color: string;
  managerOnly?: boolean;
};

const ROLE_OPTIONS: RoleOption[] = [
  { value: "admin", title: "בן/בת זוג", sub: "הרשאות מלאות - רואה ומנהל הכול", color: "var(--m-mom)", managerOnly: true },
  { value: "adult_member", title: "חבר מבוגר", sub: "רואה את התקציב ומוסיף הוצאות", color: "var(--m-teen)" },
  { value: "limited_member", title: "בן/בת בית", sub: "מעדכן ומבקש אישור - בלי לראות הכול", color: "var(--m-kid)" }
];

function RolePicker({
  value,
  onChange,
  options,
  label = "בחירת תפקיד"
}: {
  value: string;
  onChange: (value: string) => void;
  options: RoleOption[];
  /** Group name. Two pickers can be on screen at once (invite form + inline editor),
   *  so the name must say WHICH one; it also has to contain the visible "תפקיד" text (2.5.3). */
  label?: string;
}) {
  return (
    <div className="role-cards" role="group" aria-label={label}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className="role-card"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
          >
            <span className="avatar sm" style={{ background: opt.color }} aria-hidden />
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
              <span className="role-card__title">{opt.title}</span>
              <span className="role-card__sub">{opt.sub}</span>
            </span>
            <span
              aria-hidden
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                border: selected ? "none" : "1.5px solid var(--cream-4)",
                background: selected ? "var(--teal)" : "transparent",
                color: "var(--on-color)"
              }}
            >
              {selected ? <Check size={14} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type MemberRow = HouseholdMember & {
  displayName?: string;
  phoneE164?: string;
  // Some backends surface a not-yet-active invitee's intended name/phone on the
  // member row; fall back to displayName/phoneE164 when they're absent.
  invitedName?: string;
  invitedPhone?: string;
};

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
  // Attempt counter, used only as the alert's `key` so a repeated identical validation
  // message still remounts the alert node and is therefore announced again.
  const [phoneErrorAt, setPhoneErrorAt] = useState(0);
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
  // Focus bookkeeping (2.4.3). Every one of these interactions unmounts the control that
  // was just activated: a removal deletes the row, opening the editor replaces the row,
  // saving/cancelling replaces the editor back. Without a target, focus falls to <body>.
  const membersHeadingRef = useRef<HTMLHeadingElement>(null);
  const editBudgetRef = useRef<HTMLInputElement>(null);
  const lastEditedRef = useRef<string | null>(null);
  // Set by removeMember/cancelInvite; consumed by the guarded focus effect below.
  const pendingRemovalFocusRef = useRef(false);

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

  // Opening the editor moves focus into it; closing it (save or cancel) returns focus to
  // the row's edit button, which is the control the user came from.
  useEffect(() => {
    if (editingId) {
      editBudgetRef.current?.focus();
      return;
    }
    const back = lastEditedRef.current;
    if (!back) return;
    lastEditedRef.current = null;
    document.querySelector<HTMLElement>(`[data-member-edit="${CSS.escape(back)}"]`)?.focus();
  }, [editingId]);

  // 3.3.1 - focus the invalid phone field only AFTER React has committed `aria-invalid` +
  // `aria-describedby` and mounted #invite-phone-error. Focusing synchronously inside the
  // submit handler lands before the commit, so the reader announces the field as valid and
  // loses the description entirely.
  useEffect(() => {
    if (!phoneError) return;
    document.getElementById("invite-phone")?.focus();
  }, [phoneError]);

  // 2.4.3 - focus repair after a removal / invite cancellation. It has to live in an effect
  // keyed on `members`, not inline in the handler: React commits the removal asynchronously,
  // so at the end of removeMember/cancelInvite the activated button is still mounted and still
  // focused - reading document.activeElement there would always see the button, never <body>,
  // and the orphan guard would swallow every legitimate repair. By the time this effect runs
  // the row is gone, so the test is meaningful. Same idiom as ShareList / shopping-list.
  useEffect(() => {
    if (!pendingRemovalFocusRef.current) return;
    pendingRemovalFocusRef.current = false;
    // Only step in if the removal actually orphaned focus. A keyboard user who Tabbed onward
    // during the round-trip keeps their place instead of being yanked back to the heading.
    const ae = document.activeElement;
    if (ae && ae !== document.body) return;
    membersHeadingRef.current?.focus();
  }, [members]);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    // Re-entrancy guard: the submit button no longer disables itself (see its comment).
    if (!household || working) return;
    setPhoneError(undefined);
    const e164 = toE164(dialForIso(inviteCountryIso), inviteLocalPhone);
    if (!e164) {
      // role="alert" fires when the alert node is INSERTED, so writing the SAME string into an
      // already-mounted alert is silent - and the setPhoneError(undefined) above does not save
      // it, because React batches both updates into one commit with no intermediate render. The
      // alert is keyed on this counter instead, so it remounts and speaks on every attempt
      // (3.3.1 / 4.1.3). Focus is moved by the effect above, once the aria attrs are committed.
      setPhoneError("מספר הטלפון לא נראה תקין.");
      setPhoneErrorAt((n) => n + 1);
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
      // The join-link block is not a pre-existing live region, and the form fields just
      // cleared under the user - announce the result explicitly (4.1.3).
      announce("ההזמנה נשלחה בוואטסאפ");
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
      // The row holding focus unmounts - the effect above parks focus on the list heading
      // instead of letting it fall to <body> (2.4.3). Announce it here either way: the row
      // simply disappears, there is no visible success copy.
      pendingRemovalFocusRef.current = true;
      announce("החבר הוסר.");
    } catch (err) {
      setError(describeMemberActionError(err, "לא הצלחנו להסיר את החבר."));
    }
  }

  // Revoking a pending invite is a member-row removal (status -> removed) on the
  // invited row; reuses the same DELETE endpoint as removeMember.
  async function cancelInvite(m: MemberRow) {
    if (!household) return;
    const who = m.invitedName ?? m.displayName ?? m.invitedPhone ?? m.phoneE164 ?? "המוזמן";
    if (!confirm(`לבטל את ההזמנה ל-${who}?`)) return;
    setError(undefined);
    try {
      await api.removeMember(household.id, m.id);
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
      // Same as removeMember - and when this was the last invite, the whole "הזמנות שנשלחו"
      // section unmounts with the activated button inside it.
      pendingRemovalFocusRef.current = true;
      announce("ההזמנה בוטלה.");
    } catch (err) {
      setError(describeMemberActionError(err, "לא הצלחנו לבטל את ההזמנה."));
    }
  }

  function beginEdit(m: MemberRow) {
    lastEditedRef.current = m.id;
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
      announce("נשמר");
      await load();
    } catch (err) {
      setError(describeMemberActionError(err, "לא הצלחנו לעדכן את החבר."));
    }
  }

  // Loading AND load-failure share this branch, so it needs the page's own <h1>.
  if (!household) {
    return (
      <AppShell>
        <h1 className="page-title">חברי הבית</h1>
        <LoadState error={error} />
      </AppShell>
    );
  }

  const activeMembers = members.filter((m) => m.status === "active");
  const pendingInvites = members.filter((m) => m.status === "invited");

  return (
    <AppShell>
      <h1 className="page-title">חברי הבית - {household.name}</h1>

      <section className="panel" style={{ marginBottom: 24 }}>
        {/* tabIndex=-1 so a removal can park focus here (2.4.3). Not in the tab order. */}
        <h2 ref={membersHeadingRef} tabIndex={-1}>חברים פעילים</h2>
        {activeMembers.length === 0 && <p className="muted">אין חברים נוספים עדיין.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {activeMembers.map((m) => {
            const isEditing = editingId === m.id;
            const displayName = m.displayName ?? m.phoneE164 ?? "חבר";
            return (
              <div key={m.userId} style={{ padding: "10px 0", borderBottom: "1px solid var(--cream-3)" }}>
                {!isEditing ? (
                  <div className="row between" style={{ alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar memberId={m.userId} displayName={m.displayName} colorKey={m.color} size="lg" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700 }}>{displayName}</span>
                          <span className={`chip ${ROLE_CHIP[m.role] ?? "teal"}`}>{ROLE_LABELS[m.role] ?? m.role}</span>
                        </div>
                        {((m.phoneE164 && m.displayName) || m.personalBudgetMonthly != null) && (
                          <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {m.phoneE164 && m.displayName && (
                              <span className="mono muted" style={{ fontSize: "0.8rem" }} dir="ltr">{m.phoneE164}</span>
                            )}
                            {m.personalBudgetMonthly != null && (
                              <span className="muted" style={{ fontSize: "0.85rem" }}>
                                תקציב אישי {m.personalBudgetMonthly.toLocaleString()} ₪/חודש
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div style={{ display: "flex", gap: 6 }}>
                        {/* Icon-only and repeated once per row: `title` alone was a weak name and
                            said nothing about WHICH member. .sr-only text INSIDE the button (not an
                            aria-label) keeps the name and the pixels from drifting apart. */}
                        {m.role !== "owner" && (
                          <button className="button secondary" data-member-edit={m.id} onClick={() => beginEdit(m)} style={{ padding: "4px 8px" }} title="ערוך">
                            <Pencil size={14} aria-hidden />
                            <span className="sr-only">עריכת {displayName}</span>
                          </button>
                        )}
                        {m.role !== "owner" && (
                          <button className="button secondary" onClick={() => removeMember(m.id)} style={{ padding: "4px 8px" }} title="הסר">
                            <Trash2 size={14} aria-hidden />
                            <span className="sr-only">הסרת {displayName}</span>
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
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, width: "100%" }}>
                          תפקיד
                          <RolePicker
                            value={editRole}
                            onChange={(v) => setEditRole(v as HouseholdRole)}
                            options={ROLE_OPTIONS}
                            label={`תפקיד - ${displayName}`}
                          />
                        </div>
                      )}
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                        תקציב אישי חודשי (₪, ריק = ללא)
                        <input
                          ref={editBudgetRef}
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
                        מנהל/ת שותף/ה - גישת ניהול מלאה (הזמנת חברים, הגדרות בית ותקציבים)
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

      {/* Pending invites - manager-only; invitee phone is never exposed to non-managers
          (the whole block is gated by canManage, and the backend strips phone for limited). */}
      {canManage && pendingInvites.length > 0 && (
        <section className="panel" style={{ marginBottom: 24 }}>
          <h2>הזמנות שנשלחו</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {pendingInvites.map((m) => {
              const name = m.invitedName ?? m.displayName ?? m.invitedPhone ?? m.phoneE164 ?? "מוזמן";
              const phone = m.phoneE164 ?? m.invitedPhone;
              return (
                <div key={m.userId} className="row between" style={{ alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--cream-3)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span className="avatar" style={{ background: "var(--cream-4)", color: "var(--text-1)" }} aria-hidden>{name.charAt(0)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600 }}>{name}</span>
                        <span className="chip mustard">ממתין לאישור</span>
                      </div>
                      <div className="muted" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                        {phone && <span className="mono" dir="ltr">{phone}</span>}
                        {phone && " · "}
                        {ROLE_LABELS[m.role] ?? m.role}
                      </div>
                    </div>
                  </div>
                  <button className="button secondary" onClick={() => cancelInvite(m)} style={{ padding: "4px 10px" }} title="ביטול ההזמנה">
                    ביטול<span className="sr-only"> ההזמנה ל{name}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {viewer.status === "ready" && !canManage && (
        <section className="panel">
          <p className="muted">לצפייה בלבד. ניהול חברי הבית (הזמנה, עריכה והסרה) זמין לבעלים, למנהל ולבן/בת זוג מנהל/ת.</p>
        </section>
      )}

      {canManage && (
      <section className="panel">
        <h2>מוסיפים בן משפחה</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 4, marginBottom: 16, fontSize: 13, color: "var(--text-1)", background: "var(--cream-1)", padding: "10px 12px", borderRadius: 11 }}>
          <MessageCircle size={18} color="var(--pos)" aria-hidden style={{ flexShrink: 0 }} />
          נשלח לו הזמנה בוואטסאפ - הוא מצטרף בלחיצה, בלי סיסמה.
        </div>
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
              /* No phoneAriaLabel override here: the field is wired to the visible
                 <label htmlFor="invite-phone"> above, so the accessible name must be that
                 same visible string ("מספר טלפון") rather than a second, different one. */
              invalid={Boolean(phoneError)}
              describedById={phoneError ? "invite-phone-error" : undefined}
            />
            {phoneError && (
              <div key={phoneErrorAt} id="invite-phone-error" role="alert" style={{ color: "var(--neg)", fontSize: "0.82rem", marginTop: 4 }}>
                {phoneError}
              </div>
            )}
          </div>
          <div>
            <span className="label" style={{ display: "block", marginBottom: 6 }}>תפקיד</span>
            {/* Inviting an admin mints a manager - owner/admin only (managerOnly card hidden otherwise). */}
            <RolePicker
              value={inviteRole}
              onChange={setInviteRole}
              options={ROLE_OPTIONS.filter((o) => !o.managerOnly || canAssignRoles)}
            />
          </div>
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
          {/* No `disabled`: submitting is what sets `working`, so disabling the focused button
              drops focus to <body> mid-request (2.4.3) - and after a successful invite the phone
              field is cleared, which used to leave the button disabled with no explanation. An
              empty/invalid number now yields the existing, focusable "מספר הטלפון לא נראה תקין."
              error; invite() guards re-entry on `working`. */}
          <button className="button" type="submit" aria-busy={working || undefined}>
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
        {/* Also carries the inline-edit / remove failures, which render far above -
            role="alert" is what makes them reach the user at all (3.3.1). */}
        {error && <div className="status error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
      </section>
      )}
    </AppShell>
  );
}
