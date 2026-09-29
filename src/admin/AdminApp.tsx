import { useCallback, useEffect, useState } from 'react';

import type { ApiError, ManagedContent } from '@shared/schemas';
import * as api from '@/lib/adminApi';
import { Login } from './Login';
import { Dashboard } from './Dashboard';
import { AdminShell, ErrorBanner } from './ui';

type Phase =
  | { kind: 'checking' }
  | { kind: 'signedOut'; configured: boolean }
  | { kind: 'ready'; content: ManagedContent }
  | { kind: 'failed'; error: ApiError };

/**
 * Dashboard shell.
 *
 * The session is checked on mount so a reload keeps the operator signed in, and
 * every child gets a single `refresh` callback: rather than patching local state
 * after each write, the dashboard re-reads the server. With one operator and a
 * handful of records that is cheap, and it means the dashboard can never drift
 * from what the public site will actually render.
 */
export function AdminApp() {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });

  const load = useCallback(async () => {
    const result = await api.getContent();
    if (result.ok) {
      setPhase({ kind: 'ready', content: result.data });
      return true;
    }
    if (result.error.error === 'unauthorized') {
      setPhase({ kind: 'signedOut', configured: true });
      return false;
    }
    setPhase({ kind: 'failed', error: result.error });
    return false;
  }, []);

  useEffect(() => {
    (async () => {
      const session = await api.getSession();
      if (!session.ok) {
        setPhase({ kind: 'failed', error: session.error });
        return;
      }
      if (!session.data.authenticated) {
        setPhase({ kind: 'signedOut', configured: session.data.configured });
        return;
      }
      await load();
    })();
  }, [load]);

  const onSignedIn = useCallback(async () => {
    setPhase({ kind: 'checking' });
    await load();
  }, [load]);

  const onSignedOut = useCallback(async () => {
    await api.logout();
    setPhase({ kind: 'signedOut', configured: true });
  }, []);

  if (phase.kind === 'checking') {
    return (
      <AdminShell>
        <main id="admin-main" className="grid min-h-dvh place-items-center">
          <p className="text-sm text-muted" role="status">
            Loading dashboard…
          </p>
        </main>
      </AdminShell>
    );
  }

  if (phase.kind === 'failed') {
    return (
      <AdminShell>
        <main id="admin-main" className="grid min-h-dvh place-items-center px-5">
          <div className="w-full max-w-[420px] space-y-4">
            <ErrorBanner error={phase.error} />
            <button
              type="button"
              onClick={() => {
                setPhase({ kind: 'checking' });
                void load();
              }}
              className="rounded-full bg-brand px-4 py-2.5 text-[13px] font-extrabold text-white"
            >
              Try again
            </button>
          </div>
        </main>
      </AdminShell>
    );
  }

  if (phase.kind === 'signedOut') {
    return (
      <AdminShell>
        <Login configured={phase.configured} onSignedIn={onSignedIn} />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <Dashboard
        content={phase.content}
        refresh={load}
        onSignedOut={onSignedOut}
      />
    </AdminShell>
  );
}
