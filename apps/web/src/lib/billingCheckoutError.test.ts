// Pure unit tests for the checkout-error → UI-state mapping.
// Run with:  node --experimental-strip-types --test src/lib/billingCheckoutError.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCheckoutError, isRealCheckoutRedirect, checkoutReturnBanner } from "./billingCheckoutError.ts";

test("checkoutReturnBanner: backend 'active' wins over any ?status hint (never contradict paid truth)", () => {
  assert.equal(checkoutReturnBanner("failed", "active"), "active");
  assert.equal(checkoutReturnBanner("success", "active"), "active");
  assert.equal(checkoutReturnBanner(null, "active"), "active");
});

test("checkoutReturnBanner: ?status=success but not-yet-active shows 'processing' (updating/refresh)", () => {
  assert.equal(checkoutReturnBanner("success", "trialing"), "processing");
  assert.equal(checkoutReturnBanner("success", undefined), "processing");
});

test("checkoutReturnBanner: ?status=failed (and not active) shows 'failed'; nothing when no hint", () => {
  assert.equal(checkoutReturnBanner("failed", "trialing"), "failed");
  assert.equal(checkoutReturnBanner(null, "trialing"), null);
});

test("isRealCheckoutRedirect: redirects to a real HYP page EVEN when it embeds our localhost callback param (the prod bug)", () => {
  assert.equal(isRealCheckoutRedirect("https://pay.hyp.co.il/p/?Order=sa_x&Success=http%3A%2F%2Flocalhost%3A3333%2Fapi%2Fv1%2Fbilling%2Fhyp%2Fsuccess&signature=abc"), true);
});

test("isRealCheckoutRedirect: does NOT redirect to the dev mock-checkout URL", () => {
  assert.equal(isRealCheckoutRedirect("http://localhost:3333/api/v1/dev/mock-checkout/hh/couple_yearly"), false);
});

test("isRealCheckoutRedirect: empty / relative / missing URL is not a redirect (shows test-env message)", () => {
  assert.equal(isRealCheckoutRedirect(undefined), false);
  assert.equal(isRealCheckoutRedirect(""), false);
  assert.equal(isRealCheckoutRedirect("/billing"), false);
});

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
