import { Router } from "express";
import multer from "multer";
import { generateSlug } from "../lib/slug.js";
import { resolveExpiresAt, sendSchema } from "../lib/validate.js";
import { createFile, getFileBySlug, markSent } from "../models/file.js";
import { putObject, deleteObject, presignedDownloadUrl } from "../services/b2.js";
import { sendShareEmail } from "../services/email.js";

const MAX_BYTES = Number(process.env.MAX_FILE_MB ?? 100) * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } }).single("upfile");
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
        slug, filename: req.file.originalname, mimeType: req.file.mimetype,
        size: req.file.size, b2Key: slug, expiresAt,
      });
    } catch (e) {
      await deleteObject(slug).catch(() => {}); // compensate: no orphan object
      return res.status(500).json({ error: "Upload failed" });
    }

    return res.status(201).json({ file: `${base()}/files/${slug}`, slug, expiresAt });
  });
});

router.post("/send", async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "All fields are required and must be valid emails" });
  const { slug, emailTo, emailFrom } = parsed.data;

  const file = await getFileBySlug(slug);
  if (!file) return res.status(404).json({ error: "Link not found" });
  if (new Date(file.expires_at) < new Date()) return res.status(410).json({ error: "Link expired" });
  if (file.sender) return res.status(409).json({ error: "Email already sent for this file" });

  await sendShareEmail({
    to: emailTo, replyTo: emailFrom,
    downloadLink: `${base()}/files/${slug}`,
    filename: file.filename, size: `${Math.round(file.size / 1024)} KB`,
    expiresAt: new Date(file.expires_at),
  });
  await markSent(slug, emailFrom, emailTo);
  return res.json({ success: true });
});

router.get("/:slug", async (req, res) => {
  const file = await getFileBySlug(req.params.slug);
  if (!file) return res.status(404).json({ error: "Link not found" });
  if (new Date(file.expires_at) < new Date()) return res.status(410).json({ error: "Link expired" });
  return res.json({
    slug: file.slug, filename: file.filename, size: Number(file.size),
    expiresAt: file.expires_at, downloadLink: `${base()}/api/files/download/${file.slug}`,
  });
});

export default router;
