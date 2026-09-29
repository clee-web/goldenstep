import { useCallback, useSyncExternalStore } from 'react';

const subscribe = (query: string) => (onStoreChange: () => void) => {
  const list = window.matchMedia(query);
  list.addEventListener('change', onStoreChange);
  return () => list.removeEventListener('change', onStoreChange);
};

/** Tracks a CSS media query reactively, without setState-in-effect churn. */
export function useMediaQuery(query: string) {
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(
    subscribe(query),
    getSnapshot,
    () => false,
  );
}

/** True when the visitor has asked the OS to reduce motion. */
export const usePrefersReducedMotion = () =>
  useMediaQuery('(prefers-reduced-motion: reduce)');
