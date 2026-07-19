import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSlug } from "../lib/slug.js";

test("slug is 10 base62 chars", () => {
  const s = generateSlug();
  assert.match(s, /^[0-9A-Za-z]{10}$/);
});

test("slugs are unique across 10000 draws", () => {
  const set = new Set();
  for (let i = 0; i < 10000; i++) set.add(generateSlug());
  assert.equal(set.size, 10000);
});
