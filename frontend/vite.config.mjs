import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react({ include: /\.[jt]sx?$/ })],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    // Public values only. Existing React components keep their proven API config.
    define: {
      'process.env.REACT_APP_BACKEND_URL': JSON.stringify(env.REACT_APP_BACKEND_URL || ''),
      'process.env.REACT_APP_GTM_ID': JSON.stringify(env.REACT_APP_GTM_ID || ''),
      'process.env.REACT_APP_SITE_URL': JSON.stringify(env.REACT_APP_SITE_URL || 'https://lacabaneduchene.fr'),
    },
    esbuild: { loader: 'jsx', include: /src\/.*\.[jt]sx?$/, exclude: [] },
    optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
    server: {
      host: '0.0.0.0', port: Number(process.env.PORT || 3000), allowedHosts: true,
      proxy: { '/api': { target: process.env.API_PROXY_URL || 'http://127.0.0.1:8001', changeOrigin: true } },
    },
    build: { outDir: 'build', sourcemap: false },
  };
});
