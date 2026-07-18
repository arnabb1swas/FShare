import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb, db } from "./helpers.js";
import { createFile, getFileBySlug, markSent, getExpired, deleteBySlug } from "../models/file.js";

const base = { slug: "abc123", filename: "a.txt", mimeType: "text/plain", size: 10, b2Key: "abc123" };

beforeEach(resetDb);

test("create + fetch by slug", async () => {
  await createFile({ ...base, expiresAt: new Date(Date.now() + 3600_000) });
  const row = await getFileBySlug("abc123");
  assert.equal(row.filename, "a.txt");
});

test("markSent sets once, blocks second", async () => {
  await createFile({ ...base, expiresAt: new Date(Date.now() + 3600_000) });
  const first = await markSent("abc123", "a@b.com", "c@d.com");
  assert.equal(first.sender, "a@b.com");
  const second = await markSent("abc123", "x@y.com", "z@w.com");
  assert.equal(second, undefined);
});

test("getExpired returns only past rows", async () => {
  await createFile({ ...base, slug: "old", b2Key: "old", expiresAt: new Date(Date.now() - 1000) });
  await createFile({ ...base, slug: "new", b2Key: "new", expiresAt: new Date(Date.now() + 3600_000) });
  const expired = await getExpired();
  assert.deepEqual(expired.map((r) => r.slug), ["old"]);
});

after(async () => { await db.destroy(); });
