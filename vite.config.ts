import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // In Docker: protocol is at /protocol (copied by Dockerfile Stage 1)
      // Locally: protocol is at ../../protocol relative to frontend/
      // The PROTOCOL_PATH env var lets Docker override this.
      "@verisphere/protocol": process.env.PROTOCOL_PATH
        ? path.resolve(process.env.PROTOCOL_PATH, "dist")
        : path.resolve(__dirname, "../../protocol/dist"),
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
        ws: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            console.log(
              "[Vite Proxy] →",
              req.method,
              req.url,
              "→",
              proxyReq.path,
            );
          });
          proxy.on("proxyRes", (proxyRes, req) => {
            console.log("[Vite Proxy] ←", proxyRes.statusCode, req.url);
          });
          proxy.on("error", (err) => {
            console.error("[Vite Proxy] ERROR:", err.message);
          });
        },
      },
    },

    hmr: { overlay: true },
  },
});
