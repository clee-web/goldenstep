import { useEffect, useRef, useState, type RefObject } from 'react';

import { usePrefersReducedMotion } from './useMediaQuery';

/** Past this the header condenses: shorter, hairline border, stronger blur. */
const CONDENSE_AT = 12;

/** Downward travel before the header steps out of the reader's way. */
const HIDE_AFTER = 200;

/**
 * Upward travel that brings it straight back. Deliberately tiny: a trackpad
 * tremor is a couple of pixels, and a threshold near that size would make the
 * header flicker in and out during an ordinary scroll.
 *
 * Note the asymmetry with `HIDE_AFTER`, which is the point. Hiding is expensive
 * to undo — the reader has to notice the bar is gone and find the gesture that
 * brings it back — so it waits for a long, deliberate run. Revealing is free —
 * the bar is where it is supposed to be — so it waits for almost nothing.
 */
const REVEAL_AFTER = 4;

export interface HeaderScrollState {
  /** Past the top of the page, so the header can tighten up. */
  condensed: boolean;
  /** Stepping aside for a reader who is moving down the page. */
  hidden: boolean;
  /**
   * Attach to the progress hairline's fill element. The factor is written
   * straight to a CSS custom property, which is what keeps the bar from
   * re-rendering the whole navigation on every frame of a scroll.
   */
  progressRef: RefObject<HTMLDivElement | null>;
}

/**
 * The header's scroll behaviour: condense, step aside, come back, and report
 * how far through the document the reader is.
 *
 * Three things keep it cheap. The listener is passive and every measurement is
 * coalesced into one animation frame, so a scroll never runs more than a single
 * read per frame. Both flags are compared against what is already in state
 * before `setState` is called, so a scroll that changes nothing renders nothing.
 * And the progress factor is written to a CSS custom property rather than into
 * state at all.
 */
export function useHeaderScroll(): HeaderScrollState {
  const [condensed, setCondensed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    let frame = 0;
    let lastY = window.scrollY;
    /** Net travel in the current direction: positive means heading down. */
    let travel = 0;
    let flags = { condensed: false, hidden: false };

    const commit = (next: { condensed: boolean; hidden: boolean }) => {
      if (next.condensed === flags.condensed && next.hidden === flags.hidden) return;
      flags = next;
      setCondensed(next.condensed);
      setHidden(next.hidden);
    };

    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;

      /*
       * The accumulator is direction-aware, and that is the entire fix for the
       * header never coming back. Accumulating *signed* distance was the bug:
       * after travelling 1200px down, scrolling back up 300px left the counter
       * at +900, which cleared neither threshold, so the header stayed hidden
       * and the only ways out were the top of the page and a `focusin`. An
       * upward delta now *replaces* the counter instead of adding to it, so one
       * gesture in either direction is enough to change the state, however far
       * the reader has already travelled the other way.
       *
       * Downward deltas still accumulate, which is what keeps a trackpad tremor
       * from hiding the bar: the reader has to travel 200px on a run to lose it.
       * The reveal is cheaper than that, and being cheap is what makes it
       * un-flickerable — after a reveal the counter is negative, so the next
       * hide still needs a full 200px of downward travel. The shortest possible
       * visible/hidden cycle is therefore a quarter of a screen of scrolling,
       * not two consecutive frames.
       */
      travel = delta < 0 ? delta : travel + delta;

      const fill = progressRef.current;
      if (fill) {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        fill.style.setProperty(
          '--gs-progress',
          String(scrollable > 0 ? Math.min(y / scrollable, 1) : 0),
        );
      }

      // Three rules, in order: reduced motion pins the header where it is, the
      // top of the page pins it too, and a real upward gesture releases it.
      // Zeroing the counter on the way out means the next downward run is
      // measured from a clean zero rather than from wherever the reader stopped.
      // An upward nudge too small to reach `REVEAL_AFTER` still shows the header,
      // because a negative counter can never clear `HIDE_AFTER`.
      const revealed = reduceMotion || y <= CONDENSE_AT || travel <= -REVEAL_AFTER;
      if (revealed) travel = 0;

      commit({ condensed: y > CONDENSE_AT, hidden: !revealed && travel > HIDE_AFTER });
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    // A reader who tabs into a hidden header has to be able to see where they
    // are, and the travel counter is cleared so the next small scroll does not
    // take it away again mid-navigation.
    const onFocusIn = () => {
      travel = 0;
      commit({ ...flags, hidden: false });
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('focusin', onFocusIn);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  return { condensed, hidden, progressRef };
}
