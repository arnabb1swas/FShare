import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { resetDb, db } from "./helpers.js";
import { makeApp } from "../index.js";

const s3mock = mockClient(S3Client);
const app = makeApp();

beforeEach(async () => { await resetDb(); s3mock.reset(); s3mock.on(PutObjectCommand).resolves({}); });

test("upload → metadata roundtrip", async () => {
  const up = await request(app)
    .post("/api/files")
    .attach("upfile", Buffer.from("hello"), "hello.txt")
    .field("expires", "");
  assert.equal(up.status, 201);
  assert.match(up.body.file, /\/files\/[0-9A-Za-z]{10}$/);

  const meta = await request(app).get(`/api/files/${up.body.slug}`);
  assert.equal(meta.status, 200);
  assert.equal(meta.body.filename, "hello.txt");
});

test("upload with no file → 400", async () => {
  const r = await request(app).post("/api/files").field("expires", "");
  assert.equal(r.status, 400);
});

test("metadata for unknown slug → 404", async () => {
  const r = await request(app).get("/api/files/zzzzzzzzzz");
  assert.equal(r.status, 404);
});

test("send validates + blocks re-send", async () => {
  const up = await request(app).post("/api/files").attach("upfile", Buffer.from("x"), "a.txt").field("expires", "");
  const ok = await request(app).post("/api/files/send").send({ slug: up.body.slug, emailTo: "c@d.com", emailFrom: "a@b.com" });
  assert.equal(ok.status, 200);
  const again = await request(app).post("/api/files/send").send({ slug: up.body.slug, emailTo: "c@d.com", emailFrom: "a@b.com" });
  assert.equal(again.status, 409);
});

after(async () => { await db.destroy(); });
