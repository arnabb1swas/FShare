# FShare Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the 4-year-old MongoDB/EJS file-share as a Node 24 + Express 5 + Knex/Postgres backend with a Backblaze-B2 file store and a React/Vite/Tailwind SPA, deployable free on Render.

**Architecture:** Single repo. `server/` is an ESM Express app: `/api/*` routes → static `client/dist` → SPA fallback. File **bytes** live in Backblaze B2 (S3 API); file **metadata** lives in Neon Postgres (one `files` table via Knex). Email via nodemailer over Brevo SMTP. Expired files removed by an in-process interval. `client/` is a React SPA built to static and served by the same server.

**Tech Stack:** Node 24 (ESM), Express 5, Knex + pg (Neon Postgres), `@aws-sdk/client-s3` + presigner (Backblaze B2), multer 2 (memory), nodemailer 7 (Brevo), zod, express-rate-limit, React 19 + Vite + Tailwind v4 + react-router. Tests: `node:test` + supertest + aws-sdk-client-mock (server), vitest (client).

## Global Constraints

- **Runtime:** Node 24, ESM only (`"type": "module"`). No `dotenv`, no `uuid` deps — use native `--env-file` and `crypto.randomBytes`.
- **Package floors:** Express ^5, Knex ^3, pg ^8, multer ^2, nodemailer ^7, zod ^3, @aws-sdk/client-s3 ^3, React ^19, Vite ^6, Tailwind ^4.
- **One table only:** `files`. No extra tables.
- **Links:** public id is a **10-char base62 slug** from `crypto.randomBytes`, never a raw UUID. Route: `/files/:slug`.
- **Expiry:** user-chosen. Default 24h, **max 30 days** from now. Server authoritative. `expires_at` is the single source of truth (cleanup + fetch/download guard + UI countdown).
- **Expired = HTTP 410. Missing = HTTP 404.**
- **Email `from` locked** to `MAIL_FROM`; user's address is reply-to/display only.
- **Downloads forced** via presigned URL `response-content-disposition: attachment; filename="<original>"` + `response-content-type`.
- **Upload order:** B2 put → DB insert; if insert fails, delete the B2 object (no orphans).
- **Route order:** `/api` → static → SPA fallback (fallback must NOT match `/api/*`; unknown `/api/*` returns JSON 404).
- **Size cap:** `MAX_FILE_MB` (default 100), enforced in multer `limits.fileSize`.

---

## File Structure

```
package.json              root: ESM, scripts (dev, build, migrate, start, test)
.env.example              all env vars
.gitignore                node_modules, .env, client/dist, uploads
server/
  index.js                app assembly: middleware, routes, static, SPA fallback, cleanup start
  db/
    knexfile.js           knex config from DATABASE_URL
    knex.js               shared knex instance
    migrations/
      20260719000000_create_files.js
  lib/
    slug.js               generateSlug()
    validate.js           resolveExpiresAt(), sendSchema
  models/
    file.js               createFile, getFileBySlug, markSent, getExpired, deleteBySlug
  services/
    b2.js                 putObject, presignedDownloadUrl, deleteObject
    email.js              sendShareEmail (jsonTransport fallback when no SMTP_HOST)
    emailTemplate.js      shareEmailHtml
    cleanup.js            runCleanup, startCleanup
  routes/
    files.js              POST /, POST /send, GET /:slug
    download.js           GET /:slug
  test/
    helpers.js            test app + db reset
    *.test.js             one per unit/route
client/
  package.json            react, vite, tailwind, react-router, vitest
  vite.config.js          react plugin, tailwind plugin, /api proxy (dev)
  index.html
  src/
    main.jsx              router mount
    index.css            tailwind entry
    lib/
      api.js              uploadFile (XHR progress), getFileMeta, sendEmail
      format.js           formatSize, formatCountdown
    components/
      Dropzone.jsx
      ExpirySelect.jsx
      ProgressBar.jsx
      CopyLink.jsx
      EmailShare.jsx
    pages/
      Upload.jsx
      Download.jsx
    test/
      format.test.js
README.md                 free-hosting setup (Neon, B2, Brevo, Render)
```

---

## Phase 0 — Reset & Scaffold

### Task 0: Remove legacy code, scaffold ESM project

**Files:**

- Delete: `index.js`, `script.js`, `config/db.js`, `models/file.js`, `views/`, `public/css/`, `.deepsource.toml`
- Modify: `package.json`, `.env.example`, `.gitignore`

- [ ] **Step 1: Delete legacy files**

```bash
git rm -r index.js script.js config models/file.js views public/css .deepsource.toml
rmdir models config public/img public 2>/dev/null || true
```

- [ ] **Step 2: Write new root `package.json`**

```json
{
  "name": "fshare",
  "version": "2.0.0",
  "description": "File Sharing Web App",
  "type": "module",
  "main": "server/index.js",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev:server": "node --env-file=.env --watch server/index.js",
    "dev:client": "npm --prefix client run dev",
    "build": "npm --prefix client install && npm --prefix client run build",
    "migrate": "knex migrate:latest --knexfile server/db/knexfile.js",
    "start": "npm run migrate && node --env-file=.env server/index.js",
    "test": "node --env-file=.env.test --test"
  },
  "author": "Arnab Biswas",
  "license": "ISC",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.700.0",
    "@aws-sdk/s3-request-presigner": "^3.700.0",
    "express": "^5.0.1",
    "express-rate-limit": "^7.4.1",
    "knex": "^3.1.0",
    "multer": "^2.0.0",
    "nodemailer": "^7.0.0",
    "pg": "^8.13.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "aws-sdk-client-mock": "^4.1.0",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 3: Write `.env.example`**

```
PORT=5000
APP_BASE_URL=http://localhost:5000

# Neon Postgres
DATABASE_URL=postgres://user:pass@host/db?sslmode=require

# Backblaze B2 (S3-compatible)
B2_ENDPOINT=https://s3.us-west-000.backblazeb2.com
B2_REGION=us-west-000
B2_BUCKET=
B2_KEY_ID=
B2_APP_KEY=

# SMTP (Brevo). Leave SMTP_HOST empty to log emails to console instead of sending.
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
MAIL_USER=
MAIL_PASS=
MAIL_FROM=FShare <no-reply@example.com>

