import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  // Alias for protocol package (looks good, kept it)
  resolve: {
    alias: {
      '@verisphere/protocol': path.resolve(__dirname, '../../protocol/src'),
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5173,

    // Proxy configuration for /api → backend
    proxy: {
      '/api': {
        target: 'http://app:8070',      // Docker service name 'app'
        changeOrigin: true,             // Changes origin header to match target
        secure: false,                  // No HTTPS in Docker
        ws: true,                       // Support WebSockets (useful for HMR/debug)
        
        // Optional: rewrite to avoid double /api if backend routes are not prefixed
        rewrite: (path) => path.replace(/^\/api/, '/api'), // usually not needed, but safe

        // Debug logging (very helpful!)
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('[Vite Proxy] →', req.method, req.url, 'to', proxyReq.path);
          });

          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('[Vite Proxy] ←', proxyRes.statusCode, req.url);
          });

          proxy.on('error', (err, req, res) => {
            console.error('[Vite Proxy] ERROR:', err);
          });
        },
      },
    },

    // Ensure HMR overlay shows errors
    hmr: {
      overlay: true,
    },
  },
});
