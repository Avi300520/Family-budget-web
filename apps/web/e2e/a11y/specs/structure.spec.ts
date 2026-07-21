import { test, expect } from "@playwright/test";
import { TARGETS, record } from "../lib/env";
import { open, contextFor } from "../lib/helpers";

// Checklist §1 (structure half) + §5 (2.5.3 label-in-name). Runs in Chromium AND WebKit:
// the explicit role="listitem" fix exists because WebKit drops the implicit role on flex <li>.

for (const t of TARGETS) {
  test(`structure ${t.id}`, async ({ browser }, info) => {
    const context = await contextFor(browser, t);
    const page = await context.newPage();
    await open(page, t);

    const s = await page.evaluate(() => {
      const vis = (el: Element) => {
        const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
        return cs.display !== "none" && cs.visibility !== "hidden" && (r.width > 1 || r.height > 1 || cs.position === "absolute");
      };
      const heads = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => ({
        level: Number(h.tagName[1]), text: (h.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60),
        hidden: !vis(h) && !(h as HTMLElement).classList.contains("sr-only"),
      }));
      const order: string[] = [];
      let prev = 0;
      for (const h of heads) { if (prev && h.level > prev + 1) order.push(`skip h${prev}->h${h.level} at "${h.text}"`); prev = h.level; }

      const lists = [...document.querySelectorAll('[role="list"], ul, ol')].filter(vis).map((l) => ({
        tag: l.tagName.toLowerCase(), role: l.getAttribute("role"),
        // children that are list items per the DOM
        li: l.querySelectorAll(":scope > li").length,
        explicitListitem: l.querySelectorAll(':scope > li[role="listitem"], :scope > [role="listitem"]').length,
        flexLi: [...l.querySelectorAll(":scope > li")].filter((c) => getComputedStyle(c).display.includes("flex")).length,
      })).filter((l) => l.li > 0);

      // 2.5.3: accessible name must CONTAIN the visible label.
      const nameIssues: any[] = [];
      for (const el of document.querySelectorAll("button, a[href], [role=button]")) {
        if (!vis(el)) continue;
        const label = el.getAttribute("aria-label");
        const visible = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!label || !visible) continue;
        const norm = (x: string) => x.replace(/[\s‎‏]+/g, " ").replace(/[.,:;!?()]/g, "").trim();
        if (!norm(label).includes(norm(visible))) nameIssues.push({ visible: visible.slice(0, 60), ariaLabel: label.slice(0, 60) });
      }

      // Are all buttons/links named at all?
      const unnamed: string[] = [];
      for (const el of document.querySelectorAll("button, a[href], [role=button]")) {
        if (!vis(el)) continue;
        const n = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").replace(/\s+/g, " ").trim();
        if (!n) unnamed.push(el.outerHTML.slice(0, 120));
      }

      // Forms: every field programmatically labelled; error wiring present.
      const fields = [...document.querySelectorAll("input, select, textarea")].filter(vis).map((f) => {
        const id = f.id;
        const labelled = Boolean(
          (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
          f.closest("label") || f.getAttribute("aria-label") || f.getAttribute("aria-labelledby")
        );
        return { type: (f as HTMLInputElement).type || f.tagName.toLowerCase(), name: (f as HTMLInputElement).name || null,
                 id: id || null, labelled, describedby: f.getAttribute("aria-describedby"), required: f.hasAttribute("required") || f.getAttribute("aria-required") === "true" };
      });

      const liveRegions = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')].map((n) => ({
        role: n.getAttribute("role"), live: n.getAttribute("aria-live"),
        text: (n.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60),
      }));

      const firstLink = document.querySelector("a.skip-link");
      return {
        title: document.title, lang: document.documentElement.lang, dir: document.documentElement.dir,
        h1: heads.filter((h) => h.level === 1).length, headings: heads, headingOrderIssues: order,
        mains: document.querySelectorAll("main").length,
        mainHasId: Boolean(document.querySelector("main#main")),
        skipLinkPresent: Boolean(firstLink),
        skipLinkHref: firstLink?.getAttribute("href") ?? null,
        skipLinkIsFirstFocusable: (() => {
          const f = [...document.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
            .filter((e) => !e.hasAttribute("disabled"));
          return f.length > 0 && f[0].classList.contains("skip-link");
        })(),
        lists, nameIssues, unnamed, fields, liveRegions,
        imgsMissingAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
      };
    });

    // The BROWSER'S OWN accessibility tree — the only thing that shows what an AT is handed.
    // Chromium exposes it over CDP (Accessibility.getFullAXTree). WebKit exposes NO programmatic
    // AX tree to Playwright, so on WebKit this stays null and the report says NOT VERIFIED
    // rather than inventing a pass.
    let axListItems: number | null = null;
    let axLists: number | null = null;
    let axNote = "no programmatic accessibility tree is available in this engine (WebKit) — real-AT verification is NEEDS-HUMAN";
    if (info.project.name === "chromium") {
      try {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Accessibility.enable");
        const { nodes }: any = await cdp.send("Accessibility.getFullAXTree");
        axListItems = nodes.filter((n: any) => n.role?.value === "listitem" && n.ignored !== true).length;
        axLists = nodes.filter((n: any) => n.role?.value === "list" && n.ignored !== true).length;
        axNote = "Chromium's own AX tree via CDP Accessibility.getFullAXTree";
        await cdp.detach().catch(() => {});
      } catch (e) { axNote = `CDP AX tree failed: ${String(e).slice(0, 120)}`; }
    }

    record({ kind: "structure", browser: info.project.name, route: t.id, routeState: t.state, url: t.path,
             ...s, axListItems, axLists, axNote });

    expect.soft(s.h1, `${t.id}: exactly one <h1>`).toBe(1);
    expect.soft(s.mains, `${t.id}: exactly one <main>`).toBe(1);
    expect.soft(s.mainHasId, `${t.id}: <main id="main"> skip target`).toBe(true);
    expect.soft(s.headingOrderIssues, `${t.id}: heading level skips`).toEqual([]);
    expect.soft(s.skipLinkIsFirstFocusable, `${t.id}: skip link is the first focusable`).toBe(true);
    expect.soft(s.nameIssues, `${t.id}: 2.5.3 label-in-name`).toEqual([]);
    expect.soft(s.unnamed, `${t.id}: controls with no accessible name`).toEqual([]);
    expect.soft(s.fields.filter((f) => !f.labelled), `${t.id}: unlabelled form fields`).toEqual([]);
    for (const l of s.lists) {
      expect.soft(l.flexLi === 0 || l.explicitListitem >= l.flexLi,
        `${t.id}: ${l.flexLi} flex <li> need explicit role="listitem" (WebKit drops the implicit role)`).toBe(true);
    }
    await context.close();
  });
}

