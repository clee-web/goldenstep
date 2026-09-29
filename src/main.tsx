import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

/**
 * The dashboard is a separate chunk, not a route inside the story, for two
 * reasons: visitors to the public site should not download admin code they will
 * never run, and the admin shell has none of the scroll-driven narrative
 * chrome, so sharing a layout would only mean fighting it. A pathname check is
 * enough for a site with one admin surface — a router would be a dependency with
 * no other user.
 *
 * The lazy import is only reached on /admin, so the public bundle never pulls it.
 */
const AdminApp = lazy(() =>
  import('./admin/AdminApp').then((module) => ({ default: module.AdminApp })),
);

const isAdmin = window.location.pathname === '/admin'
  || window.location.pathname.startsWith('/admin/');

createRoot(container).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense
        fallback={
          <div className="grid min-h-dvh place-items-center">
            <p className="text-sm text-muted" role="status">
              Loading dashboard…
            </p>
          </div>
        }
      >
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
