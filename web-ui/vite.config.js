import { defineConfig } from "vite";

const backendTarget = (
  process.env.ASSISTANT_API_BASE_URL ||
  process.env.VITE_AI_API_BASE_URL ||
  "http://127.0.0.1:8080"
).replace(/\/$/, "");

export default defineConfig({
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
        secure: true
      }
    }
  },
  preview: {
    host: "127.0.0.1"
  }
});
