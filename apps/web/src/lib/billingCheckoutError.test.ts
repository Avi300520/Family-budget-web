// Pure unit tests for the checkout-error → UI-state mapping.
// Run with:  node --experimental-strip-types --test src/lib/billingCheckoutError.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCheckoutError } from "./billingCheckoutError.ts";

test("billing.disabled (billing OFF) shows a clear inline message, NOT the owner-only collapse", () => {
  const ui = classifyCheckoutError({ code: "billing.disabled", status: 403 });
  assert.ok(!("restricted" in ui), "must not collapse the page");
  assert.match((ui as { message: string }).message, /לא פעיל/);
});

test("billing.forbidden (role authz) collapses to the owner-only (restricted) view", () => {
  assert.deepEqual(classifyCheckoutError({ code: "billing.forbidden", status: 403 }), { restricted: true });
});

test("billing.email_required shows the invoice-email validation message, not a collapse", () => {
  const ui = classifyCheckoutError({ code: "billing.email_required", status: 400 });
  assert.ok(!("restricted" in ui));
  assert.match((ui as { message: string }).message, /אימייל/);
});

test("billing.upgrade_required shows the tier message, not a collapse", () => {
  const ui = classifyCheckoutError({ code: "billing.upgrade_required", status: 403 });
  assert.ok(!("restricted" in ui));
});

test("a generic/network error or an unrelated 403 shows a retry message and does NOT collapse", () => {
  assert.deepEqual(classifyCheckoutError(new Error("network down")), { message: "network down" });
  const ui = classifyCheckoutError({ status: 500 });
  assert.ok(!("restricted" in ui), "a 500 with no billing code must not collapse the page");
});
