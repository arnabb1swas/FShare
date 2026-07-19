import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { generateSlug } from "../lib/slug.js";
import { resolveExpiresAt, sendSchema } from "../lib/validate.js";
import { createFile, getFileBySlug, markSent, unmarkSent, deleteBySlug } from "../models/file.js";
import { putObject } from "../services/b2.js";
import { sendShareEmail } from "../services/email.js";

const MAX_BYTES = Number(process.env.MAX_FILE_MB ?? 100) * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } }).single("upfile");
const base = () => process.env.APP_BASE_URL ?? "";

// Tight per-IP limit on /send. This endpoint relays email from our domain with
// no sender verification, so throttle it hard to blunt spam/relay abuse; a
// CAPTCHA or auth gate is the stronger fix if it's ever targeted. 20/hour/IP.
const sendLimiter = rateLimit({ windowMs: 60 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

// Human-readable size for the share email (KB for small, MB/GB as they grow).
function _formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const router = Router();

router.post("/", (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      const code = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(code).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    let expiresAt;
    try {
      expiresAt = resolveExpiresAt(req.body.expires);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const slug = generateSlug();

    // Reserve the slug in the DB first. The unique constraint rejects a slug
    // collision before we ever write to B2, so an upload can never overwrite
    // another file's object under a shared key.
    try {
      await createFile({
        slug, filename: req.file.originalname, mimeType: req.file.mimetype,
        size: req.file.size, b2Key: slug, expiresAt,
      });
    } catch (e) {
      return res.status(500).json({ error: "Upload failed" });
    }

    try {
      await putObject(slug, req.file.buffer, req.file.mimetype);
    } catch (e) {
      await deleteBySlug(slug).catch(() => {}); // roll back the reserved row: no orphan
      return res.status(500).json({ error: "Upload failed" });
    }

    return res.status(201).json({ file: `${base()}/files/${slug}`, slug, expiresAt });
  });
});

router.post("/send", sendLimiter, async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: "All fields are required and must be valid emails" });
  }

  const { slug, emailTo, emailFrom } = parsed.data;

  const file = await getFileBySlug(slug);
  if (!file) {
    return res.status(404).json({ error: "Link not found" });
  }
  if (new Date(file.expires_at) < new Date()) {
    return res.status(410).json({ error: "Link expired" });
  }

  // Claim the send atomically BEFORE dispatching. The conditional update
  // (whereNull sender) is the real guard against a double-send race: two
  // concurrent requests can both pass a plain read-then-check, but only one
  // can win the update. A falsy result means it was already sent.
  const claimed = await markSent(slug, emailFrom, emailTo);
  if (!claimed) {
    return res.status(409).json({ error: "Email already sent for this file" });
  }

  try {
    await sendShareEmail({
      to: emailTo, replyTo: emailFrom,
      downloadLink: `${base()}/files/${slug}`,
      filename: file.filename, size: _formatBytes(Number(file.size)),
      expiresAt: new Date(file.expires_at),
    });
  } catch (e) {
    await unmarkSent(slug).catch(() => {}); // release the claim so the user can retry
    console.error(`send failed for ${slug}:`, e.message);
    return res.status(502).json({ error: "Failed to send email" });
  }

  return res.json({ success: true });
});

router.get("/:slug", async (req, res) => {
  const file = await getFileBySlug(req.params.slug);
  if (!file) {
    return res.status(404).json({ error: "Link not found" });
  }
  if (new Date(file.expires_at) < new Date()) {
    return res.status(410).json({ error: "Link expired" });
  }

  return res.json({
    slug: file.slug, filename: file.filename, size: Number(file.size),
    expiresAt: file.expires_at, downloadLink: `${base()}/api/files/download/${file.slug}`,
  });
});

export default router;
