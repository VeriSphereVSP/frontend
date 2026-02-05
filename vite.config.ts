import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // Map @verisphere/protocol → protocol/src folder
      "@verisphere/protocol": "/frontend/protocol/src",
    },
  },

  server: {
    host: "0.0.0.0",
    port: 5173,

    proxy: {
      "/api": {
        target: "http://app:8070",
        changeOrigin: true,
        secure: false,
      },
    },

    hmr: {
      overlay: true,
    },
  },
});
