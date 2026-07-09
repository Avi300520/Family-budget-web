// Unit tests for MoneyInput decimal parsing (NF-M18 / WP-MONEY-INPUT).
// Run with:  node --experimental-strip-types --test src/lib/moneyInput.test.ts
// (FE repo has no vitest; Node's built-in runner. moneyInput.ts is import-free.)
//
// GOLDEN DISCRIMINATOR: the pre-fix inline logic `replace(/[^\d]/g,"")` turned
// "89.90" into "8990" → 8990 (a 100× overcharge). The corrected parser returns 89.9.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMoneyInput } from "./moneyInput.ts";

test("'89.90' parses to 89.9, NOT 8990 (the NF-M18 bug)", () => {
  assert.equal(parseMoneyInput("89.90"), 89.9);
  assert.notEqual(parseMoneyInput("89.90"), 8990);
});

test("plain integers are unchanged", () => {
  assert.equal(parseMoneyInput("8990"), 8990);
  assert.equal(parseMoneyInput("120"), 120);
  assert.equal(parseMoneyInput("0"), 0);
});

test("a ₪ prefix and thousands separators are stripped", () => {
  assert.equal(parseMoneyInput("₪89.90"), 89.9);
  assert.equal(parseMoneyInput("1,200"), 1200);
  assert.equal(parseMoneyInput("12.50"), 12.5);
});

test("a stray second dot collapses into the first decimal group", () => {
  assert.equal(parseMoneyInput("89.9.9"), 89.9);
});

test("empty / dot-only / non-numeric input maps to ''", () => {
  assert.equal(parseMoneyInput(""), "");
  assert.equal(parseMoneyInput("."), "");
  assert.equal(parseMoneyInput("abc"), "");
});

test("mid-typing '89.' preserves the number 89 (does not fight the decimal point)", () => {
  assert.equal(parseMoneyInput("89."), 89);
});
