import { useEffect, useRef, useState } from 'react';

/**
 * Fires once when the element scrolls into view. Used to drive reveal
 * animations and the impact counters without a scroll-position dependency.
 */
export function useInView<T extends HTMLElement>(
  options: IntersectionObserverInit & { once?: boolean } = {},
) {
  const { once = true, threshold = 0.3, rootMargin, root } = options;
  const ref = useRef<T>(null);
  // Assume "visible" up front where the observer API is unavailable, so the
  // effect body never has to synchronously set state.
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin, root },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [once, threshold, rootMargin, root]);

  return { ref, inView };
}
