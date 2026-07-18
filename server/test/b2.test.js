import { test } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { putObject, deleteObject, presignedDownloadUrl } from "../services/b2.js";

const s3mock = mockClient(S3Client);

test("putObject sends PutObjectCommand with body + content-type", async () => {
  s3mock.reset();
  s3mock.on(PutObjectCommand).resolves({});
  await putObject("k1", Buffer.from("hi"), "text/plain");
  const calls = s3mock.commandCalls(PutObjectCommand);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args[0].input.ContentType, "text/plain");
});

test("presigned url forces attachment download with filename", async () => {
  const url = await presignedDownloadUrl("k1", "my report.pdf", "application/pdf");
  assert.match(url, /response-content-disposition=/);
  assert.match(decodeURIComponent(url), /attachment; filename="my report.pdf"/);
});

test("deleteObject sends DeleteObjectCommand", async () => {
  s3mock.reset();
  s3mock.on(DeleteObjectCommand).resolves({});
  await deleteObject("k1");
  assert.equal(s3mock.commandCalls(DeleteObjectCommand).length, 1);
});
