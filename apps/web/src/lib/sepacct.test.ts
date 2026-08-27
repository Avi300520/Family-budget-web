// The SEPACCT money boundary. `monthlyAgorot` is an integer number of agorot on the wire and a
// non-integer is `400 income.invalid`, so the parse is the only place a shekel string becomes
// money — and `Number(x) * 100` is exactly the wrong way to do it.
// Run with: node --experimental-strip-types --test src/lib/sepacct.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { agorotFromInput, inputFromAgorot, isAbsent, SepacctError } from "./sepacct.ts";

test("the float trap this parser exists to avoid is real", () => {
  assert.notEqual(Number("19.99") * 100, 1999); // 1998.9999999999998
  assert.notEqual(Number("0.07") * 100, 7); // 7.000000000000001
  assert.equal(agorotFromInput("19.99").ok && agorotFromInput("19.99").agorot, 1999);
});

test("agorotFromInput returns integer agorot, never a float", () => {
  for (const [input, agorot] of [["18.25", 1825], ["0", 0], ["0.07", 7], ["18", 1800], ["18.5", 1850], ["18250.00", 1825000]] as const) {
    const parsed = agorotFromInput(input);
    assert.ok(parsed.ok, `expected ${input} to parse`);
    assert.equal(parsed.agorot, agorot, input);
    assert.ok(Number.isInteger(parsed.agorot), input);
  }
});

test("an empty field is null - the wire's 'clear it' - and not a parse failure", () => {
  assert.deepEqual(agorotFromInput(""), { ok: true, agorot: null });
  assert.deepEqual(agorotFromInput("   "), { ok: true, agorot: null });
});

test("agorotFromInput refuses what the wire would refuse", () => {
  for (const bad of ["18.255", "-5", "abc", "18.2.5", "1e3", "18,25", "."]) {
    assert.equal(agorotFromInput(bad).ok, false, `expected ${bad} to be rejected`);
  }
});

test("inputFromAgorot round-trips", () => {
  for (const agorot of [0, 7, 1825, 1825000]) {
    const back = agorotFromInput(inputFromAgorot(agorot));
    assert.ok(back.ok);
    assert.equal(back.agorot, agorot);
  }
  assert.equal(inputFromAgorot(null), "");
});

test("isAbsent is true for the dormant 404s and false for anything else", () => {
  assert.equal(isAbsent(new SepacctError("http.not_found")), true);
  assert.equal(isAbsent(new SepacctError("split.not_found")), true);
  assert.equal(isAbsent(new SepacctError("auth.forbidden")), false);
  assert.equal(isAbsent(new SepacctError("split.invalid")), false);
  assert.equal(isAbsent(new Error("http.not_found")), false);
});
