import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `f360 dev` sets F360_PROXY to the local proxy it just started (default
// http://127.0.0.1:4360); running `vite` directly without it falls back to
// that same default, so `npm run dev` alone still works if the proxy is
// already up. No `rewrite` here on purpose — the proxy expects `/api/...`
// verbatim (it strips a fixed "/api" prefix itself).
const proxyTarget = process.env.F360_PROXY ?? "http://127.0.0.1:4360";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
});
