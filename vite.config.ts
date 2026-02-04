// frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: "0.0.0.0",
    port: 5173,

    // Proxy configuration – this MUST be here
    proxy: {
      // Match /api and forward to backend (keep /api prefix)
      "/api": {
        target: "http://app:8070",
        changeOrigin: true,
        secure: false
        // Do NOT rewrite – backend expects /api prefix
        // rewrite: (path) => path.replace(/^\/api/, ""),  // ← MUST BE COMMENTED OUT or REMOVED
      },
    },

    hmr: {
      overlay: true,
    },
  },
});