# Limits
MAX_FILE_MB=100
DEFAULT_EXPIRY_HOURS=24
MAX_EXPIRY_DAYS=30
```

Also create `.env` (copy of example, filled locally) and `.env.test` (same but `DATABASE_URL` → a throwaway test DB and empty `SMTP_HOST`).

- [ ] **Step 4: Write `.gitignore`**

```
node_modules
client/node_modules
client/dist
.env
.env.test
uploads
*.log
```

- [ ] **Step 5: Install and commit**

```bash
npm install
git add -A
git commit -m "chore: reset to ESM scaffold, drop mongo/dotenv/uuid"
```

---

## Phase 1 — Backend units (pure logic first)

### Task 1: Slug generator

**Files:**

- Create: `server/lib/slug.js`
- Test: `server/test/slug.test.js`

**Interfaces:**

- Produces: `generateSlug(): string` — 10 chars, `[0-9A-Za-z]`.

- [ ] **Step 1: Write failing test** — `server/test/slug.test.js`

```js
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
```

- [ ] **Step 2: Run, expect fail**

Run: `node --test server/test/slug.test.js`
Expected: FAIL (`Cannot find module '../lib/slug.js'`).

- [ ] **Step 3: Implement** — `server/lib/slug.js`

```js
import { randomBytes } from "node:crypto";

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const LENGTH = 10;

// Rejection-free enough: map each random byte into 62 chars.
// Byte range 0-255 mod 62 has slight bias; negligible for collision-avoidance here
// (10 chars = 62^10 ≈ 8.4e17 space). ponytail: bias acceptable for share slugs.
export function generateSlug() {
  const bytes = randomBytes(LENGTH);
  let out = "";
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `node --test server/test/slug.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add server/lib/slug.js server/test/slug.test.js
git commit -m "feat: base62 slug generator"
```

---

### Task 2: Expiry + send validation

**Files:**

- Create: `server/lib/validate.js`
- Test: `server/test/validate.test.js`

**Interfaces:**

- Consumes env: `DEFAULT_EXPIRY_HOURS`, `MAX_EXPIRY_DAYS`.
- Produces:
  - `resolveExpiresAt(raw?: string, now?: Date): Date` — parses ISO `raw`; if absent → `now + DEFAULT_EXPIRY_HOURS`. Throws `Error` (message usable as 400 text) if not a valid date, in the past, or beyond `now + MAX_EXPIRY_DAYS`.
  - `sendSchema` — zod object `{ slug: string(1..), emailTo: email, emailFrom: email }`.

- [ ] **Step 1: Write failing test** — `server/test/validate.test.js`

```js
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
  assert.throws(
    () => resolveExpiresAt("2026-09-01T00:00:00Z", NOW),
    /30 days/i,
  );
});

test("rejects garbage", () => {
  assert.throws(() => resolveExpiresAt("not-a-date", NOW), /invalid/i);
});

test("sendSchema rejects bad email", () => {
  const r = sendSchema.safeParse({
    slug: "abc",
    emailTo: "x",
    emailFrom: "a@b.com",
  });
  assert.equal(r.success, false);
});
```

- [ ] **Step 2: Run, expect fail** — `node --test server/test/validate.test.js`

- [ ] **Step 3: Implement** — `server/lib/validate.js`

```js
import { z } from "zod";

const DEFAULT_EXPIRY_HOURS = Number(process.env.DEFAULT_EXPIRY_HOURS ?? 24);
const MAX_EXPIRY_DAYS = Number(process.env.MAX_EXPIRY_DAYS ?? 30);

export function resolveExpiresAt(raw, now = new Date()) {
  if (raw == null || raw === "") {
    return new Date(now.getTime() + DEFAULT_EXPIRY_HOURS * 3600_000);
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid expiry date");
  if (d <= now) throw new Error("Expiry must be in the future");
  const max = new Date(now.getTime() + MAX_EXPIRY_DAYS * 86_400_000);
  if (d > max)
    throw new Error(`Expiry cannot be more than ${MAX_EXPIRY_DAYS} days away`);
  return d;
}

export const sendSchema = z.object({
  slug: z.string().min(1),
  emailTo: z.string().email(),
  emailFrom: z.string().email(),
});
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit**

```bash
git add server/lib/validate.js server/test/validate.test.js
git commit -m "feat: expiry + send validation"
```

---

### Task 3: Knex config, instance, migration

**Files:**

- Create: `server/db/knexfile.js`, `server/db/knex.js`, `server/db/migrations/20260719000000_create_files.js`
- Test: `server/test/migration.test.js`

**Interfaces:**

- Produces: default export `db` (knex instance) from `server/db/knex.js`.
- `files` columns: `id, slug, filename, mime_type, size, b2_key, sender, receiver, created_at, expires_at`.

- [ ] **Step 1: Write `server/db/knexfile.js`**

```js
const config = {
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  },
  pool: { min: 0, max: 10 },
  migrations: { directory: "./server/db/migrations" },
};

export default config;
```

- [ ] **Step 2: Write `server/db/knex.js`**

```js
import knexLib from "knex";
import config from "./knexfile.js";

