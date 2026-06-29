import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Redesign copy rule: never use the em-dash (U+2014) or en-dash (U+2013) in
// user-facing copy - the ASCII hyphen "-" only. This guard fails the build if
// either appears in rendered JSX text or string literals. Code comments (block
// and line comments) are stripped first, since they are not user-facing.

const ROOTS = ["src/app", "src/components"];
const DASH = new RegExp("[\\u2013\\u2014]");

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

// Remove block comments, then line comments (leaving any "://" in URLs intact).
function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

test("no em-dash/en-dash in user-facing copy (redesign copy rule)", () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    for (const file of tsxFiles(root)) {
      stripComments(readFileSync(file, "utf8"))
        .split("\n")
        .forEach((line, i) => {
          if (DASH.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Found em-dash (U+2014) / en-dash (U+2013) in user-facing copy. Use the ASCII hyphen "-":\n${offenders.join("\n")}`
  );
});
