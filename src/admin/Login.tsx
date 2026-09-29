import { useState } from 'react';

import type { ApiError } from '@shared/schemas';
import * as api from '@/lib/adminApi';
import { Button, Card, ErrorBanner, TextInput } from './ui';

export function Login({
  configured,
  onSignedIn,
}: {
  /** False when the server has no ADMIN_PASSWORD, which is not fixable here. */
  configured: boolean;
  onSignedIn: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !password) return;

    setBusy(true);
    setError(null);
    const result = await api.login(password);
    setBusy(false);

    if (result.ok) {
      setPassword('');
      onSignedIn();
      return;
    }
    setError(result.error);
  };

  return (
    <main id="admin-main" className="grid min-h-dvh place-items-center px-5 py-16">
      <Card className="w-full max-w-[420px]">
        <p className="text-[11px] font-extrabold tracking-[0.22em] text-coral uppercase">
          Golden Steps
        </p>
        <h1 className="mt-2 font-display text-[28px]">Dashboard sign in</h1>
        <p className="mt-2 text-sm text-muted">
          This area manages the site content. Enter the admin password to continue.
        </p>

        {!configured ? (
          <div className="mt-6 rounded-[10px] border border-coral/45 bg-coral/8 px-4 py-4 text-sm">
            <p className="font-extrabold">Admin access is not configured.</p>
            <p className="mt-1.5 text-brand-900">
              Set <code className="font-bold">ADMIN_PASSWORD</code> in the server
              environment and restart it. Until then every write endpoint refuses
              requests, so nothing can be changed.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="admin-password" className="mb-1.5 block text-[13px] font-extrabold">
                Password
              </label>
              <TextInput
                id="admin-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                invalid={Boolean(error)}
                onChange={setPassword}
              />
            </div>

            <ErrorBanner error={error} />

            <Button type="submit" disabled={busy || !password} className="w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