const db = knexLib(config);
export default db;
```

- [ ] **Step 3: Write migration** — `server/db/migrations/20260719000000_create_files.js`

```js
export async function up(knex) {
  await knex.schema.createTable("files", (t) => {
    t.increments("id").primary();
    t.text("slug").notNullable().unique();
    t.text("filename").notNullable();
    t.text("mime_type").notNullable();
    t.bigInteger("size").notNullable();
    t.text("b2_key").notNullable();
    t.text("sender").nullable();
    t.text("receiver").nullable();
    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.timestamp("expires_at", { useTz: true }).notNullable();
    t.index("expires_at");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("files");
}
```

- [ ] **Step 4: Run migration against the test DB**

Run: `knex migrate:latest --knexfile server/db/knexfile.js` (with `.env.test` loaded: `node --env-file=.env.test node_modules/.bin/knex migrate:latest --knexfile server/db/knexfile.js`)
Expected: "Batch 1 run: 1 migrations".

- [ ] **Step 5: Write test** — `server/test/migration.test.js`

```js
import { test, after } from "node:test";
import assert from "node:assert/strict";
import db from "../db/knex.js";

test("files table has expected columns", async () => {
  const info = await db("files").columnInfo();
  for (const col of [
    "slug",
    "filename",
    "mime_type",
    "size",
    "b2_key",
    "sender",
    "receiver",
    "created_at",
    "expires_at",
  ]) {
    assert.ok(info[col], `missing column ${col}`);
  }
});

after(async () => {
  await db.destroy();
});
```

- [ ] **Step 6: Run, expect pass.** `node --env-file=.env.test --test server/test/migration.test.js`

- [ ] **Step 7: Commit**

```bash
git add server/db package.json
git commit -m "feat: knex config, instance, files migration"
```

---

### Task 4: File model (queries)

**Files:**

- Create: `server/models/file.js`, `server/test/helpers.js`
- Test: `server/test/file.model.test.js`

**Interfaces:**

- Produces (all async):
  - `createFile({ slug, filename, mimeType, size, b2Key, expiresAt }) -> row`
  - `getFileBySlug(slug) -> row | undefined`
  - `markSent(slug, sender, receiver) -> row | undefined` (only sets if `sender` currently null; returns updated row or undefined if already sent / missing)
  - `getExpired(now = new Date()) -> row[]`
  - `deleteBySlug(slug) -> number` (rows deleted)
- Row shape: `{ id, slug, filename, mime_type, size, b2_key, sender, receiver, created_at, expires_at }`.

- [ ] **Step 1: Write `server/test/helpers.js`**

```js
import db from "../db/knex.js";

export async function resetDb() {
  await db("files").truncate();
}

export { db };
```

- [ ] **Step 2: Write failing test** — `server/test/file.model.test.js`

```js
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb, db } from "./helpers.js";
import {
  createFile,
  getFileBySlug,
  markSent,
  getExpired,
  deleteBySlug,
} from "../models/file.js";

const base = {
  slug: "abc123",
  filename: "a.txt",
  mimeType: "text/plain",
  size: 10,
  b2Key: "abc123",
};

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
  await createFile({
    ...base,
    slug: "old",
    b2Key: "old",
    expiresAt: new Date(Date.now() - 1000),
  });
  await createFile({
    ...base,
    slug: "new",
    b2Key: "new",
    expiresAt: new Date(Date.now() + 3600_000),
  });
  const expired = await getExpired();
  assert.deepEqual(
    expired.map((r) => r.slug),
    ["old"],
  );
});

after(async () => {
  await db.destroy();
});
```

- [ ] **Step 3: Run, expect fail.**

- [ ] **Step 4: Implement** — `server/models/file.js`

```js
import db from "../db/knex.js";

export async function createFile({
  slug,
  filename,
  mimeType,
  size,
  b2Key,
  expiresAt,
}) {
  const [row] = await db("files")
    .insert({
      slug,
      filename,
      mime_type: mimeType,
      size,
      b2_key: b2Key,
      expires_at: expiresAt,
    })
    .returning("*");
  return row;
}

export function getFileBySlug(slug) {
  return db("files").where({ slug }).first();
}

export async function markSent(slug, sender, receiver) {
  const [row] = await db("files")
    .where({ slug })
    .whereNull("sender")
    .update({ sender, receiver })
    .returning("*");
  return row; // undefined if already sent or missing
}

export function getExpired(now = new Date()) {
  return db("files").where("expires_at", "<", now).select("*");
}

export function deleteBySlug(slug) {
  return db("files").where({ slug }).del();
}
```

- [ ] **Step 5: Run, expect pass.**

- [ ] **Step 6: Commit**

```bash
git add server/models/file.js server/test/helpers.js server/test/file.model.test.js
git commit -m "feat: file model queries"
```

---

### Task 5: B2 storage service

**Files:**

- Create: `server/services/b2.js`
- Test: `server/test/b2.test.js`

**Interfaces:**

- Produces (async):
  - `putObject(key, buffer, contentType) -> void`
  - `presignedDownloadUrl(key, filename, contentType) -> string` (URL contains `response-content-disposition` forcing `attachment; filename`)
  - `deleteObject(key) -> void`

- [ ] **Step 1: Write failing test** — `server/test/b2.test.js` (S3 mocked)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  putObject,
  deleteObject,
  presignedDownloadUrl,
} from "../services/b2.js";

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
  const url = await presignedDownloadUrl(
    "k1",
    "my report.pdf",
    "application/pdf",
  );
  assert.match(url, /response-content-disposition=/);
  assert.match(decodeURIComponent(url), /attachment; filename="my report.pdf"/);
});

test("deleteObject sends DeleteObjectCommand", async () => {
  s3mock.reset();
  s3mock.on(DeleteObjectCommand).resolves({});
  await deleteObject("k1");
  assert.equal(s3mock.commandCalls(DeleteObjectCommand).length, 1);
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement** — `server/services/b2.js`

```js
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
});

const Bucket = process.env.B2_BUCKET;

