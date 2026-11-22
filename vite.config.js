import { defineConfig } from "vite";
import deployment from "./vercel.json" with { type: "json" };
import { publicBinding } from "./config/staging.js";
import { fileURLToPath } from "node:url";
import disabled from "./api/[...path].js";
function localApi(server) {
  server.middlewares.use("/api", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body) => res.end(JSON.stringify(body));
    disabled(_req, res);
  });
}
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@store": fileURLToPath(
        new URL(
          publicBinding(mode)
            ? "./src/staging/store.js"
            : "./src/demo/store.js",
          import.meta.url,
        ),
      ),
    },
  },
  envPrefix: "FOLIO_PUBLIC_UNUSED_",
  worker: { format: "es" },
  optimizeDeps: {
    exclude: ["@electric-sql/pglite", "@electric-sql/pglite/worker"],
  },
  build: { sourcemap: false },
  plugins: [
    {
      name: "disabled-merchant-api",
      configureServer: localApi,
      configurePreviewServer: localApi,
    },
  ],
  preview: {
    headers: Object.fromEntries(
      deployment.headers[0].headers.map(({ key, value }) => [key, value]),
    ),
  },
}));
