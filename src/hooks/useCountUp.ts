import { useEffect, useState } from 'react';

import { usePrefersReducedMotion } from './useMediaQuery';

/**
 * Animates a number from 0 to `target` with an ease-out cubic, formatted with
 * locale separators. Honours prefers-reduced-motion by snapping to the final
 * value instead of animating.
 */
export function useCountUp(target: number, active: boolean, duration = 1100) {
  const reduceMotion = usePrefersReducedMotion();
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (!active || reduceMotion) return;

    let frame = 0;
    let start: number | null = null;

    const tick = (now: number) => {
      start ??= now;
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(Math.floor(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration, reduceMotion]);

  // Reduced motion must win over `active`: a reduced-motion reader should see the
  // real figure immediately rather than a zero that only fills in on scroll.
  const value = reduceMotion ? target : !active ? 0 : animated;
  return value.toLocaleString('en-US');
}
