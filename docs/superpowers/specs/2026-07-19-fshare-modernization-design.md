# FShare Modernization — Design

**Date:** 2026-07-19
**Status:** Approved for planning

## Goal

Modernize a 4-year-old file-sharing app so it is fast, uses current packages, and is deployable as a free live demo a reviewer can open anytime. Replace MongoDB with Postgres + Knex. Completely revamp the frontend. Clean short share links, seamless UI/UX, user-chosen expiry.

## Non-Goals

- User accounts / authentication (files are anonymous, link-based).
- Multi-file / folder uploads (single file per share, as today).
- Multi-recipient or repeat email sends (one send per file).
- Download analytics / tracking.
- Big-file streaming beyond the configured size cap.
- Paid infrastructure.

## Final Stack

### Backend

- **Node 24 + ESM** — native `crypto.randomUUID()` / `crypto.randomBytes()` and `--env-file`; drop `dotenv` and `uuid` deps.
- **Express 5** — HTTP server + static hosting of the built client.
- **Knex.js** over **pg** — query building + migrations.
- **Neon Postgres** — file **metadata** only (free, no idle-pause).
- **Backblaze B2** via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` — file **bytes** (10 GB free, no credit card, presigned URLs).
- **multer 2** (memory storage) — parse upload into a buffer, stream to B2.
- **nodemailer 7** — email share.
- **zod** — validate request bodies, expiry, upload constraints.
- **express-rate-limit** — throttle upload + email endpoints.
- In-process **`setInterval`** cleanup — delete expired rows and their B2 objects.

### Frontend

- **React 19 + Vite + Tailwind CSS** — single-page app, built to static `client/dist`.
- Served by the same Express server (one deploy, no CORS).

### Hosting

- **Render** free web service (no credit card; ~1 min cold start after idle — acceptable for review).
- **Neon** (Postgres) + **Backblaze B2** (files). One GitHub repo, Render auto-deploys on push.

## Repo Structure

```
fshare/
├── client/                 React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/          Upload page, Download page
│   │   ├── components/     Dropzone, ProgressBar, ExpirySelect, CopyLink, EmailShare
│   │   ├── lib/            api client (XHR upload), format helpers, countdown
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
├── server/
│   ├── index.js            Express app: /api routes → static → SPA fallback
│   ├── db/
│   │   ├── knexfile.js
│   │   ├── knex.js         configured knex instance
│   │   └── migrations/     files table
│   ├── routes/
│   │   ├── files.js        POST /api/files (upload), POST /api/files/send, GET /api/files/:slug
│   │   └── download.js     GET /api/files/download/:slug
│   ├── services/
│   │   ├── b2.js           S3 client: put, presigned get (download disposition), delete
│   │   ├── email.js        nodemailer transport + send
│   │   ├── emailTemplate.js
│   │   └── cleanup.js      interval: expire rows + B2 objects
│   └── lib/
│       ├── slug.js         short base62 id from crypto.randomBytes
│       └── validate.js     zod schemas
├── .env.example
├── package.json            root scripts (build client, migrate, start server)
└── README.md
```

## Data Model

**One table.** Every operation is a single-row lookup by `slug`; file bytes live in B2, so the row is tiny. Splitting `sender`/`receiver` into an `email_shares` table only pays off with multi-recipient/repeat sends (out of scope, 1:1 here); a `downloads` table only for analytics (out of scope). Extra tables would add joins for zero benefit. Revisit only if download-tracking or multi-recipient sharing is added.

Postgres table `files` (via Knex migration):

| Column     | Type                               | Notes                                        |
| ---------- | ---------------------------------- | -------------------------------------------- |
| id         | serial pk                          |                                              |
| slug       | text unique not null               | public short link id (base62, ~10 chars)     |
| filename   | text not null                      | original name (used on download)             |
| mime_type  | text not null                      | for download content-type + disposition      |
| size       | bigint not null                    | bytes                                        |
| b2_key     | text not null                      | object key in B2                             |
| sender     | text nullable                      | set once email sent                          |
| receiver   | text nullable                      | set once email sent                          |
| created_at | timestamptz not null default now() |                                              |
| expires_at | timestamptz not null               | user-chosen; drives expiry, cleanup, UI      |

Indexes: `slug` (unique), `expires_at` (cleanup scan).

## Links

Short, clean slug — not a raw UUID. 10-char base62 from native `crypto.randomBytes` (no dep). Share link: `<BASE_URL>/files/aB3xK9dPq2`. Unique constraint; on rare collision, regenerate and retry insert.

## Expiry (dynamic)

- User chooses at upload. **Default 24h. Maximum 30 days from now.**
- UI: presets (1 hour / 1 day / 7 days / 30 days) + **custom** via native `<input type="datetime-local">` with `max` set to now + 30 days.
- **Server authoritative:** zod validates `now < expires_at ≤ now + 30 days`; reject otherwise. Client pre-check only for instant feedback.
- `expires_at` is the single source of truth for cleanup, the fetch/download expiry guard, and the UI countdown.

## API

| Method | Path                        | Body                           | Response                                                                 |
| ------ | --------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| POST   | `/api/files`                | multipart `upfile` + `expires` | `{ file: "<BASE_URL>/files/:slug", slug, expiresAt }`                    |
| POST   | `/api/files/send`           | `{ slug, emailTo, emailFrom }` | `{ success: true }`                                                      |
| GET    | `/api/files/:slug`          | —                              | `{ slug, filename, size, expiresAt, downloadLink }` or 404/410           |
| GET    | `/api/files/download/:slug` | —                              | 302 → B2 presigned URL (forces download w/ original name), or 404/410    |
| GET    | `/*` (non-`/api`)           | —                              | serves `client/dist/index.html` (SPA routing)                            |

Unknown `/api/*` paths return JSON 404 — the SPA fallback matches only non-`/api` routes. Route order: `/api` → static assets → SPA fallback. Expired resources return **410 Gone**; missing return **404**.

## Flows

**Upload**

1. Client validates size (pre-check) + expiry, then `POST /api/files` via **XMLHttpRequest** (for real upload-progress %).
2. multer buffers into memory; zod validates size ≤ cap, mime, and `expires` window.
3. Generate slug; upload buffer to B2 under `b2_key` (content-type = mime).
4. Insert metadata row (with `expires_at`). **If insert fails, delete the B2 object** (no orphan). Order is B2-first, DB-second, compensate on DB error.
5. Return share link + `expiresAt`; UI shows copy button + email form.

**Email share**

1. `POST /api/files/send` with `{ slug, emailTo, emailFrom }` (rate-limited, zod-validated).
2. Load row; if expired → 410; if `sender` already set → reject (already sent).
3. nodemailer sends templated email with download link. `from` is the app's fixed `MAIL_FROM`; user's `emailFrom` used only as display/reply-to (anti-spoof).
4. Persist `sender`/`receiver`.

**Download**

1. Visit `/files/:slug` → React page calls `GET /api/files/:slug` for metadata (checks `expires_at`).
2. Click Download → `GET /api/files/download/:slug` → re-check `expires_at` → issue short-lived (~5 min) B2 presigned URL with `response-content-disposition: attachment; filename="<original>"` and `response-content-type: <mime>` → 302 redirect.
3. File streams from B2 directly with its original name; never buffered by the app.

**Auto-expire**

- `setInterval` (~hourly): select rows where `expires_at < now()`; for each, delete B2 object then delete row (both, no orphans). Log failures, continue; failed B2 deletes retried next pass.

## UI / UX (states)

**Upload page:** `idle → drag-over → uploading(%) → success → error`.

- Dropzone doubles as click-to-select (works on touch/mobile — no drag needed).
- Expiry selector (presets + custom datetime, capped at +30d).
- Client-side size pre-check; clear message if over cap.
- Success: short link shown, **copy button** with "Copied!" feedback, then email-share form.
- Error / 429: inline, human-readable ("File too large", "Too many uploads, slow down"), retry available.

**Download page:** `loading → ready → expired(410) → not-found(404) → error`.

- Ready: filename, size, **live countdown to `expires_at`**, download button.
- Expired/not-found: clean message, link back to upload.

**Basics:** responsive (Tailwind), keyboard-accessible controls, labeled inputs, visible focus.

## Validation & Security

- **Size cap** in multer `limits.fileSize` (env `MAX_FILE_MB`).
- **zod** on upload (`expires`, mime) and `/send` body.
- **express-rate-limit** on `/api/files` and `/api/files/send`.
- **Expiry window** clamped server-side to `(now, now+30d]`.
- **Email `from` locked** to `MAIL_FROM`; user email is display/reply-to only.
- **Forced download** (content-disposition attachment) — uploaded HTML/JS can't execute inline in a browser tab.
- **CORS** unneeded (same-origin); if enabled, restrict to `ALLOWED_CLIENTS`.
- **DB errors** surfaced (no silent swallow); fail fast on startup if DB unreachable.
- Presigned download URLs are short-lived.

## Environment Variables

```
PORT=5000
APP_BASE_URL=http://localhost:5000

# Neon Postgres
DATABASE_URL=postgres://...

# Backblaze B2 (S3-compatible)
B2_ENDPOINT=
B2_REGION=
B2_BUCKET=
B2_KEY_ID=
B2_APP_KEY=

# SMTP
SMTP_HOST=
SMTP_PORT=587
MAIL_USER=
MAIL_PASS=
MAIL_FROM=FShare <no-reply@...>

# Limits
MAX_FILE_MB=100
DEFAULT_EXPIRY_HOURS=24
MAX_EXPIRY_DAYS=30
```

Loaded via Node native `--env-file=.env` (no `dotenv`).

## Deployment

- Single GitHub repo → Render web service.
- Build: `npm install && npm run build` (builds `client/dist`).
- Start: `npm start` runs `knex migrate:latest` then boots the server (table exists before serving).
- Env vars set in Render dashboard; Neon + B2 created once, credentials pasted in.
- README documents the free-tier setup end to end.

## Replace / Upgrade / Add / Delete

**Replace:** MongoDB+Mongoose → Postgres+Knex · local disk → Backblaze B2 · manual `script.js` → interval cleanup · `dotenv` → native env-file · `uuid` → native slug · EJS pages → React SPA · fixed 24h expiry → dynamic (default 24h, max 30d) · raw UUID links → short base62 slug.

**Upgrade:** Express 4→5 · multer 1(CVE)→2 · nodemailer 6→7 · CommonJS→ESM · Node→24.

**Add:** zod validation · rate limiting · locked email `from` · Knex migrations · `mime_type` + `expires_at` columns · forced-download presigned URLs · orphan-compensation on upload · SPA-safe route ordering · XHR upload progress · responsive React UI (drag-drop + click, progress, expiry select, copy-link, countdown, email share) · README with free-hosting steps.

**Delete:** `script.js`, `config/db.js`, `models/file.js` (mongoose), old `views/` + `public/css`, `dotenv` + `uuid` deps.

## Known Simplifications (ponytail)

- **Two datastores share state** (Neon row + B2 object). Cleanup deletes both; a failed B2 delete leaks an object — logged, retried next pass.
- **multer memory storage** buffers the whole file in RAM before B2 upload. Fine within the size cap; switch to streaming multipart if large files become common.
- **In-process interval cleanup** (not a real scheduler). If the free host sleeps, cleanup only runs while awake — acceptable; the `expires_at` guard on every fetch/download means expired links return 410 even before cleanup runs.
- **One table.** Correct for single-share, no-analytics, no-auth scope; documented upgrade path above.

## Testing

- Knex migration up/down runs clean.
- Slug generator: no collisions across N generations; retry path on forced duplicate.
- Upload → row created + B2 object exists → link resolves metadata.
- Upload with forced DB failure → B2 object is deleted (no orphan).
- Expiry validation: rejects past dates and > 30 days; accepts within window.
- Download redirect issues a working presigned URL that downloads with the original filename.
- Email send validates, sends once, blocks re-send, 410 on expired.
- Cleanup deletes expired row + object; leaves fresh ones.
- Expired-link fetch/download returns 410 before cleanup runs (guard on `expires_at`).
- Size-cap rejection returns a clear error.
- Unknown `/api/*` returns JSON 404; unknown non-API route serves the SPA.
