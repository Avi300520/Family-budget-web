import test from "node:test";
import assert from "node:assert/strict";
import { heDate, nis } from "./format.ts";

// BATCH-GI F6. The whole point of heDate is that it NEVER emits "Invalid Date" or a raw Date
// toString into the UI - those were the two shipped bugs. Everything else is Intl's problem.
test("heDate returns null for anything unrenderable", () => {
  for (const bad of [null, undefined, "", "not a date", NaN, new Date("nope")]) {
    assert.equal(heDate(bad as never), null, `expected null for ${String(bad)}`);
  }
});

test("heDate formats a real date in Hebrew, with no raw Date leakage", () => {
  const out = heDate("2026-08-06");
  assert.ok(out, "expected a formatted string");
  assert.ok(!out.includes("Invalid"), out);
  assert.ok(!/GMT|Thu|Aug/.test(out), `raw Date toString leaked: ${out}`);
  assert.ok(out.includes("2026"), out);
});

// The regression this guards: `new Date("2026-08-06")` is UTC midnight, so rendering it in a
// timezone west of UTC yields the 5th. The API sends bare YYYY-MM-DD, so this must be local.
test("heDate does not shift a bare YYYY-MM-DD date west of UTC", () => {
  const tz = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    const out = heDate("2026-08-06");
    assert.ok(out?.includes("6"), `expected the 6th, got ${out}`);
    assert.ok(!out?.includes("5,") && !/\b5\b/.test(out ?? ""), `date shifted a day: ${out}`);
  } finally {
    process.env.TZ = tz;
  }
});

test("heDate accepts the three input shapes the API actually returns", () => {
  const iso = heDate("2026-08-06T00:00:00.000Z");
  assert.equal(heDate(new Date("2026-08-06T00:00:00.000Z")), iso);
  assert.equal(heDate(Date.parse("2026-08-06T00:00:00.000Z")), iso);
});

test("nis rounds and prefixes", () => {
  assert.equal(nis(0), "₪0");
  assert.equal(nis(null), "₪0");
  assert.equal(nis(1234.6), "₪1,235");
});
