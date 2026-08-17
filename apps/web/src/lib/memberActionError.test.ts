// Unit tests for describeMemberActionError.
// Run with: node --experimental-strip-types --test src/lib/memberActionError.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { describeMemberActionError } from "./memberActionError.ts";

const FALLBACK = "לא הצלחנו לבצע את הפעולה.";

test("auth.csrf_invalid / auth.unauthorized / status 401 → the session-expired copy, ignoring the server message", () => {
  const expired = "החיבור לחשבון פג. רעננו את הדף ונסו שוב - ואם זה חוזר, התחברו מחדש.";
  assert.equal(describeMemberActionError({ code: "auth.csrf_invalid", status: 403, message: "irrelevant" }, FALLBACK), expired);
  assert.equal(describeMemberActionError({ code: "auth.unauthorized", status: 403, message: "irrelevant" }, FALLBACK), expired);
  assert.equal(describeMemberActionError({ code: "some.other_code", status: 401, message: "irrelevant" }, FALLBACK), expired);
});

test("auth.forbidden → the owner/admin-only copy, ignoring the server message", () => {
  assert.equal(
    describeMemberActionError({ code: "auth.forbidden", status: 403, message: "irrelevant" }, FALLBACK),
    "רק בעלים או מנהל יכולים לבצע את הפעולה הזו."
  );
});

test("a non-auth ApiClientError with a message returns the SERVER message, not the fallback", () => {
  assert.equal(
    describeMemberActionError(
      { code: "member.cross_household", status: 409, message: "המספר הזה כבר משויך לבית אחר." },
      FALLBACK
    ),
    "המספר הזה כבר משויך לבית אחר."
  );
});

test("an ApiClientError with no usable message returns the fallback", () => {
  assert.equal(describeMemberActionError({ code: "member.cross_household", status: 409, message: "" }, FALLBACK), FALLBACK);
  assert.equal(describeMemberActionError({ code: "member.cross_household", status: 409 }, FALLBACK), FALLBACK);
});

test("a non-ApiClientError throw (plain Error, string, undefined) returns the fallback", () => {
  assert.equal(describeMemberActionError(new Error("boom"), FALLBACK), FALLBACK);
  assert.equal(describeMemberActionError("boom", FALLBACK), FALLBACK);
  assert.equal(describeMemberActionError(undefined, FALLBACK), FALLBACK);
});

// CLAUDE.md §4 — never expose raw error codes or internal English. These are the REAL
// shapes the API and api-client produce; each one previously reached the screen verbatim.
test("internal English from the server never reaches the screen — fallback instead", () => {
  const englishLeaks = [
    { code: "validation.invalid", status: 400, message: "Invalid request body" },
    // NB: auth.forbidden_household is a DIFFERENT code from auth.forbidden, so it does
    // not hit the permissions branch above — without the guard it printed raw English.
    { code: "auth.forbidden_household", status: 403, message: "User is not a household member" },
    { code: "member.not_found", status: 404, message: "Household member not found" },
    { code: "internal.error", status: 500, message: "Unexpected error" },
    { code: "http.param_missing", status: 500, message: "Missing route param: householdId" },
    { code: "rate.limited", status: 429, message: "Too many requests. Please try again later." },
    // api-client's own synthesis when the body is not the JSON error envelope (nginx 502).
    { code: "api.error", status: 502, message: "Request failed with status 502" },
    { code: "api.error", status: 504, message: "Request failed with status 504" }
  ];
  for (const err of englishLeaks) {
    assert.equal(describeMemberActionError(err, FALLBACK), FALLBACK, `leaked: ${err.message}`);
  }
});

test("the API's Hebrew copy still passes through — the guard is not blanket suppression", () => {
  const hebrewMessages = [
    "המספר הזה כבר משויך לבית אחר ולכן אי אפשר להזמין אותו לבית הזה.",
    "המספר הזה כבר חבר פעיל בבית הזה. אפשר לערוך את הפרטים שלו במסך החברים.",
    "הוספת בן/בת משפחה נוספ/ת חורגת מהמסלול הנוכחי. ניתן לשדרג מסלול גבוה יותר."
  ];
  for (const message of hebrewMessages) {
    assert.equal(describeMemberActionError({ code: "x", status: 409, message }, FALLBACK), message);
  }
});
