import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:5001';
const mlTarget = process.env.VITE_ML_TARGET || 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '^/api/ml/': mlTarget,
      '/api': backendTarget,
      '/socket.io': {
        target: backendTarget,
        ws: true
      }
    }
  }
});

