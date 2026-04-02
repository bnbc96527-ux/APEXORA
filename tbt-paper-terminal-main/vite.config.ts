import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const binanceTarget = env.VITE_BINANCE_REST_TARGET || 'https://testnet.binance.vision';
  const allowedHosts = ['.lhr.life', '.localhost.run'];
  const proxy = {
    '/binance-api': {
      target: binanceTarget,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/binance-api/, ''),
    },
    '/live-api': {
      target: 'http://localhost:4010',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/live-api/, ''),
    },
    '/api': {
      target: 'http://localhost:4010',
      changeOrigin: true,
    },
  };

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    worker: {
      format: 'es',
    },
    esbuild: {
      drop: ['console', 'debugger'],
    },
    server: {
      // Allow localhost.run tunnel hostnames (otherwise Vite blocks the request).
      // Example: https://<random>.lhr.life -> http://localhost:8080
      allowedHosts,
      proxy,
    },
    // "vite preview" should also accept the tunnel hostname and proxy API routes.
    preview: {
      allowedHosts,
      proxy,
    },
  };
});
