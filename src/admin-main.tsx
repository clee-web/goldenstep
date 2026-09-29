import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AdminApp } from './admin/AdminApp';
import './index.css';

/**
 * Entry point for the built `admin/index.html`.
 *
 * `main.tsx` picks the dashboard by pathname so the Express server can serve
 * `/admin` through its SPA fallback. That fallback does not exist on a static
 * host, so the dashboard also ships as its own HTML entry and this file mounts
 * it directly — no pathname test, no public bundle, and no admin code in the
 * chunk graph of the public site.
 *
 * Both routes reach the same `AdminApp`; nothing else differs between them.
 */
const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