// /l in its REAL states: the accessible name of each control must carry quantity,
// partial X/Y and out-of-stock (the audit's worst find was these being hidden).
for (const id of ["l-active", "l-mixed", "l-locked"]) {
  test(`accessible names carry state — ${id}`, async ({ browser }, info) => {
    const t = TARGETS.find((x) => x.id === id)!;
    const context = await contextFor(browser, t);
    const page = await context.newPage();
    await open(page, t);

    const names: any[] = [];
    for (const btn of await page.getByRole("button").all()) {
      const name = (await btn.getAttribute("aria-label")) ?? (await btn.innerText().catch(() => "")) ;
      const acc = await btn.evaluate((el) => {
        // full accessible name incl. .sr-only text (which innerText drops)
        return (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
      });
      names.push({ visible: (name || "").replace(/\s+/g, " ").trim().slice(0, 80), accName: acc.slice(0, 140) });
    }
    const listText = await page.locator("main").innerText();
    record({ kind: "l-names", browser: info.project.name, route: id, routeState: t.state, buttons: names,
             mainText: listText.replace(/\s+/g, " ").slice(0, 1200) });

    if (id === "l-mixed") {
      const all = names.map((n) => n.accName).join(" | ");
      expect.soft(all, "buy button name carries the ×N quantity").toContain("כמות");
      expect.soft(all, "buy button name carries the partial X of Y").toContain("מתוך");
      expect.soft(all, "out-of-stock is in the accessible name").toContain("חסר");
    }
    await context.close();
  });
}
