"use client";

// FAQ: accessible category tablist (roving arrow-key focus, aria-selected) +
// keyboard accordion (native <button aria-expanded aria-controls>).
//
// SEO: all 29 Q&A render in the HTML. Inactive category panels carry `hidden`
// (correct tab semantics + out of the a11y tree) but remain in the HTML source,
// so every answer is crawlable. Collapsed answers stay in the DOM and animate
// via grid-template-rows (see marketing.css) - no max-height clip.
// Content + the curated 12 schema items live in faqData.ts.

import { useId, useRef, useState } from "react";
import { MessageCircle, Minus, Plus, Scale, ShieldCheck, Tag } from "lucide-react";
import { FAQ_CATEGORIES, FAQ_ITEMS, type FaqCategoryId } from "./faqData";

const CAT_ICON: Record<FaqCategoryId, React.ReactNode> = {
  trust: <ShieldCheck size={18} />,
  product: <MessageCircle size={18} />,
  compare: <Scale size={18} />,
  price: <Tag size={18} />,
};

export function LandingFaq() {
  const baseId = useId();
  const [cat, setCat] = useState<FaqCategoryId>("trust");
  const [openId, setOpenId] = useState<string>(
    FAQ_ITEMS.find((i) => i.category === "trust")?.id ?? ""
  );
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function selectCat(next: FaqCategoryId) {
    setCat(next);
    const first = FAQ_ITEMS.find((i) => i.category === next);
    setOpenId(first?.id ?? "");
  }

  function onTabKey(e: React.KeyboardEvent, index: number) {
    const last = FAQ_CATEGORIES.length - 1;
    let target = index;
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") target = index === last ? 0 : index + 1;
    else if (e.key === "ArrowUp" || e.key === "ArrowRight") target = index === 0 ? last : index - 1;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = last;
    else return;
    e.preventDefault();
    const next = FAQ_CATEGORIES[target];
    if (!next) return;
    selectCat(next.id);
    tabRefs.current[next.id]?.focus();
  }

  return (
    <div className="pt-faq-wrap">
      <div className="pt-faq-cats" role="tablist" aria-label="קטגוריות שאלות נפוצות">
        {FAQ_CATEGORIES.map((c, i) => {
          const count = FAQ_ITEMS.filter((it) => it.category === c.id).length;
          const selected = c.id === cat;
          return (
            <button
              key={c.id}
              ref={(el) => {
                tabRefs.current[c.id] = el;
              }}
              role="tab"
              id={`${baseId}-tab-${c.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${c.id}`}
              tabIndex={selected ? 0 : -1}
              className="pt-faq-cat"
              onClick={() => selectCat(c.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <span className="ic" aria-hidden="true">
                {CAT_ICON[c.id]}
              </span>
              {c.label}
              <span className="ct mono">{count}</span>
            </button>
          );
        })}
      </div>

      <div>
        {FAQ_CATEGORIES.map((c) => (
          <div
            key={c.id}
            className="pt-faq-list"
            role="tabpanel"
            id={`${baseId}-panel-${c.id}`}
            aria-labelledby={`${baseId}-tab-${c.id}`}
            hidden={c.id !== cat}
          >
            {FAQ_ITEMS.filter((i) => i.category === c.id).map((item) => {
              const open = item.id === openId;
              const aId = `${baseId}-a-${item.id}`;
              return (
                <div className="pt-faq-item" data-open={open} key={item.id}>
                  <h3 style={{ margin: 0 }}>
                    <button
                      type="button"
                      className="pt-faq-q"
                      aria-expanded={open}
                      aria-controls={aId}
                      onClick={() => setOpenId(open ? "" : item.id)}
                    >
                      <span>{item.q}</span>
                      <span className="tog" aria-hidden="true">
                        {open ? <Minus size={16} /> : <Plus size={16} />}
                      </span>
                    </button>
                  </h3>
                  <div className="pt-faq-a" id={aId}>
                    <div className="pt-faq-a__inner">
                      <p>{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
