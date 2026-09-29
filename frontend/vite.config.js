import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY ?? 'http://localhost:3000';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      // Alias usado pelos componentes shadcn/ui (@/components/ui/...).
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
