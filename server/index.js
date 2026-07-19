import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rateLimit from "express-rate-limit";
import filesRouter from "./routes/files.js";
import downloadRouter from "./routes/download.js";
import { startCleanup } from "./services/cleanup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");

export function makeApp() {
  const app = express();
  app.use(express.json());

  const limiter = rateLimit({
    windowMs: 15 * 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // API first
  app.use("/api/files/download", downloadRouter);
  app.use("/api/files", limiter, filesRouter);

  // Static built client
  app.use(express.static(CLIENT_DIST));

  // SPA fallback for any non-/api GET (Express 5 regex route)
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });

  // Anything left (unknown /api/*) → JSON 404
  app.use((req, res) => res.status(404).json({ error: "Not found" }));

  // Catch async handler rejections (e.g. a DB error in a route) so the API
  // answers with JSON instead of Express's default HTML page, which would leak
  // a stack trace. Must be last and take 4 args to register as error middleware.
  app.use((err, req, res, next) => {
    console.error("unhandled error:", err.message);
    res.status(500).json({ error: "Server error" });
  });

  return app;
}

// Bootstrap only when run directly (not under test import)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = makeApp();
  const PORT = process.env.PORT || 5000;
  startCleanup();
  app.listen(PORT, () => console.log(`FShare running on ${PORT}`));
}
