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
3. `npm start` (migrates + serves API on `PORT`, default 5000).
4. In another shell: `npm run dev:client` (Vite on :5173, proxies /api).
5. Tests: `npm test` (server, needs a throwaway `DATABASE_URL` in `.env.test`) and
   `npm --prefix client test`.

> **macOS note:** port 5000 is taken by the AirPlay Receiver (Control Center). Set
> `PORT=5050` (and `APP_BASE_URL=http://localhost:5050`) in `.env`, or turn off
> AirPlay Receiver in System Settings → General → AirDrop & Handoff.

## Free hosting (all no credit card)

- **Neon** (Postgres): create a project → copy the connection string → `DATABASE_URL`.
- **Backblaze B2**: create a bucket → application key → fill `B2_*` (endpoint/region from the bucket page).
- **Brevo**: verify a sender email → SMTP key → `MAIL_USER`/`MAIL_PASS`, set `MAIL_FROM`.
  Add your server's IP under Brevo's *Authorized IPs* or sends fail with `525 Unauthorized IP`.
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
