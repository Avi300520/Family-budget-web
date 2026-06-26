"use client";

import { Check, ChevronDown, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

        <button
          type="button"
          className="button"
          onClick={onSend}
          disabled={activeCount === 0 || sendStatus === "sending"}
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
      {/* 40px tap target (touch-friendly) with the 22px visual checkbox centered inside. */}
      <button
        type="button"
        onClick={onMarkBought}
        aria-label="סמן כנקנה"
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
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            border: "1.5px solid var(--cream-4)",
            background: "var(--cream-2)",
          }}
        />
      </button>

      <div style={{ minWidth: 0 }}>
        <div
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
          <span title={member.displayName ? `הוסיף: ${member.displayName}` : undefined}>
            <Avatar memberId={member.userId} displayName={member.displayName} colorKey={member.colorKey} size="sm" />
          </span>
        ) : (
          <span style={{ width: 24, height: 24, flexShrink: 0 }} aria-hidden />
        )}
      </div>

      <button
        type="button"
        onClick={onDelete}
        aria-label="הסר פריט"
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
            <div style={{ paddingBottom: "var(--sp-2)" }}>
              {group.items.map((item) => {
                const adder = item.createdByUserId ? memberMap[item.createdByUserId] : undefined;
                return (
                  <ItemRow
                    key={item.id}
                    item={item}
                    member={adder}
                    color={color}
                    onMarkBought={() => onMarkBought(item.id)}
                    onDelete={() => onDelete(item.id)}
                  />
                );
              })}
            </div>
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
                  <button
                    type="button"
                    onClick={() => onRestore(item.id)}
                    aria-label="החזר לרשימה"
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
                    <Check size={14} aria-hidden />
                  </button>
                  <span
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, []);

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    if (!household || !rawText.trim()) return;
    await api.addShoppingItem(household.id, rawText.trim());
    setRawText("");
    await load();
  }

  async function markBought(id: string) {
    await api.patchShoppingItem(id, { status: "purchased" });
    await load();
  }

  async function restoreItem(id: string) {
    await api.patchShoppingItem(id, { status: "active" });
    await load();
  }

  async function removeItem(id: string) {
    await api.patchShoppingItem(id, { status: "removed" });
    await load();
  }

  async function sendToWhatsapp() {
    if (!household || sendStatus === "sending") return;
    setSendStatus("sending");
    try {
      await api.sendShoppingListToWhatsapp(household.id);
      setSendStatus("sent");
      setTimeout(() => setSendStatus("idle"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחה");
      setSendStatus("idle");
    }
  }

  // items = ACTIVE (to-buy) only; defensively re-filter in case the store includes others.
  const activeItems = useMemo(
    () => items.filter((it) => it.status === "active"),
    [items]
  );
  const groups = useMemo(() => groupByCategory(activeItems), [activeItems]);

  if (error) return <AppShell><LoadState error={error} /></AppShell>;
  if (!household) return <AppShell><LoadState /></AppShell>;

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
