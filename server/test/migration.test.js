import { test, after } from "node:test";
import assert from "node:assert/strict";
import db from "../db/knex.js";

test("files table has expected columns", async () => {
  const info = await db("files").columnInfo();
  for (const col of ["slug","filename","mime_type","size","b2_key","sender","receiver","created_at","expires_at"]) {
    assert.ok(info[col], `missing column ${col}`);
  }
});

after(async () => { await db.destroy(); });
