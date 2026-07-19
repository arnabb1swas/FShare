import db from "../db/knex.js";

export async function createFile({ slug, filename, mimeType, size, b2Key, expiresAt }) {
  const query = db("files")
    .insert({ slug, filename, mime_type: mimeType, size, b2_key: b2Key, expires_at: expiresAt })
    .returning("*");

  const [row] = await query;

  return row;
}

export async function getFileBySlug(slug) {
  const query = db("files").where({ slug }).first();

  return await query;
}

export async function markSent(slug, sender, receiver) {
  const query = db("files")
    .where({ slug })
    .whereNull("sender")
    .update({ sender, receiver })
    .returning("*");

  const [row] = await query;

  return row; // undefined if already sent or missing
}

// Release a claim made by markSent so a failed send can be retried.
export async function unmarkSent(slug) {
  const query = db("files").where({ slug }).update({ sender: null, receiver: null });

  return await query;
}

export async function getExpired(now = new Date()) {
  const query = db("files").where("expires_at", "<", now).select("*");

  return await query;
}

export async function deleteBySlug(slug) {
  const query = db("files").where({ slug }).del();

  return await query;
}