export async function putObject(key, buffer, contentType) {
  await client.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

export function presignedDownloadUrl(key, filename, contentType) {
  const cmd = new GetObjectCommand({
    Bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
    ResponseContentType: contentType,
  });
  return getSignedUrl(client, cmd, { expiresIn: 300 });
}

export async function deleteObject(key) {
  await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
}
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit**

```bash
git add server/services/b2.js server/test/b2.test.js
git commit -m "feat: B2 storage service"
```

---

### Task 6: Email template + service

**Files:**

- Create: `server/services/emailTemplate.js`, `server/services/email.js`
- Test: `server/test/email.test.js`

**Interfaces:**

- `shareEmailHtml({ replyTo, downloadLink, size, expiresAt }) -> string`
- `sendShareEmail({ to, replyTo, downloadLink, filename, size, expiresAt }) -> info` — uses SMTP when `SMTP_HOST` set, else `jsonTransport` (logs, no send). `from` is `MAIL_FROM`.

- [ ] **Step 1: Write failing test** — `server/test/email.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { shareEmailHtml } from "../services/emailTemplate.js";
import { sendShareEmail } from "../services/email.js";

test("template embeds the download link", () => {
  const html = shareEmailHtml({
    replyTo: "a@b.com",
    downloadLink: "http://x/files/abc",
    size: "10 KB",
    expiresAt: new Date(),
  });
  assert.match(html, /http:\/\/x\/files\/abc/);
});

test("sendShareEmail uses MAIL_FROM and jsonTransport when no SMTP_HOST", async () => {
  const info = await sendShareEmail({
    to: "c@d.com",
    replyTo: "a@b.com",
    downloadLink: "http://x/files/abc",
    filename: "a.txt",
    size: "10 KB",
    expiresAt: new Date(),
  });
  const msg = JSON.parse(info.message);
  assert.equal(
    msg.from.address ?? msg.from,
    process.env.MAIL_FROM?.match(/<(.+)>/)?.[1] ?? process.env.MAIL_FROM,
  );
  assert.equal(msg.replyTo?.[0]?.address ?? msg.replyTo, "a@b.com");
});
```

(Run with `.env.test` where `SMTP_HOST` is empty and `MAIL_FROM=FShare <no-reply@example.com>`.)

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `server/services/emailTemplate.js`** (port the existing HTML, parameterized)

```js
export function shareEmailHtml({ replyTo, downloadLink, size, expiresAt }) {
  const expires = expiresAt.toUTCString();
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><title>FShare</title></head>
  <body style="background:#f6f6f6;font-family:sans-serif;margin:0;padding:0">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;padding:20px">
      <tr><td style="background:#fff;border-radius:8px;padding:24px">
        <p>Hi there,</p>
        <p><b>${replyTo}</b> shared a file with you.</p>
        <p>${size} in total ・ Expires ${expires}</p>
        <p><a href="${downloadLink}" target="_blank"
          style="display:inline-block;background:#3498db;color:#fff;text-decoration:none;
          padding:12px 24px;border-radius:6px;font-weight:bold">Download file</a></p>
        <p style="color:#999;font-size:12px;margin-top:24px">Sent via FShare.</p>
      </td></tr>
    </table>
  </body></html>`;
}
```

- [ ] **Step 4: Implement `server/services/email.js`**

```js
import nodemailer from "nodemailer";
import { shareEmailHtml } from "./emailTemplate.js";

function makeTransport() {
  if (!process.env.SMTP_HOST) {
    return nodemailer.createTransport({ jsonTransport: true }); // dev/test: no real send
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });
}

export async function sendShareEmail({
  to,
  replyTo,
  downloadLink,
  filename,
  size,
  expiresAt,
}) {
  const transport = makeTransport();
  return transport.sendMail({
    from: process.env.MAIL_FROM,
    to,
    replyTo,
    subject: "A file was shared with you via FShare",
    text: `${replyTo} shared "${filename}" with you: ${downloadLink} (expires ${expiresAt.toUTCString()})`,
    html: shareEmailHtml({ replyTo, downloadLink, size, expiresAt }),
  });
}
```

- [ ] **Step 5: Run, expect pass.** Adjust the `from` assertion if nodemailer's jsonTransport nests differently; the intent is `from` === MAIL_FROM address and replyTo preserved.

- [ ] **Step 6: Commit**

```bash
git add server/services/email.js server/services/emailTemplate.js server/test/email.test.js
git commit -m "feat: share email template + sender"
```

---

### Task 7: Cleanup service

**Files:**

- Create: `server/services/cleanup.js`
- Test: `server/test/cleanup.test.js`

**Interfaces:**

- Consumes: `getExpired`, `deleteBySlug` (model), `deleteObject` (b2).
- Produces: `runCleanup() -> { deleted: number }`; `startCleanup(intervalMs = 3600_000) -> intervalId`.
- Contract: for each expired row, delete B2 object **then** delete row. A failed B2 delete is logged and the row is left for the next pass (no silent row deletion without object cleanup).

- [ ] **Step 1: Write failing test** — `server/test/cleanup.test.js`

```js
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { resetDb, db } from "./helpers.js";
import { createFile, getFileBySlug } from "../models/file.js";
import { runCleanup } from "../services/cleanup.js";

const s3mock = mockClient(S3Client);
beforeEach(async () => {
  await resetDb();
  s3mock.reset();
  s3mock.on(DeleteObjectCommand).resolves({});
});

test("removes expired rows + their objects, keeps fresh", async () => {
  await createFile({
    slug: "old",
    filename: "a",
    mimeType: "text/plain",
    size: 1,
    b2Key: "old",
    expiresAt: new Date(Date.now() - 1000),
  });
  await createFile({
    slug: "new",
    filename: "b",
    mimeType: "text/plain",
    size: 1,
    b2Key: "new",
    expiresAt: new Date(Date.now() + 3600_000),
  });
  const res = await runCleanup();
  assert.equal(res.deleted, 1);
  assert.equal(await getFileBySlug("old"), undefined);
  assert.ok(await getFileBySlug("new"));
  assert.equal(s3mock.commandCalls(DeleteObjectCommand).length, 1);
});

after(async () => {
  await db.destroy();
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement** — `server/services/cleanup.js`

```js
import { getExpired, deleteBySlug } from "../models/file.js";
import { deleteObject } from "./b2.js";

export async function runCleanup() {
  const rows = await getExpired();
  let deleted = 0;
  for (const row of rows) {
    try {
      await deleteObject(row.b2_key);
      await deleteBySlug(row.slug);
      deleted++;
    } catch (err) {
      console.error(`cleanup failed for ${row.slug}:`, err.message);
    }
  }
  if (deleted) console.log(`cleanup removed ${deleted} expired file(s)`);
  return { deleted };
}

export function startCleanup(intervalMs = 3600_000) {
  runCleanup().catch((e) => console.error("cleanup error:", e.message));
  const id = setInterval(
    () => runCleanup().catch((e) => console.error("cleanup error:", e.message)),
    intervalMs,
  );
  id.unref?.();
  return id;
}
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit**

```bash
git add server/services/cleanup.js server/test/cleanup.test.js
git commit -m "feat: expiry cleanup (row + object, no orphans)"
```

---

## Phase 2 — Backend routes & app

### Task 8: Files router (upload, send, metadata)

**Files:**

- Create: `server/routes/files.js`
- Test: `server/test/files.route.test.js`

**Interfaces:**

- Consumes: `generateSlug`, `resolveExpiresAt`, `sendSchema`, model fns, `putObject`, `deleteObject`, `sendShareEmail`.
- Produces: default export `router` mounted at `/api/files`.
  - `POST /` — multipart `upfile` + text `expires` → `{ file, slug, expiresAt }` (201). Errors: 400 no file / bad expiry, 413 too big.
  - `POST /send` — `{ slug, emailTo, emailFrom }` → `{ success: true }`. 422 invalid, 404 missing, 410 expired, 409 already sent.
  - `GET /:slug` — `{ slug, filename, size, expiresAt, downloadLink }` or 404 / 410.

- [ ] **Step 1: Write failing test** — `server/test/files.route.test.js`

```js
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { resetDb, db } from "./helpers.js";
import { makeApp } from "../index.js";

const s3mock = mockClient(S3Client);
const app = makeApp();

beforeEach(async () => {
  await resetDb();
  s3mock.reset();
  s3mock.on(PutObjectCommand).resolves({});
});

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
  const up = await request(app)
    .post("/api/files")
    .attach("upfile", Buffer.from("x"), "a.txt")
    .field("expires", "");
  const ok = await request(app)
    .post("/api/files/send")
    .send({ slug: up.body.slug, emailTo: "c@d.com", emailFrom: "a@b.com" });
  assert.equal(ok.status, 200);
  const again = await request(app)
    .post("/api/files/send")
    .send({ slug: up.body.slug, emailTo: "c@d.com", emailFrom: "a@b.com" });
  assert.equal(again.status, 409);
});

