"use client";

import { Check, ChevronDown, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Household,
  HouseholdMember,
  ShoppingCategoryId,
  ShoppingListItem,
} from "@shopping-assistant/shared-types";
import {
  SHOPPING_CATEGORIES,
  shoppingCategoryMeta,
} from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { Avatar } from "../../components/Avatar";
import { LoadState } from "../../components/LoadState";
import { announce } from "../../lib/a11y/announce";
import { api } from "../../lib/api";

// ── Visual category color mapping (Iteration 4) ──────────────────────────────
// Every CSS variable here is already defined in tokens.css - no new hex.
const CATEGORY_COLORS: Record<ShoppingCategoryId, string> = {
  vegetables: "var(--sage)",
  bakery:     "var(--mustard)",
  dairy:      "var(--teal)",
  pantry:     "var(--ocean)",
  snacks:     "var(--berry)",
  frozen:     "var(--plum)",
  household:  "var(--coral)",
};

type MemberInfo = { userId: string; displayName?: string; colorKey?: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
// categoryId is always set: new items are categorized at insert time; legacy
// pre-0017 rows are categorized via Backend read-fallback in rowToShoppingListItem.
function categoryOf(item: ShoppingListItem): ShoppingCategoryId {
  return item.categoryId;
}

function groupByCategory(
  items: ShoppingListItem[]
): Array<{ id: ShoppingCategoryId; nameHe: string; icon: string; order: number; items: ShoppingListItem[] }> {
  const buckets = new Map<ShoppingCategoryId, ShoppingListItem[]>();
  for (const item of items) {
    const c = categoryOf(item);
    const arr = buckets.get(c) ?? [];
    arr.push(item);
    buckets.set(c, arr);
  }
  return SHOPPING_CATEGORIES
    .filter((meta) => buckets.has(meta.id))
    .map((meta) => ({ ...meta, items: buckets.get(meta.id) ?? [] }));
}

// Current Hebrew month-year, e.g. "יוני 2026" - never a raw ISO string.
function currentMonthLabel(): string {
  return new Date().toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

// Hebrew "when" label from an ISO timestamp - today / yesterday / he-IL date.
function formatWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (dayDiff <= 0) return "היום";
  if (dayDiff === 1) return "אתמול";
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
}

// ── ShoppingHeader (counts + WhatsApp send) ───────────────────────────────────
function ShoppingHeader({
  activeCount,
  boughtCount,
  onSend,
  sendStatus,
}: {
  activeCount: number;
  boughtCount: number;
  onSend: () => void;
  sendStatus: "idle" | "sending" | "sent";
}) {
  return (
    <section className="card" style={{ padding: "var(--sp-5)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-4)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 180 }}>
          <h1 className="h2" style={{ marginBottom: 4 }}>רשימת קניות</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            <span className="mono">{activeCount}</span> לקנות · <span className="mono">{boughtCount}</span> נקנו החודש
          </div>
        </div>

        {/* BATCH-GI 2.4.3: `disabled` must never be toggled BY the activation - the button
            disabled itself under the user's finger and focus fell to <body>. sendToWhatsapp()
            already re-entrancy-guards on sendStatus, so aria-disabled is enough while the send
            is in flight and focus is kept. (activeCount===0 is not self-inflicted: it stays a
            real `disabled`, so the .button:disabled dimming for an empty list is unchanged.) */}
        <button
          type="button"
          className="button"
          onClick={onSend}
          disabled={activeCount === 0}
          aria-disabled={sendStatus === "sending"}
          style={{ minWidth: 200 }}
        >
          <Send size={16} aria-hidden />
          {sendStatus === "sending"
            ? "שולח..."
            : sendStatus === "sent"
            ? "נשלח ✓"
            : "שליחת הרשימה לוואטסאפ"}
        </button>
      </div>
    </section>
  );
}

// -- ItemRow: a single to-buy item (active only) -----------------------------
function ItemRow({
  item,
  member,
  color,
  onMarkBought,
  onDelete,
}: {
  item: ShoppingListItem;
  member?: MemberInfo;
  color: string;
  onMarkBought: () => void;
  onDelete: () => void;
}) {
  const name = item.normalizedName ?? item.rawText;
  // BATCH-GI 4.1.2: the check-off control is NAMED BY its own sr-only verb PLUS the visible
  // row title, so the accessible name and the pixels cannot drift apart (the old
  // aria-label="סמן כנקנה" named every row identically and hid which item it was).
  const nameId = `sl-item-${item.id}`;
  const buyVerbId = `sl-buy-${item.id}`;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        gap: "var(--sp-3)",
        alignItems: "center",
        padding: "10px var(--sp-4)",
        borderTop: "1px solid var(--cream-3)",
      }}
    >
      {/* 40px tap target (touch-friendly) with the 22px visual checkbox centered inside.
          BATCH-GI 4.1.2 (Name, Role, Value): the name now carries the item. It stays a plain
          <button> on purpose - role="checkbox" would lie, because the "checked" twin lives in
          the "נקנו החודש" section, which is COLLAPSED by default, so the control would be
          announced unchecked and then vanish instead of flipping. The verb lives in a .sr-only
          span INSIDE the control (the /l idiom) rather than in an aria-label, so it cannot
          drift from the pixels. data-item-control is the focus anchor for the 2.4.3 restore. */}
      <button
        type="button"
        onClick={onMarkBought}
        aria-labelledby={`${buyVerbId} ${nameId}`}
        data-item-control={item.id}
        style={{
          width: 40,
          height: 40,
          display: "grid",
          placeItems: "center",
          background: "none",
          border: 0,
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <span id={buyVerbId} className="sr-only">סמן כנקנה</span>
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            // 1.4.11: on this control the border IS the only affordance, so it uses the
            // form-control boundary token (3.05:1) rather than decorative --cream-4 (1.49:1).
            // NOTE: 1.4.11 is WCAG 2.1, not a 2.0 AA gap.
            border: "1.5px solid var(--field-border)",
            background: "var(--cream-2)",
          }}
        />
      </button>

      <div style={{ minWidth: 0 }}>
        <div
          id={nameId}
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-0)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={name}
        >
          {name}
        </div>
        {item.notes && (
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
            “{item.notes}”
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
        {item.quantity != null && item.quantity > 1 && (
          <span className="mono muted" style={{ fontSize: 12 }}>
            x{item.quantity}
          </span>
        )}
        {member ? (
          // BATCH-GI 1.1.1: Avatar is role="img" and defaults its name to displayName - or to
          // the raw userId (a UUID) when the roster has no name. The "הוסיף:" context existed
          // only in the sighted `title`. Give the image the same sentence the tooltip shows.
          <span title={member.displayName ? `הוסיף: ${member.displayName}` : undefined}>
            <Avatar
              memberId={member.userId}
              displayName={member.displayName}
              colorKey={member.colorKey}
              size="sm"
              ariaLabel={member.displayName ? `הוסיף: ${member.displayName}` : "הוסיף: חבר בית"}
            />
          </span>
        ) : (
          <span style={{ width: 24, height: 24, flexShrink: 0 }} aria-hidden />
        )}
      </div>

      {/* BATCH-GI 4.1.2: aria-label is legitimate HERE - the button's only content is an
          aria-hidden icon, so there is no visible text for the label to override. It just
          has to carry the item, or every row's remove button is named "הסר פריט". */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`הסר פריט: ${name}`}
        className="btn ghost"
        style={{ width: 40, height: 40, padding: 0, borderRadius: 8, display: "grid", placeItems: "center" }}
      >
        <Trash2 size={14} aria-hidden style={{ color: "var(--text-2)" }} />
      </button>
    </div>
  );
}

// ── To-buy: category cards ────────────────────────────────────────────────────
function ToBuyCards({
  groups,
  memberMap,
  onMarkBought,
  onDelete,
}: {
  groups: ReturnType<typeof groupByCategory>;
  memberMap: Record<string, MemberInfo>;
  onMarkBought: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "var(--sp-4)",
      }}
    >
      {groups.map((group) => {
        const color = CATEGORY_COLORS[group.id];
        return (
          <section
            key={group.id}
            className="card"
            style={{ padding: 0, overflow: "hidden" }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-3)",
                padding: "var(--sp-4)",
                background: `color-mix(in srgb, ${color} 8%, var(--cream-2))`,
                borderBottom: "1px solid var(--cream-3)",
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--r-2)",
                  background: `color-mix(in srgb, ${color} 22%, var(--cream-2))`,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
                aria-hidden
              >
                {group.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{group.nameHe}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  <span className="mono">{group.items.length}</span> פריטים
                </div>
              </div>
            </header>
            {/* BATCH-GI 1.3.1: the rows are a list, so announce a count and support list
                navigation. The <li> stays display:list-item (block) - do NOT make it flex or
                grid, that is what dropped the implicit listitem role in WebKit on /l. */}
            <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0, paddingBottom: "var(--sp-2)" }}>
              {group.items.map((item) => {
                const adder = item.createdByUserId ? memberMap[item.createdByUserId] : undefined;
                return (
                  <li key={item.id}>
                    <ItemRow
                      item={item}
                      member={adder}
                      color={color}
                      onMarkBought={() => onMarkBought(item.id)}
                      onDelete={() => onDelete(item.id)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ── Bought-this-month: collapsible recap ──────────────────────────────────────
function BoughtSection({
  items,
  open,
  onToggle,
  onRestore,
}: {
  items: ShoppingListItem[];
  open: boolean;
  onToggle: () => void;
  onRestore: (id: string) => void;
}) {
  const monthLabel = currentMonthLabel();
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
          padding: "14px var(--sp-4)",
          borderRadius: "var(--r-3)",
          cursor: "pointer",
          border: "1px solid var(--cream-3)",
          background: "var(--cream-1)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "var(--sage-bg)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Check size={19} color="var(--pos)" aria-hidden />
        </span>
        <div style={{ flex: 1, minWidth: 0, textAlign: "start" }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>נקנו החודש</div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            <span className="mono">{items.length}</span> פריטים · {monthLabel}
          </div>
        </div>
        <ChevronDown
          size={20}
          color="var(--text-2)"
          aria-hidden
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms ease", flexShrink: 0 }}
        />
      </button>

      {open && (
        items.length === 0 ? (
          <section className="card" style={{ marginTop: "var(--sp-2)", padding: "var(--sp-6) var(--sp-5)", textAlign: "center" }}>
            <div className="muted" style={{ fontSize: 13 }}>עוד לא נקנו פריטים החודש.</div>
          </section>
        ) : (
          <section className="card" style={{ marginTop: "var(--sp-2)", padding: "var(--sp-2)", overflow: "hidden" }}>
            {items.map((item, idx) => {
              const meta = shoppingCategoryMeta(categoryOf(item));
              const name = item.normalizedName ?? item.rawText;
              const when = formatWhen(item.updatedAt);
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-2)",
                    padding: "9px var(--sp-3)",
                    borderTop: idx > 0 ? "1px solid var(--cream-3)" : "none",
                  }}
                >
                  {/* BATCH-GI 4.1.2: same treatment as the to-buy control - the verb is an
                      sr-only span inside the button and the item comes from the visible
                      struck-through title, so every bought row is no longer named
                      "החזר לרשימה". data-item-control is the 2.4.3 focus anchor. */}
                  <button
                    type="button"
                    onClick={() => onRestore(item.id)}
                    aria-labelledby={`sl-restore-${item.id} sl-bought-${item.id}`}
                    data-item-control={item.id}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 7,
                      border: 0,
                      background: "var(--pos)",
                      color: "#fff",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span id={`sl-restore-${item.id}`} className="sr-only">החזר לרשימה</span>
                    <Check size={14} aria-hidden />
                  </button>
                  <span
                    id={`sl-bought-${item.id}`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13.5,
                      color: "var(--text-2)",
                      textDecoration: "line-through",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={name}
                  >
                    {name}{item.quantity != null && item.quantity > 1 ? ` ×${item.quantity}` : ""}
                  </span>
                  <span className="chip" style={{ flexShrink: 0 }}>{meta.icon} {meta.nameHe}</span>
                  {when && (
                    <span style={{ fontSize: 11.5, color: "var(--text-3)", flexShrink: 0, whiteSpace: "nowrap" }}>
                      {when}
                    </span>
                  )}
                </div>
              );
            })}
          </section>
        )
      )}
    </div>
  );
}

// ── Empty state (no to-buy items) ─────────────────────────────────────────────
function ToBuyEmpty() {
  return (
    <section className="card" style={{ padding: "var(--sp-8) var(--sp-5)", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: "var(--sp-2)" }} aria-hidden>🛒</div>
      <div className="muted" style={{ fontSize: 13.5 }}>הרשימה ריקה - הכול נקנה. כל הכבוד!</div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ShoppingListPage() {
  const [household, setHousehold] = useState<Household>();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [bought, setBought] = useState<ShoppingListItem[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, MemberInfo>>({});
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string>();
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [showBought, setShowBought] = useState(false);
  // BATCH-GI 4.1.3: add / mark-bought / undo / remove change the list silently - the row
  // just moves or vanishes. These SUCCESS messages go through the shared polite region in
  // lib/a11y/announce, NOT a locally rendered <span role="status">: the local region wrote the
  // new string directly, so adding "חלב" twice in a row was not a DOM mutation and stayed
  // silent the second time. announce() blanks-then-sets, so a repeat speaks again.
  //
  // FAILURES do NOT belong in that polite region: it is sr-only, so a sighted user saw the row
  // silently snap back with no error text at all, and the message queued behind whatever the
  // reader was saying. They go to `actionError`, rendered as a visible role="alert" below.
  // `error` is now reserved for LOAD failures (it replaces the whole page).
  const [actionError, setActionError] = useState("");

  async function load() {
    try {
      const current = await api.currentHousehold();
      setHousehold(current.household);
      const [list, membersRes] = await Promise.all([
        api.shoppingList(current.household.id),
        api
          .listMembers(current.household.id)
          .catch(() => ({ members: [] as Array<HouseholdMember & { displayName?: string }> })),
      ]);
      setItems(list.items);
      setBought(list.boughtThisMonth);
      const map: Record<string, MemberInfo> = {};
      for (const m of membersRes.members) {
        map[m.userId] = { userId: m.userId, displayName: m.displayName, colorKey: m.color };
      }
      setMemberMap(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת הרשימה");
    }
  }

  // Item check-off/restore/remove/add don't change the household or member roster,
  // so refetch ONLY the list — not currentHousehold + listMembers. Avoids 3 GETs
  // per mutation on the hot shopping path (full load() stays for initial mount).
  async function reloadList() {
    if (!household) return load();
    try {
      const list = await api.shoppingList(household.id);
      setItems(list.items);
      setBought(list.boughtThisMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת הרשימה");
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, []);

  // BATCH-GI 2.4.3 (Focus Order) - marking bought / restoring / removing UNMOUNTS the
  // control that currently has focus, so React drops focus to <body> and a keyboard or
  // screen-reader user loses their place in the list every single time. Same defect and
  // same remedy as /l (ShareList refocusIdRef), implemented separately because the two
  // pages share no code. Target order: the item's OWN control in its new section (both
  // the to-buy control and the נקנו control carry data-item-control={id}) -> the
  // neighbouring row's control -> the add-item field, the natural next action.
  const refocusRef = useRef<{ id: string; fallbackId?: string } | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const target = refocusRef.current;
    if (!target) return;
    refocusRef.current = null;
    // Only step in if the activation actually orphaned focus. If the user already moved
    // on (or is using a pointer), leave focus exactly where they put it.
    const ae = document.activeElement;
    if (ae && ae !== document.body) return;
    const pick = (id?: string) =>
      id ? document.querySelector<HTMLElement>(`[data-item-control="${CSS.escape(id)}"]`) : null;
    (pick(target.id) ?? pick(target.fallbackId) ?? addInputRef.current)?.focus();
  }, [items, bought]);

  /** The control that should take focus when `id`'s row disappears. Read from the DOM so
   *  it follows the order the user actually sees (category grouping included).
   *  Scoped to the acted-on control's OWN <section>: a flat document-order query returns the
   *  to-buy check buttons AND the "נקנו החודש" restore buttons in one list, so acting on the
   *  last to-buy row handed focus to a bought row - a different section with a different verb.
   *  With no neighbour inside the section the caller falls through to the add-item field. */
  function neighbourControlId(id: string): string | undefined {
    const el = document.querySelector<HTMLElement>(`[data-item-control="${CSS.escape(id)}"]`);
    if (!el) return undefined;
    const scope: ParentNode = el.closest("section") ?? document;
    const all = Array.from(scope.querySelectorAll<HTMLElement>("[data-item-control]"));
    const i = all.indexOf(el);
    if (i < 0) return undefined;
    return (all[i + 1] ?? all[i - 1])?.dataset.itemControl;
  }

  /** Item title, read BEFORE the mutation - same `normalizedName ?? rawText` rule the rows use. */
  function nameOf(id: string): string {
    const it = [...items, ...bought].find((x) => x.id === id);
    return it ? it.normalizedName ?? it.rawText : "הפריט";
  }

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    if (!household || !rawText.trim()) return;
    const text = rawText.trim();
    setActionError("");
    try {
      await api.addShoppingItem(household.id, text);
      setRawText("");
      // 2.4.3: the submit button disables itself the moment rawText clears, which would
      // drop focus to <body>. Hand focus back to the field before that render commits.
      addInputRef.current?.focus();
      await reloadList();
      announce(`${text} נוסף לרשימה`);
    } catch {
      setActionError("שגיאה בהוספת הפריט");
    }
  }

  async function markBought(id: string) {
    const label = nameOf(id);
    refocusRef.current = { id, fallbackId: neighbourControlId(id) };
    setActionError("");
    try {
      await api.patchShoppingItem(id, { status: "purchased" });
      await reloadList();
      announce(`${label} סומן כנקנה`);
    } catch {
      // The list never changed, so the refocus effect never runs - leaving the target armed
      // would yank focus on the NEXT, unrelated list refresh.
      refocusRef.current = null;
      setActionError("שגיאה בעדכון הפריט");
    }
  }

  async function restoreItem(id: string) {
    const label = nameOf(id);
    refocusRef.current = { id, fallbackId: neighbourControlId(id) };
    setActionError("");
    try {
      await api.patchShoppingItem(id, { status: "active" });
      await reloadList();
      announce(`${label} הוחזר לרשימה`);
    } catch {
      refocusRef.current = null;
      setActionError("שגיאה בעדכון הפריט");
    }
  }

  async function removeItem(id: string) {
    const label = nameOf(id);
    refocusRef.current = { id, fallbackId: neighbourControlId(id) };
    setActionError("");
    try {
      await api.patchShoppingItem(id, { status: "removed" });
      await reloadList();
      announce(`${label} הוסר מהרשימה`);
    } catch {
      refocusRef.current = null;
      setActionError("שגיאה בהסרת הפריט");
    }
  }

  async function sendToWhatsapp() {
    if (!household || sendStatus === "sending") return;
    setSendStatus("sending");
    setActionError("");
    announce("שולח את הרשימה לוואטסאפ");
    try {
      await api.sendShoppingListToWhatsapp(household.id);
      setSendStatus("sent");
      announce("הרשימה נשלחה לוואטסאפ");
      setTimeout(() => setSendStatus("idle"), 3000);
    } catch (err) {
      // 2.4.3: this used to setError(...), and the `if (error)` early return then replaced the
      // WHOLE page - header, send button, list - so the focused button was unmounted, focus fell
      // to <body> and there was no retry control. A transient send failure must not destroy the
      // shopping list, so it stays a page-local alert and the button keeps focus.
      setActionError(err instanceof Error ? err.message : "שגיאה בשליחה");
      setSendStatus("idle");
    }
  }

  // items = ACTIVE (to-buy) only; defensively re-filter in case the store includes others.
  const activeItems = useMemo(
    () => items.filter((it) => it.status === "active"),
    [items]
  );
  const groups = useMemo(() => groupByCategory(activeItems), [activeItems]);

  // BATCH-GI 1.3.1 / 2.4.6: a terminal state IS the page, so it needs the same <h1> the
  // ready view has (the ready <h1> lives inside ShoppingHeader and is not rendered here).
  // .sr-only because the design shows no title on these screens - zero pixels change.
  // AppShell supplies the <main> landmark.
  if (error) return <AppShell><h1 className="sr-only">רשימת קניות</h1><LoadState error={error} /></AppShell>;
  if (!household) return <AppShell><h1 className="sr-only">רשימת קניות</h1><LoadState /></AppShell>;

  return (
    <AppShell>
      <div style={{ display: "grid", gap: "var(--sp-4)" }}>
        <ShoppingHeader
          activeCount={activeItems.length}
          boughtCount={bought.length}
          onSend={sendToWhatsapp}
          sendStatus={sendStatus}
        />

        {/* Add-item form */}
        <form onSubmit={addItem}>
          <div
            style={{
              display: "flex",
              gap: "var(--sp-2)",
              flexWrap: "wrap",
              alignItems: "stretch",
            }}
          >
            <input
              className="input"
              ref={addInputRef}
              style={{ flex: 1, minWidth: 200 }}
              value={rawText}
              placeholder="הוסיפו פריט - למשל: חלב, פיתות, גלידה"
              onChange={(event) => setRawText(event.target.value)}
              aria-label="הוסף פריט"
            />
            <button className="button" type="submit" disabled={!rawText.trim()}>
              <Plus size={16} aria-hidden />
              הוסף
            </button>
          </div>
        </form>

        {/* BATCH-GI 4.1.3 - add / check-off / undo / remove / send failures. Conditionally
            inserted, so role="alert" is announced on mount, AND a sighted user finally sees
            why the row snapped back (it used to land in an sr-only polite region only). */}
        {actionError && (
          <div className="status error" role="alert">{actionError}</div>
        )}

        {/* To-buy */}
        <div className="row between" style={{ marginTop: "var(--sp-1)" }}>
          <h2 className="h3">לקנות</h2>
          <span className="chip teal">{activeItems.length} פריטים</span>
        </div>

        {activeItems.length > 0 ? (
          <ToBuyCards
            groups={groups}
            memberMap={memberMap}
            onMarkBought={markBought}
            onDelete={removeItem}
          />
        ) : (
          <ToBuyEmpty />
        )}

        {/* Bought this month (collapsed by default) */}
        <BoughtSection
          items={bought}
          open={showBought}
          onToggle={() => setShowBought((s) => !s)}
          onRestore={restoreItem}
        />
      </div>
    </AppShell>
  );
}
