"use client";

import { Check, Plus, Send, Trash2, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  Household,
  HouseholdMember,
  ShoppingCategoryId,
  ShoppingListItem,
} from "@shopping-assistant/shared-types";
import {
  SHOPPING_CATEGORIES,
  SHOPPING_CATEGORY_FALLBACK,
} from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { Avatar } from "../../components/Avatar";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";

// ── Visual category color mapping (Iteration 4) ──────────────────────────────
// Every CSS variable here is already defined in tokens.css — no new hex.
const CATEGORY_COLORS: Record<ShoppingCategoryId, string> = {
  vegetables: "var(--sage)",
  bakery:     "var(--mustard)",
  dairy:      "var(--teal)",
  pantry:     "var(--ocean)",
  snacks:     "var(--berry)",
  frozen:     "var(--plum)",
  household:  "var(--coral)",
};

type ViewVariant = "cards" | "list";
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

// ── RouteMap (horizontal walking path) ────────────────────────────────────────
function RouteMap({ activeCategoryIds }: { activeCategoryIds: Set<ShoppingCategoryId> }) {
  const stations = SHOPPING_CATEGORIES;
  return (
    <section className="card" style={{ padding: "var(--sp-5)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-3)" }}>
        <MapPin size={16} aria-hidden style={{ color: "var(--teal)" }} />
        <span className="h4">מסלול בסופר</span>
        <span className="muted" style={{ fontSize: 12 }}>
          הקטגוריות לפי סדר ההליכה
        </span>
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--sp-1)",
          rowGap: "var(--sp-3)",
          padding: "var(--sp-2) 0",
          overflowX: "auto",
        }}
        aria-label="מסלול הקניות"
      >
        {/* the connecting line behind the dots */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            insetInlineStart: 18,
            insetInlineEnd: 18,
            top: 22,
            height: 2,
            background: "var(--cream-3)",
            zIndex: 0,
          }}
        />

        {/* entrance dot */}
        <RouteDot icon="🚪" label="כניסה" color="var(--teal)" active />

        {stations.map((cat) => (
          <RouteDot
            key={cat.id}
            icon={cat.icon}
            label={cat.nameHe.split(/\s+/)[0]!}
            color={CATEGORY_COLORS[cat.id]}
            active={activeCategoryIds.has(cat.id)}
          />
        ))}

        {/* checkout dot */}
        <RouteDot icon="💳" label="קופה" color="var(--coral)" active />
      </div>
    </section>
  );
}

function RouteDot({
  icon,
  label,
  color,
  active,
}: {
  icon: string;
  label: string;
  color: string;
  active: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        minWidth: 40,
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: "var(--cream-2)",
          border: `2px solid ${active ? color : "var(--cream-4)"}`,
          display: "grid",
          placeItems: "center",
          fontSize: 18,
          opacity: active ? 1 : 0.55,
          flexShrink: 0,
        }}
        aria-hidden
      >
        {icon}
      </span>
      <span
        style={{
          fontSize: 10,
          color: active ? "var(--text-1)" : "var(--text-3)",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── ShoppingHeader (count + variant toggle + actions) ─────────────────────────
function ShoppingHeader({
  totalCount,
  activeCount,
  variant,
  setVariant,
  onSend,
  sendStatus,
}: {
  totalCount: number;
  activeCount: number;
  variant: ViewVariant;
  setVariant: (v: ViewVariant) => void;
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
            <span className="mono">{activeCount}</span> פעילים • <span className="mono">{totalCount}</span> פריטים סה״כ
          </div>
        </div>

        {/* variant toggle */}
        <div
          role="tablist"
          aria-label="תצוגה"
          style={{
            display: "flex",
            padding: 3,
            background: "var(--cream-1)",
            borderRadius: "var(--r-3)",
            border: "1px solid var(--cream-3)",
            gap: 2,
          }}
        >
          {(["cards", "list"] as const).map((v) => {
            const labels = { cards: "קלפים", list: "רשימה" } as const;
            const isActive = variant === v;
            return (
              <button
                key={v}
                role="tab"
                aria-selected={isActive}
                onClick={() => setVariant(v)}
                className="btn sm"
                style={{
                  background: isActive ? "var(--cream-2)" : "transparent",
                  border: 0,
                  boxShadow: isActive ? "var(--elev-1)" : "none",
                  color: isActive ? "var(--text-0)" : "var(--text-2)",
                  fontWeight: 600,
                }}
                type="button"
              >
                {labels[v]}
              </button>
            );
          })}
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            className="button"
            onClick={onSend}
            disabled={sendStatus === "sending"}
            style={{ minWidth: 160 }}
          >
            <Send size={16} aria-hidden />
            {sendStatus === "sending"
              ? "שולח..."
              : sendStatus === "sent"
              ? "נשלח ✓"
              : "שלח לוואטסאפ"}
          </button>
        )}
      </div>
    </section>
  );
}

// ── ItemRow — used by both cards and list view ────────────────────────────────
function ItemRow({
  item,
  member,
  color,
  onTogglePurchased,
  onDelete,
}: {
  item: ShoppingListItem;
  member?: MemberInfo;
  color: string;
  onTogglePurchased: () => void;
  onDelete: () => void;
}) {
  const isPurchased = item.status === "purchased";
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
        background: isPurchased ? "var(--cream-1)" : "transparent",
        opacity: isPurchased ? 0.65 : 1,
      }}
    >
      <button
        type="button"
        onClick={onTogglePurchased}
        aria-label={isPurchased ? "החזר לפעיל" : "סמן כנקנה"}
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          border: `1.5px solid ${isPurchased ? color : "var(--cream-4)"}`,
          background: isPurchased ? color : "var(--cream-2)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}
      >
        {isPurchased && <Check size={14} color="white" strokeWidth={2.5} aria-hidden />}
      </button>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            textDecoration: isPurchased ? "line-through" : "none",
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
        style={{ width: 28, height: 28, padding: 0, borderRadius: 8 }}
      >
        <Trash2 size={14} aria-hidden style={{ color: "var(--text-2)" }} />
      </button>
    </div>
  );
}

