import { Router } from "express";
import { getFileBySlug } from "../models/file.js";
import { presignedDownloadUrl } from "../services/b2.js";

const router = Router();

router.get("/:slug", async (req, res) => {
  const file = await getFileBySlug(req.params.slug);
  if (!file) {
    return res.status(404).json({ error: "Link not found" });
  }
  if (new Date(file.expires_at) < new Date()) {
    return res.status(410).json({ error: "Link expired" });
  }

  const url = await presignedDownloadUrl(file.b2_key, file.filename, file.mime_type);
  return res.redirect(302, url);
});

export default router;
