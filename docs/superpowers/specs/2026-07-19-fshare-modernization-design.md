# FShare Modernization — Design

**Date:** 2026-07-19
**Status:** Approved for planning

## Goal

Modernize a 4-year-old file-sharing app so it is fast, uses current packages, and is deployable as a free live demo a reviewer can open anytime. Replace MongoDB with Postgres + Knex. Completely revamp the frontend.

## Non-Goals

- User accounts / authentication (files are anonymous, link-based).
- Multi-file / folder uploads (single file per share, as today).
- Big-file streaming beyond the configured size cap.
- Paid infrastructure.

## Final Stack

### Backend
- **Node 24 + ESM** — native `crypto.randomUUID()` and `--env-file`; drop `dotenv` and `uuid` deps.
- **Express 5** — HTTP server + static hosting of the built client.
- **Knex.js** over **pg** — query building, migrations, seeds.
- **Neon Postgres** — file **metadata** only (free, no idle-pause).
- **Backblaze B2** via `@aws-sdk/client-s3` — file **bytes** (10 GB free, no credit card, presigned URLs).
- **multer 2** (memory storage) — parse upload into a buffer, stream to B2.
- **nodemailer 7** — email share.
- **zod** — validate request bodies / upload constraints.
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
│   │   ├── components/     Dropzone, ProgressBar, CopyLink, EmailShare
│   │   ├── lib/            api client, format helpers
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
├── server/
│   ├── index.js            Express app: static (client/dist) + /api routes
│   ├── db/
│   │   ├── knexfile.js
│   │   ├── knex.js         configured knex instance
│   │   └── migrations/     files table
│   ├── routes/
│   │   ├── files.js        POST /api/files (upload), POST /api/files/send
│   │   └── download.js     GET /api/files/download/:uuid
│   ├── services/
│   │   ├── b2.js           S3 client: put, presigned get, delete
│   │   ├── email.js        nodemailer transport + send
│   │   ├── emailTemplate.js
│   │   └── cleanup.js      interval: expire rows + B2 objects
│   └── lib/
│       └── validate.js     zod schemas
├── .env.example
├── package.json            root scripts (build client, start server, migrate)
└── README.md
```

## Data Model

Postgres table `files` (via Knex migration):

| Column | Type | Notes |
|---|---|---|
| id | serial pk | |
| uuid | text unique not null | public share id (`crypto.randomUUID()`) |
| filename | text not null | original name |
| size | bigint not null | bytes |
| b2_key | text not null | object key in B2 (= uuid) |
| sender | text nullable | set once email sent |
| receiver | text nullable | set once email sent |
| created_at | timestamptz not null default now() | drives 24h expiry |

Index on `uuid` (unique) and `created_at` (cleanup scan).

## API

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/files` | multipart `upfile` | `{ file: "<BASE_URL>/files/:uuid" }` |
| POST | `/api/files/send` | `{ uuid, emailTo, emailFrom }` | `{ success: true }` |
| GET | `/api/files/:uuid` | — | `{ uuid, filename, size, downloadLink }` (metadata for download page) |
| GET | `/api/files/download/:uuid` | — | 302 redirect to B2 presigned URL |
| GET | `/*` | — | serves `client/dist/index.html` (SPA routing) |

## Flows

**Upload**
1. Client drag-drops file → `POST /api/files` (multipart).
2. multer buffers into memory; zod validates size ≤ cap and (optional) type.
3. Upload buffer to B2 under key `uuid`.
4. Insert metadata row in Neon.
5. Return share link; UI shows copy button + email form.

**Email share**
1. `POST /api/files/send` with `{ uuid, emailTo, emailFrom }` (rate-limited, zod-validated).
2. If row already has `sender`, reject (already sent).
3. nodemailer sends templated email with download link; `from` is the app's fixed sender, `emailFrom` shown only as display/reply context (anti-spoof).
4. Persist sender/receiver.

**Download**
1. Visit `/files/:uuid` → React page calls `GET /api/files/:uuid` for metadata.
2. Click Download → `GET /api/files/download/:uuid` → server issues short-lived B2 presigned URL → 302 redirect.
3. File streams from B2 directly (never buffered by app).

**Auto-expire (24h)**
- `setInterval` (~hourly): select rows where `created_at < now() - 24h`; for each, delete B2 object then delete row. Both, to avoid orphaned objects. Log failures, continue.

## Validation & Security

- **Size cap** enforced in multer `limits.fileSize` (configurable env, default e.g. 100 MB within B2 budget).
- **zod** on `/send` body and upload metadata.
- **express-rate-limit** on `/api/files` and `/api/files/send`.
- **Email `from` locked** to app sender (no arbitrary spoofing); user email used as reply-to/display only.
- **CORS** not needed (same-origin); if enabled, restrict to `ALLOWED_CLIENTS`.
- **DB errors** surfaced (no silent swallow), fail fast on startup if DB unreachable.
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
FILE_TTL_HOURS=24
```

Loaded via Node native `--env-file=.env` (no `dotenv`).

## Replace / Upgrade / Add / Delete

**Replace:** MongoDB+Mongoose → Postgres+Knex · local disk → Backblaze B2 · manual `script.js` → interval cleanup · `dotenv` → native env-file · `uuid` → native UUID · EJS pages → React SPA.

**Upgrade:** Express 4→5 · multer 1(CVE)→2 · nodemailer 6→7 · CommonJS→ESM · Node→24.

**Add:** zod validation · rate limiting · locked email `from` · Knex migrations · responsive React UI (drag-drop, progress, copy-link, email share) · README with setup + free-hosting steps.

**Delete:** `script.js`, `config/db.js`, `models/file.js` (mongoose), old `views/` + `public/css`, `dotenv` + `uuid` from deps.

## Known Simplifications (ponytail)

- **Two datastores share state** (Neon row + B2 object). Cleanup must delete both; a failed B2 delete leaks an object — logged, retried next pass.
- **multer memory storage** buffers the whole file in RAM before B2 upload. Fine within the size cap; switch to streaming multipart if large files become common.
- **In-process interval cleanup** (not a real scheduler). If the free host sleeps, cleanup only runs while awake — acceptable; expired links 404 regardless via a `created_at` check on fetch.

## Testing

- Knex migration up/down runs clean.
- Upload → row created + B2 object exists → share link resolves metadata.
- Download redirect issues a working presigned URL.
- Email send validates, sends once, blocks re-send.
- Cleanup deletes expired row + object; leaves fresh ones.
- Expired-link fetch returns "link expired" (guard on `created_at` even before cleanup runs).
- Size-cap rejection returns a clear error.
