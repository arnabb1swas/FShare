import db from "../db/knex.js";

export async function createFile({ slug, filename, mimeType, size, b2Key, expiresAt }) {
  const [row] = await db("files")
    .insert({ slug, filename, mime_type: mimeType, size, b2_key: b2Key, expires_at: expiresAt })
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
