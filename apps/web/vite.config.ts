import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const backend = process.env.API_URL || "http://127.0.0.1:8086";
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 3100,
    strictPort: true,
    proxy: Object.fromEntries(
      ["/api", "/media", "/i/"].map((path) => [
        path,
        { target: backend, changeOrigin: false },
      ]),
    ),
  },
  preview: {
    host: "127.0.0.1",
    port: 3100,
    strictPort: true,
    proxy: Object.fromEntries(
      ["/api", "/media", "/i/"].map((path) => [
        path,
        { target: backend, changeOrigin: false },
      ]),
    ),
  },
});
