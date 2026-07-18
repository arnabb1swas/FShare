import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { resetDb, db } from "./helpers.js";
import { createFile, getFileBySlug } from "../models/file.js";
import { runCleanup } from "../services/cleanup.js";

const s3mock = mockClient(S3Client);
beforeEach(async () => { await resetDb(); s3mock.reset(); s3mock.on(DeleteObjectCommand).resolves({}); });

test("removes expired rows + their objects, keeps fresh", async () => {
  await createFile({ slug: "old", filename: "a", mimeType: "text/plain", size: 1, b2Key: "old", expiresAt: new Date(Date.now() - 1000) });
  await createFile({ slug: "new", filename: "b", mimeType: "text/plain", size: 1, b2Key: "new", expiresAt: new Date(Date.now() + 3600_000) });
  const res = await runCleanup();
  assert.equal(res.deleted, 1);
  assert.equal(await getFileBySlug("old"), undefined);
  assert.ok(await getFileBySlug("new"));
  assert.equal(s3mock.commandCalls(DeleteObjectCommand).length, 1);
});

after(async () => { await db.destroy(); });
