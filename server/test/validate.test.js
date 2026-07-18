import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveExpiresAt, sendSchema } from "../lib/validate.js";

const NOW = new Date("2026-07-19T00:00:00Z");

test("defaults to +24h when raw missing", () => {
  const d = resolveExpiresAt(undefined, NOW);
  assert.equal(d.toISOString(), "2026-07-20T00:00:00.000Z");
});

test("accepts a date inside the window", () => {
  const d = resolveExpiresAt("2026-07-25T00:00:00Z", NOW);
  assert.equal(d.toISOString(), "2026-07-25T00:00:00.000Z");
});

test("rejects past dates", () => {
  assert.throws(() => resolveExpiresAt("2026-07-18T00:00:00Z", NOW), /future/i);
});

test("rejects beyond 30 days", () => {
  assert.throws(() => resolveExpiresAt("2026-09-01T00:00:00Z", NOW), /30 days/i);
});

test("rejects garbage", () => {
  assert.throws(() => resolveExpiresAt("not-a-date", NOW), /invalid/i);
});

test("sendSchema rejects bad email", () => {
  const r = sendSchema.safeParse({ slug: "abc", emailTo: "x", emailFrom: "a@b.com" });
  assert.equal(r.success, false);
});
