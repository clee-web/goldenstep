import { useEffect, useState } from 'react';

import {
  emptyManagedContent,
  type ContentResponse,
  type ManagedContent,
} from '@shared/schemas';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Static-first content loading.
 *
 * The site ships with every word and picture baked into the bundle, so it
 * renders completely with no server. `/api/content` is then a thin overlay of
 * admin edits. If that request fails for any reason, the reader still gets the
 * full static site — a broken dashboard must never be able to blank out the
 * public pages.
 *
 * The result starts as `undefined` rather than an empty object so callers can
 * tell "not loaded yet" from "loaded and genuinely empty", which matters
 * because an empty managed list means "no overrides" and should leave the
 * static defaults in place.
 */
export interface ManagedContentState {
  content: ManagedContent;
  /** False until the overlay request settles, one way or the other. */
  ready: boolean;
  /** True when the overlay could not be loaded and static content is in use. */
  offline: boolean;
}

export function useManagedContent(): ManagedContentState {
  const [state, setState] = useState<ManagedContentState>({
    content: emptyManagedContent(),
    ready: false,
    offline: false,
  });

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/content`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`content request failed: ${response.status}`);

        const body = (await response.json()) as ContentResponse;
        if (body.ok !== true || !body.content) throw new Error('malformed content response');

        setState({ content: body.content, ready: true, offline: false });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        // Deliberately falls back to the static defaults rather than surfacing
        // an error: the site is complete without this response.
        setState({ content: emptyManagedContent(), ready: true, offline: true });
      }
    })();

    return () => controller.abort();
  }, []);

  return state;
}
