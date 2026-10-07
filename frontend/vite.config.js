import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Dev-only: proxy /api to the local backend so the client uses relative paths
    // (matches the Vercel rewrite in production — no CORS juggling either way).
    proxy: { "/api": "http://localhost:8000" },
  },
});
