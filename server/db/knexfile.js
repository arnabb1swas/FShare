import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Verify the server's TLS cert by default (managed Postgres like Neon presents a
// publicly-trusted cert, so this Just Works). Set DB_SSL_INSECURE=true only if a
// provider serves a self-signed cert and you accept the MITM risk.
const isLocal = process.env.DATABASE_URL?.includes("localhost");
const ssl = isLocal ? false : { rejectUnauthorized: process.env.DB_SSL_INSECURE !== "true" };

const config = {
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl,
  },
  pool: { min: 0, max: 10 },
  // Absolute so it resolves the same whether run via knex CLI (which cds into
  // this file's dir) or the programmatic instance (cwd = repo root).
  migrations: { directory: path.join(__dirname, "migrations") },
};

export default config;
