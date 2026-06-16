// Brand-copy guard (CLAUDE.md §4). Scans the web app source so deprecated/forbidden
// user-facing framing can never silently return. Two rules:
//   1. No in-store "station N" / walking-route framing — the shopping list is grouped
//      "לפי קטגוריות", never described as an in-store walking order. (Regression guard
//      for the 2026-06-17 "תחנה N" fix in shopping-list/page.tsx.)
//   2. No deprecated "עוזר הקניות המשפחתי" ("shopping assistant") brand framing.
//
// Run with: node --experimental-strip-types --test src/lib/brandCopy.test.ts
// Pure Node built-ins only (no deps), matching the other *.test.ts in this repo.
//
// NOTE: rule 1 forbids the bare word "תחנה". No legitimate copy uses it today; if a
// future expense/category ever needs a real "תחנה" (e.g. a transit category), tighten
// this needle to the numbered pattern rather than deleting the guard.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN: Array<{ needle: string; why: string }> = [
  { needle: "תחנה", why: "in-store 'station N' walking-order framing (brand rule §4)" },
  { needle: "עוזר הקניות המשפחתי", why: "deprecated 'shopping assistant' brand framing (brand rule §4)" },
];

function collectSource(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSource(full));
    } else if (
      (full.endsWith(".ts") || full.endsWith(".tsx")) &&
      !full.endsWith(".test.ts") &&
      !full.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

test("web app source contains no forbidden brand copy", () => {
  const hits: string[] = [];
  for (const file of collectSource(SRC_DIR)) {
    const content = readFileSync(file, "utf8");
    for (const { needle, why } of FORBIDDEN) {
      if (content.includes(needle)) hits.push(`${file}: "${needle}" — ${why}`);
    }
  }
  assert.deepEqual(hits, [], `Forbidden brand copy found:\n${hits.join("\n")}`);
});
