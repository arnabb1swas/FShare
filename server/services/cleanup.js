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
  if (deleted) {
    console.log(`cleanup removed ${deleted} expired file(s)`);
  }
  return { deleted };
}

export function startCleanup(intervalMs = 3600_000) {
  runCleanup().catch((e) => console.error("cleanup error:", e.message));
  const id = setInterval(() => runCleanup().catch((e) => console.error("cleanup error:", e.message)), intervalMs);
  id.unref?.();
  return id;
}
