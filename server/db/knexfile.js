import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
  },
  pool: { min: 0, max: 10 },
  // Absolute so it resolves the same whether run via knex CLI (which cds into
  // this file's dir) or the programmatic instance (cwd = repo root).
  migrations: { directory: path.join(__dirname, "migrations") },
};

export default config;
