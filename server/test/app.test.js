import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { makeApp } from "../index.js";
import { db } from "./helpers.js";

const app = makeApp();

test("unknown /api route → JSON 404", async () => {
  const r = await request(app).get("/api/nope");
  assert.equal(r.status, 404);
  assert.equal(r.headers["content-type"]?.includes("application/json"), true);
});

after(async () => { await db.destroy(); });