// ── CardsView (default) ───────────────────────────────────────────────────────
function CardsView({
  groups,
  memberMap,
  onTogglePurchased,
  onDelete,
}: {
  groups: ReturnType<typeof groupByCategory>;
  memberMap: Record<string, MemberInfo>;
  onTogglePurchased: (id: string, currentStatus: ShoppingListItem["status"]) => void;
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
      {groups.map((group, idx) => {
        const color = CATEGORY_COLORS[group.id];
        const total = group.items.length;
        const purchased = group.items.filter((i) => i.status === "purchased").length;
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
                  תחנה <span className="mono">{idx + 1}</span> • <span className="mono">{purchased}/{total}</span> בעגלה
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
                    onTogglePurchased={() => onTogglePurchased(item.id, item.status)}
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

// ── ListView (continuous) ─────────────────────────────────────────────────────
function ListView({
  groups,
  memberMap,
  onTogglePurchased,
  onDelete,
}: {
  groups: ReturnType<typeof groupByCategory>;
  memberMap: Record<string, MemberInfo>;
  onTogglePurchased: (id: string, currentStatus: ShoppingListItem["status"]) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="card" style={{ padding: 0, overflow: "hidden" }}>
      {groups.map((group, idx) => {
        const color = CATEGORY_COLORS[group.id];
        return (
          <div key={group.id}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                padding: "14px var(--sp-5) 10px",
                borderTop: idx > 0 ? "1px solid var(--cream-3)" : "none",
                background: `color-mix(in srgb, ${color} 5%, var(--cream-2))`,
              }}
            >
              <span style={{ fontSize: 18 }} aria-hidden>
                {group.icon}
              </span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{group.nameHe}</span>
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  background: "var(--text-3)",
                }}
                aria-hidden
              />
              <span className="muted" style={{ fontSize: 12 }}>
                <span className="mono">{group.items.length}</span> פריטים
              </span>
              <span style={{ flex: 1 }} />
              <span className="label" style={{ color, fontSize: 10 }}>
                תחנה <span className="mono">{idx + 1}</span>
              </span>
            </div>
            {group.items.map((item) => {
              const adder = item.createdByUserId ? memberMap[item.createdByUserId] : undefined;
              return (
                <ItemRow
                  key={item.id}
                  item={item}
                  member={adder}
                  color={color}
                  onTogglePurchased={() => onTogglePurchased(item.id, item.status)}
                  onDelete={() => onDelete(item.id)}
                />
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <section className="card" style={{ padding: "var(--sp-10) var(--sp-5)" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--sp-3)",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 40 }} aria-hidden>🛒</span>
        <div className="h3">הרשימה ריקה</div>
        <div className="muted" style={{ fontSize: 13, maxWidth: 360 }}>
          הוסיפו פריטים מהשדה למעלה או שלחו <strong>"נגמר חלב"</strong> בוואטסאפ.
          הרשימה תסדר את עצמה לפי מסלול הסופר.
        </div>
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ShoppingListPage() {
  const [household, setHousehold] = useState<Household>();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, MemberInfo>>({});
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string>();
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [variant, setVariant] = useState<ViewVariant>("cards");

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

  async function togglePurchased(id: string, currentStatus: ShoppingListItem["status"]) {
    const next = currentStatus === "purchased" ? "active" : "purchased";
    await api.patchShoppingItem(id, { status: next });
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

  const visibleItems = useMemo(
    () => items.filter((it) => it.status !== "removed"),
    [items]
  );
  const activeCount = useMemo(
    () => visibleItems.filter((it) => it.status === "active").length,
    [visibleItems]
  );
  const groups = useMemo(() => groupByCategory(visibleItems), [visibleItems]);
  const activeCategoryIds = useMemo(
    () => new Set<ShoppingCategoryId>(groups.map((g) => g.id)),
    [groups]
  );

  if (error) return <AppShell><LoadState error={error} /></AppShell>;
  if (!household) return <AppShell><LoadState /></AppShell>;

  return (
    <AppShell>
      <div style={{ display: "grid", gap: "var(--sp-4)" }}>
        <ShoppingHeader
          totalCount={visibleItems.length}
          activeCount={activeCount}
          variant={variant}
          setVariant={setVariant}
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
              placeholder="למשל: חלב, פיתות, גלידה"
              onChange={(event) => setRawText(event.target.value)}
              aria-label="הוסף פריט"
            />
            <button className="button" type="submit" disabled={!rawText.trim()}>
              <Plus size={16} aria-hidden />
              הוסף
            </button>
          </div>
        </form>

        {visibleItems.length > 0 ? (
          <>
            <RouteMap activeCategoryIds={activeCategoryIds} />
            {variant === "cards" ? (
              <CardsView
                groups={groups}
                memberMap={memberMap}
                onTogglePurchased={togglePurchased}
                onDelete={removeItem}
              />
            ) : (
              <ListView
                groups={groups}
                memberMap={memberMap}
                onTogglePurchased={togglePurchased}
                onDelete={removeItem}
              />
            )}
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </AppShell>
  );
}
