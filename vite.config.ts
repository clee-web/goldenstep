import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const root = import.meta.dirname;

/**
 * Serves `/admin` in development.
 *
 * With two HTML entries Vite resolves `/admin/` but not the bare `/admin`,
 * which would 404 locally while working in production — a split that sends
 * people looking for a bug that only exists on their machine. Rewriting the
 * bare path to the directory form keeps one URL working in both places.
 */
function adminDevRoute() {
  return {
    name: 'gs-admin-dev-route',
    configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use((req: { url?: string }, _res: unknown, next: () => void) => {
        if (req.url === '/admin' || req.url === '/admin/') req.url = '/admin/index.html';
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_');

  return {
    plugins: [react(), tailwindcss(), adminDevRoute()],
    resolve: {
      alias: {
        '@': path.resolve(root, 'src'),
        '@shared': path.resolve(root, 'shared'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      /*
       * Two HTML entries, not one.
       *
       * The public site is `index.html`; the dashboard is `admin/index.html`.
       * A single-page app with a client-side `/admin` route depends on a server
       * catch-all that rewrites unknown paths to `index.html`. The Express
       * server has one, so the route works there — but a static host has no
       * fallback and returns 404 for a path with no file behind it, while the
       * public site keeps working because `/index.html` does exist. Emitting a
       * real file for the dashboard fixes that on every static host without
       * host-specific rewrite rules.
       *
       * `admin: 'admin/index.html'` (rather than `admin.html`) is deliberate:
       * the path is preserved in the output, so the built file is
       * `dist/admin/index.html` — what a static host looks for when `/admin` is
       * requested.
       */
      rolldownOptions: {
        input: {
          main: path.resolve(root, 'index.html'),
          admin: path.resolve(root, 'admin/index.html'),
        },
      },
    },
  };
});
