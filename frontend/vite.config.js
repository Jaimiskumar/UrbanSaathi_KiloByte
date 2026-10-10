import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.VITE_PROXY_TARGET || env.VITE_BACKEND_URL || 'http://127.0.0.1:5001';
  const mlTarget = env.VITE_ML_TARGET || 'http://127.0.0.1:8000';

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      allowedHosts: true,
      proxy: {
        '^/api/ml/': mlTarget,
        '/api': backendTarget,
        '/uploads': backendTarget,
        '/socket.io': {
          target: backendTarget,
          ws: true
        }
      }
    }
  };
});

