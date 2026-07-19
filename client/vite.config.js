import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Read PORT from the repo-root .env so the dev proxy always targets the same
// port the API server actually runs on (default 5000), instead of a hardcoded
// value that silently breaks the dev client when they disagree.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const apiPort = env.PORT || "5000";

  return {
    plugins: [react(), tailwind()],
    server: {
      proxy: {
        "/api": `http://localhost:${apiPort}`,
      },
    },
  };
});