after(async () => {
  await db.destroy();
});
```

- [ ] **Step 2: Run, expect fail** (router + `makeApp` not yet present).

- [ ] **Step 3: Implement** — `server/routes/files.js`

```js
import { Router } from "express";
import multer from "multer";
import { generateSlug } from "../lib/slug.js";
import { resolveExpiresAt, sendSchema } from "../lib/validate.js";
import { createFile, getFileBySlug, markSent } from "../models/file.js";
import {
  putObject,
  deleteObject,
  presignedDownloadUrl,
} from "../services/b2.js";
import { sendShareEmail } from "../services/email.js";

const MAX_BYTES = Number(process.env.MAX_FILE_MB ?? 100) * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
}).single("upfile");
const base = () => process.env.APP_BASE_URL ?? "";

const router = Router();

router.post("/", (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      const code = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(code).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    let expiresAt;
    try {
      expiresAt = resolveExpiresAt(req.body.expires);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const slug = generateSlug();
    try {
      await putObject(slug, req.file.buffer, req.file.mimetype);
      await createFile({
        slug,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        b2Key: slug,
        expiresAt,
      });
    } catch (e) {
      await deleteObject(slug).catch(() => {}); // compensate: no orphan object
      return res.status(500).json({ error: "Upload failed" });
    }

    return res
      .status(201)
      .json({ file: `${base()}/files/${slug}`, slug, expiresAt });
  });
});

router.post("/send", async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(422)
      .json({ error: "All fields are required and must be valid emails" });
  const { slug, emailTo, emailFrom } = parsed.data;

  const file = await getFileBySlug(slug);
  if (!file) return res.status(404).json({ error: "Link not found" });
  if (new Date(file.expires_at) < new Date())
    return res.status(410).json({ error: "Link expired" });
  if (file.sender)
    return res.status(409).json({ error: "Email already sent for this file" });

  await sendShareEmail({
    to: emailTo,
    replyTo: emailFrom,
    downloadLink: `${base()}/files/${slug}`,
    filename: file.filename,
    size: `${Math.round(file.size / 1024)} KB`,
    expiresAt: new Date(file.expires_at),
  });
  await markSent(slug, emailFrom, emailTo);
  return res.json({ success: true });
});

router.get("/:slug", async (req, res) => {
  const file = await getFileBySlug(req.params.slug);
  if (!file) return res.status(404).json({ error: "Link not found" });
  if (new Date(file.expires_at) < new Date())
    return res.status(410).json({ error: "Link expired" });
  return res.json({
    slug: file.slug,
    filename: file.filename,
    size: Number(file.size),
    expiresAt: file.expires_at,
    downloadLink: `${base()}/api/files/download/${file.slug}`,
  });
});

export default router;
```

- [ ] **Step 4: Defer running until Task 10** (needs `makeApp`). Proceed.

- [ ] **Step 5: Commit**

```bash
git add server/routes/files.js server/test/files.route.test.js
git commit -m "feat: files router (upload, send, metadata)"
```

---

### Task 9: Download router

**Files:**

- Create: `server/routes/download.js`

**Interfaces:**

- Produces: default export `router` mounted at `/api/files/download`.
  - `GET /:slug` → 302 redirect to presigned URL; 404 missing; 410 expired.

- [ ] **Step 1: Implement** — `server/routes/download.js`

```js
import { Router } from "express";
import { getFileBySlug } from "../models/file.js";
import { presignedDownloadUrl } from "../services/b2.js";

const router = Router();

