import db from "../db/knex.js";

export async function resetDb() {
  await db("files").truncate();
}

export { db };