router.get("/:slug", async (req, res) => {
  const file = await getFileBySlug(req.params.slug);
  if (!file) return res.status(404).json({ error: "Link not found" });
  if (new Date(file.expires_at) < new Date())
    return res.status(410).json({ error: "Link expired" });
  const url = await presignedDownloadUrl(
    file.b2_key,
    file.filename,
    file.mime_type,
  );
  return res.redirect(302, url);
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/download.js
git commit -m "feat: download router (presigned redirect)"
```

---

### Task 10: App assembly (`makeApp` + server bootstrap)

**Files:**

- Create: `server/index.js`
- Test: `server/test/app.test.js` (+ runs Task 8 route tests)

**Interfaces:**

- Produces: named export `makeApp() -> express app`; default side-effect bootstrap (listen + startCleanup) when run directly.
- Route order: rate-limited `/api/files` + `/api/files/download`, then `express.static(client/dist)`, then SPA fallback for non-`/api` GET, then a JSON 404 for anything left (i.e. unknown `/api/*`).

- [ ] **Step 1: Implement** — `server/index.js`

```js
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rateLimit from "express-rate-limit";
import filesRouter from "./routes/files.js";
import downloadRouter from "./routes/download.js";
import { startCleanup } from "./services/cleanup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");

export function makeApp() {
  const app = express();
  app.use(express.json());

  const limiter = rateLimit({
    windowMs: 15 * 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // API first
  app.use("/api/files/download", downloadRouter);
  app.use("/api/files", limiter, filesRouter);

  // Static built client
  app.use(express.static(CLIENT_DIST));

  // SPA fallback for any non-/api GET (Express 5 regex route)
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });

  // Anything left (unknown /api/*) → JSON 404
  app.use((req, res) => res.status(404).json({ error: "Not found" }));

  return app;
}

// Bootstrap only when run directly (not under test import)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = makeApp();
  const PORT = process.env.PORT || 5000;
  startCleanup();
  app.listen(PORT, () => console.log(`FShare running on ${PORT}`));
}
```

- [ ] **Step 2: Write test** — `server/test/app.test.js`

```js
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

after(async () => {
  await db.destroy();
});
```

- [ ] **Step 3: Run the full backend suite**

Run: `node --env-file=.env.test --test`
Expected: slug, validate, migration, file.model, b2, email, cleanup, files.route, app all PASS.

- [ ] **Step 4: Commit**

```bash
git add server/index.js server/test/app.test.js
git commit -m "feat: express app assembly + route ordering"
```

---

## Phase 3 — Frontend (React + Vite + Tailwind)

### Task 11: Client scaffold (Vite + React + Tailwind + router)

**Files:**

- Create: `client/package.json`, `client/vite.config.js`, `client/index.html`, `client/src/main.jsx`, `client/src/index.css`

**Interfaces:**

- Dev server proxies `/api` and `/files` to `http://localhost:5000`.
- Build outputs `client/dist`.

- [ ] **Step 1: Write `client/package.json`**

```json
{
  "name": "fshare-client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `client/vite.config.js`**

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
```

- [ ] **Step 3: Write `client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FShare — Simple file sharing</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Write `client/src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 5: Write `client/src/main.jsx`** (placeholder routes; pages land in later tasks)

```jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Upload from "./pages/Upload.jsx";
import Download from "./pages/Download.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/files/:slug" element={<Download />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
```

- [ ] **Step 6: Install** — `npm --prefix client install`

- [ ] **Step 7: Commit** (build verified after pages exist)

```bash
git add client/package.json client/vite.config.js client/index.html client/src/main.jsx client/src/index.css
git commit -m "feat: client scaffold (vite + react + tailwind + router)"
```

---

### Task 12: Client helpers (format + countdown) — tested

**Files:**

- Create: `client/src/lib/format.js`
- Test: `client/src/test/format.test.js`

**Interfaces:**

- `formatSize(bytes: number) -> string` (e.g. `1536 -> "1.5 KB"`, `0 -> "0 B"`).
- `formatCountdown(expiresAt: string|Date, now?: Date) -> string` (e.g. `"expires in 23h 59m"`, past → `"expired"`).

- [ ] **Step 1: Write failing test** — `client/src/test/format.test.js`

```js
import { describe, it, expect } from "vitest";
import { formatSize, formatCountdown } from "../lib/format.js";

describe("formatSize", () => {
  it("bytes", () => expect(formatSize(500)).toBe("500 B"));
  it("kb", () => expect(formatSize(1536)).toBe("1.5 KB"));
  it("mb", () => expect(formatSize(5 * 1024 * 1024)).toBe("5.0 MB"));
});

describe("formatCountdown", () => {
  const now = new Date("2026-07-19T00:00:00Z");
  it("hours + minutes", () =>
    expect(formatCountdown("2026-07-19T23:30:00Z", now)).toBe(
      "expires in 23h 30m",
    ));
  it("days", () =>
    expect(formatCountdown("2026-07-22T00:00:00Z", now)).toBe(
      "expires in 3d 0h",
    ));
  it("past", () =>
    expect(formatCountdown("2026-07-18T00:00:00Z", now)).toBe("expired"));
});
```

- [ ] **Step 2: Run, expect fail** — `npm --prefix client run test`

- [ ] **Step 3: Implement** — `client/src/lib/format.js`

```js
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatCountdown(expiresAt, now = new Date()) {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "expired";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `expires in ${days}d ${hours}h`;
  return `expires in ${hours}h ${mins}m`;
}
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/format.js client/src/test/format.test.js
git commit -m "feat: client format + countdown helpers"
```

---

### Task 13: API client

**Files:**

- Create: `client/src/lib/api.js`

**Interfaces:**

- `uploadFile(file: File, expiresISO: string|"", onProgress: (pct:number)=>void) -> Promise<{ file, slug, expiresAt }>` (XHR for progress; rejects with `{ status, error }`).
- `getFileMeta(slug) -> Promise<{ slug, filename, size, expiresAt, downloadLink }>` (rejects with `{ status }` on 404/410).
- `sendEmail({ slug, emailTo, emailFrom }) -> Promise<void>` (rejects with `{ status, error }`).

- [ ] **Step 1: Implement** — `client/src/lib/api.js`

```js
export function uploadFile(file, expiresISO, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("upfile", file);
    form.append("expires", expiresISO || "");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject({ status: xhr.status, error: body.error || "Upload failed" });
    };
    xhr.onerror = () => reject({ status: 0, error: "Network error" });
    xhr.send(form);
  });
}

export async function getFileMeta(slug) {
  const res = await fetch(`/api/files/${slug}`);
  if (!res.ok) throw { status: res.status };
  return res.json();
}

export async function sendEmail({ slug, emailTo, emailFrom }) {
  const res = await fetch("/api/files/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, emailTo, emailFrom }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, error: body.error || "Failed to send" };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/api.js
git commit -m "feat: client api (xhr upload, meta, send)"
```

---

### Task 14: UI components

**Files:**

- Create: `client/src/components/Dropzone.jsx`, `ExpirySelect.jsx`, `ProgressBar.jsx`, `CopyLink.jsx`, `EmailShare.jsx`

**Interfaces:**

- `<Dropzone onFile={(file)=>void} disabled />` — click-to-select + drag-drop; shows drag-over state.
- `<ExpirySelect value={isoString} onChange={(iso)=>void} />` — presets (1h/1d/7d/30d) + custom datetime capped at now+30d; emits ISO string (empty = default).
- `<ProgressBar pct={number} />`.
- `<CopyLink url={string} />` — copy button with "Copied!" feedback.
- `<EmailShare slug={string} link={string} />` — from/to inputs, send, success/error/disabled states.

- [ ] **Step 1: Implement `client/src/components/Dropzone.jsx`**

```jsx
import { useRef, useState } from "react";

export default function Dropzone({ onFile, disabled }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  function pick(files) {
    if (files && files[0]) onFile(files[0]);
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) pick(e.dataTransfer.files);
      }}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition
        ${over ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"}
        ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      <p className="text-lg font-medium text-gray-700">Drop a file here</p>
      <p className="text-sm text-gray-500">or click to browse</p>
    </div>
  );
}
```

- [ ] **Step 2: Implement `client/src/components/ExpirySelect.jsx`**

```jsx
import { useState } from "react";

const PRESETS = [
  { label: "1 hour", hours: 1 },
  { label: "1 day", hours: 24 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
];

function isoFromNow(hours) {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

// datetime-local needs "YYYY-MM-DDTHH:mm" in local time
function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ExpirySelect({ value, onChange }) {
  const [mode, setMode] = useState("preset");
  const maxDate = new Date(Date.now() + 30 * 86_400_000);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Link expires in
      </label>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.hours}
            type="button"
            onClick={() => {
              setMode("preset");
              onChange(isoFromNow(p.hours));
            }}
            className={`rounded-full px-3 py-1 text-sm ${
              mode === "preset" && value === isoFromNow(p.hours)
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={`rounded-full px-3 py-1 text-sm ${mode === "custom" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >
          Custom
        </button>
      </div>
      {mode === "custom" && (
        <input
          type="datetime-local"
          max={toLocalInput(maxDate)}
          min={toLocalInput(new Date())}
          onChange={(e) =>
            onChange(
              e.target.value ? new Date(e.target.value).toISOString() : "",
            )
          }
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Implement `client/src/components/ProgressBar.jsx`**

```jsx
export default function ProgressBar({ pct }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full bg-blue-600 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Implement `client/src/components/CopyLink.jsx`**

```jsx
import { useState } from "react";

export default function CopyLink({ url }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-2">
      <input
        readOnly
        value={url}
        className="flex-1 bg-transparent px-2 text-sm text-gray-700 outline-none"
      />
      <button
        onClick={copy}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Implement `client/src/components/EmailShare.jsx`**

```jsx
import { useState } from "react";
import { sendEmail } from "../lib/api.js";

export default function EmailShare({ slug }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      await sendEmail({ slug, emailFrom: from, emailTo: to });
      setState("sent");
    } catch (err) {
      setError(err.error || "Failed to send");
      setState("error");
    }
  }

  if (state === "sent")
    return <p className="text-sm text-green-600">Email sent ✓</p>;

  return (
    <form onSubmit={submit} className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Or email the link</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          placeholder="Your email"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="email"
          required
          placeholder="Recipient email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          disabled={state === "sending"}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add client/src/components
git commit -m "feat: UI components (dropzone, expiry, progress, copy, email)"
```

---

### Task 15: Upload page (state machine)

**Files:**

- Create: `client/src/pages/Upload.jsx`

**Interfaces:**

- States: `idle → uploading(pct) → success(link) → error`. Client-side size pre-check against `MAX_FILE_MB` (hardcode 100 to match server default; document that it mirrors the env cap).

- [ ] **Step 1: Implement** — `client/src/pages/Upload.jsx`

```jsx
import { useState } from "react";
import Dropzone from "../components/Dropzone.jsx";
import ExpirySelect from "../components/ExpirySelect.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import CopyLink from "../components/CopyLink.jsx";
import EmailShare from "../components/EmailShare.jsx";
import { uploadFile } from "../lib/api.js";
import { formatSize } from "../lib/format.js";

const MAX_MB = 100; // mirrors server MAX_FILE_MB default

export default function Upload() {
  const [state, setState] = useState("idle");
  const [pct, setPct] = useState(0);
  const [expires, setExpires] = useState(""); // "" = server default 24h
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function onFile(file) {
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File too large (max ${MAX_MB} MB)`);
      setState("error");
      return;
    }
    setState("uploading");
    setPct(0);
    setError("");
    try {
      const res = await uploadFile(file, expires, setPct);
      setResult({ ...res, name: file.name, size: file.size });
      setState("success");
    } catch (err) {
      setError(err.error || "Upload failed");
      setState("error");
    }
  }

  function reset() {
    setState("idle");
    setResult(null);
    setError("");
    setPct(0);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">FShare</h1>
        <p className="text-gray-500">
          Share any file with a clean, expiring link.
        </p>
      </header>

      {state === "idle" && (
        <div className="space-y-4">
          <Dropzone onFile={onFile} />
          <ExpirySelect value={expires} onChange={setExpires} />
        </div>
      )}

      {state === "uploading" && (
        <div className="space-y-3">
          <p className="text-center text-sm text-gray-600">Uploading… {pct}%</p>
          <ProgressBar pct={pct} />
        </div>
      )}

      {state === "success" && result && (
        <div className="space-y-4 rounded-2xl border border-gray-200 p-6">
          <div>
            <p className="font-medium text-gray-900">{result.name}</p>
            <p className="text-sm text-gray-500">{formatSize(result.size)}</p>
          </div>
          <CopyLink url={result.file} />
          <EmailShare slug={result.slug} />
          <button
            onClick={reset}
            className="text-sm text-blue-600 hover:underline"
          >
            Share another file
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="space-y-3 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={reset}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/Upload.jsx
git commit -m "feat: upload page state machine"
```

---

### Task 16: Download page (state machine + countdown)

**Files:**

- Create: `client/src/pages/Download.jsx`

**Interfaces:**

- States: `loading → ready → expired(410) → notfound(404) → error`. Live countdown ticks each minute.

- [ ] **Step 1: Implement** — `client/src/pages/Download.jsx`

```jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getFileMeta } from "../lib/api.js";
import { formatSize, formatCountdown } from "../lib/format.js";

export default function Download() {
  const { slug } = useParams();
  const [state, setState] = useState("loading");
  const [meta, setMeta] = useState(null);
  const [, tick] = useState(0);

  useEffect(() => {
    getFileMeta(slug)
      .then((m) => {
        setMeta(m);
        setState("ready");
      })
      .catch((err) =>
        setState(
          err.status === 410
            ? "expired"
            : err.status === 404
              ? "notfound"
              : "error",
        ),
      );
  }, [slug]);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Link to="/" className="text-2xl font-bold text-gray-900">
        FShare
      </Link>

      {state === "loading" && <p className="text-gray-500">Loading…</p>}

      {state === "ready" && meta && (
        <div className="w-full space-y-4 rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Your file is ready
          </h2>
          <div>
            <p className="font-medium text-gray-800">{meta.filename}</p>
            <p className="text-sm text-gray-500">
              {formatSize(meta.size)} ・ {formatCountdown(meta.expiresAt)}
            </p>
          </div>
          <a
            href={meta.downloadLink}
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
          >
            Download file
          </a>
        </div>
      )}

      {(state === "expired" || state === "notfound") && (
        <div className="space-y-2">
          <p className="text-red-600">
            {state === "expired" ? "This link has expired." : "Link not found."}
          </p>
          <Link to="/" className="text-sm text-blue-600 hover:underline">
            Share a file instead
          </Link>
        </div>
      )}

      {state === "error" && (
        <p className="text-red-600">Something went wrong.</p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Build the client to verify the whole SPA compiles**

Run: `npm --prefix client run build`
Expected: `dist/` produced, no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Download.jsx
git commit -m "feat: download page + live countdown"
```

---

## Phase 4 — Integration, docs, verification

### Task 17: End-to-end local run

**Files:** none (verification task)

- [ ] **Step 1: Ensure `.env` filled** with real Neon `DATABASE_URL`, B2 creds, and either Brevo creds or empty `SMTP_HOST` (console mode).

- [ ] **Step 2: Migrate + start server**

Run: `npm start`
Expected: "Batch 1 run" (if fresh DB), then "FShare running on 5000".

- [ ] **Step 3: Start client dev in a second shell**

Run: `npm run dev:client`
Open `http://localhost:5173`, upload a small file, confirm: progress bar, success link, copy button, countdown on the `/files/:slug` page, download works (file saves with original name), email send (check console JSON if SMTP empty, or inbox if Brevo).

- [ ] **Step 4: Verify built SPA served by Express**

Run: `npm run build && npm start`, open `http://localhost:5000`, repeat upload/download against the built app (no vite). Confirm `/files/:slug` deep-link loads (SPA fallback) and `GET /api/nope` returns JSON 404.

- [ ] **Step 5: Commit any fixes found during the run.**

---

### Task 18: README + deployment docs

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# FShare

Share any file via a clean, expiring link. Upload → copy link (or email it) → the
file auto-deletes when its link expires (default 24h, up to 30 days).

## Stack

Node 24 (ESM) · Express 5 · Knex + Postgres (Neon) · Backblaze B2 (files) ·
nodemailer + Brevo (email) · React 19 + Vite + Tailwind.

## Local development

1. `npm install && npm --prefix client install`
2. Copy `.env.example` → `.env`, fill `DATABASE_URL`, B2 creds, (optional) Brevo creds.
   Leave `SMTP_HOST` empty to log emails to the console instead of sending.
3. `npm start` (migrates + serves API on :5000).
4. In another shell: `npm run dev:client` (Vite on :5173, proxies /api).
5. Tests: `npm test` (server, needs a throwaway `DATABASE_URL` in `.env.test`) and
   `npm --prefix client test`.

## Free hosting (all no credit card)

- **Neon** (Postgres): create a project → copy the connection string → `DATABASE_URL`.
- **Backblaze B2**: create a bucket → application key → fill `B2_*` (endpoint/region from the bucket page).
- **Brevo**: verify a sender email → SMTP key → `MAIL_USER`/`MAIL_PASS`, set `MAIL_FROM`.
- **Render** (web service):
  - Build command: `npm install && npm run build`
  - Start command: `npm start`
  - Add all `.env` vars in the dashboard; set `APP_BASE_URL` to the Render URL.
  - Free tier sleeps after ~15 min idle (first hit ~1 min cold start).

## How it works

- Upload buffers in memory (cap `MAX_FILE_MB`), streams to B2 under a random 10-char slug,
  metadata row saved in Postgres. If the DB insert fails the B2 object is deleted (no orphans).
- Download issues a short-lived B2 presigned URL that forces `attachment` with the original filename.
- An in-process hourly job deletes rows past `expires_at` and their B2 objects.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with local + free-hosting setup"
```

---

### Task 19: Final full-suite gate

- [ ] **Step 1: Server tests** — `npm test` → all PASS.
- [ ] **Step 2: Client tests** — `npm --prefix client test` → all PASS.
- [ ] **Step 3: Client build** — `npm run build` → succeeds.
- [ ] **Step 4: Confirm legacy gone** — `git ls-files` shows no `mongoose`, `script.js`, `views/`, `config/db.js`, and `package.json` has no `dotenv`/`uuid`/`cors`/`mongoose`.
- [ ] **Step 5: Tag**

```bash
git commit --allow-empty -m "chore: FShare v2 modernization complete"
```

---

## Self-Review

**Spec coverage:** Stack (Tasks 0,3,5,6,11) · one table + schema (Task 3) · short slug (Task 1) · dynamic expiry default/max (Task 2, ExpirySelect T14) · API endpoints (Tasks 8–10) · upload orphan-compensation (Task 8) · forced download (Task 5) · 410/404 guards (Tasks 8,9) · SPA route order + JSON 404 (Task 10) · XHR progress (Task 13) · UI states + countdown + copy + email (Tasks 14–16) · cleanup (Task 7) · migrate-on-deploy (Task 0 start script) · Brevo SMTP + jsonTransport fallback (Task 6) · env vars (Task 0) · README/hosting (Task 18) · all testing bullets (per-task tests + Task 19). No gaps.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The only deliberate approximations are marked `ponytail:` (slug modulo bias) and noted (jsonTransport `from` assertion may need shape tweak) — acceptable, not placeholders.

**Type consistency:** Row uses snake_case DB columns (`mime_type`, `b2_key`, `expires_at`) consistently across model, routes, cleanup. API JSON uses camelCase (`expiresAt`, `downloadLink`) consistently across routes and client. `generateSlug`, `resolveExpiresAt`, `sendSchema`, `putObject/presignedDownloadUrl/deleteObject`, `createFile/getFileBySlug/markSent/getExpired/deleteBySlug`, `runCleanup/startCleanup`, `makeApp`, `uploadFile/getFileMeta/sendEmail`, `formatSize/formatCountdown` — names match every call site.
