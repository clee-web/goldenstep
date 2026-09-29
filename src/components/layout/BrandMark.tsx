import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { organisation } from '@shared/content';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

/** The three ascending treads, drawn one after another. */
const STEP_PATHS = ['M2 19V15h6', 'M8 15v-4.5h6', 'M14 10.5V6h6'] as const;

/**
 * The brand's signature: the organisation's name, as motion. Three gold steps
 * draw themselves in on the first frame after mount and again whenever the
 * lockup is hovered or focused, then sit quietly at rest.
 *
 * The draw is a transition rather than a keyframe animation, and that is what
 * makes the replay possible. The retracted state carries a zero-length
 * transition so the line snaps back instantly; the drawn state carries the slow
 * one. Both change in the same frame, and a transition always reads the *new*
 * transition, so a replay is a snap back followed by a draw — with no animation
 * to cancel and no timer to clean up.
 */
function StepsMotif({ drawn }: { drawn: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      focusable="false"
      data-drawn={drawn}
      className="steps-motif shrink-0 text-gold transition-transform duration-[300ms] ease-settle group-hover/brand:-translate-y-[1.5px]"
    >
      {STEP_PATHS.map((d, index) => (
        <path
          key={d}
          d={d}
          /*
           * `pathLength` normalises every tread to 1, so all three share the same
           * unitless dash values no matter how long their real geometry is.
           */
          pathLength={1}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={1}
          style={{ '--step-delay': `${index * 110}ms` } as CSSProperties}
        />
      ))}
    </svg>
  );
}

/**
 * The logo lockup: the organisation's real mark, its name, and its tagline.
 *
 * `logo.png` is the authoritative brand asset, so it is never redrawn or
 * replaced — it is framed instead. A hairline border warms to gold on hover, and
 * the whole lockup settles back a little once the reader leaves the top of the
 * page. The settle is a transform rather than a font-size change: it is
 * compositor-only, so condensing the header costs one composited frame and
 * reflows nothing.
 */
export function BrandMark({ condensed = false }: { condensed?: boolean }) {
  const reduceMotion = usePrefersReducedMotion();
  // A visitor who asked for less motion gets the finished mark: drawn and still.
  const [drawn, setDrawn] = useState(() => reduceMotion);
  const frames = useRef<number[]>([]);

  useEffect(() => {
    if (reduceMotion) return;
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion]);

  useEffect(
    () => () => {
      for (const id of frames.current) cancelAnimationFrame(id);
    },
    [],
  );

  const redraw = () => {
    if (reduceMotion) return;
    for (const id of frames.current) cancelAnimationFrame(id);
    frames.current = [
      // Two frames on purpose: the first commits the retracted state, the second
      // commits the redraw. A single frame would collapse both into one style
      // recalculation and the transition would never start.
      requestAnimationFrame(() => {
        setDrawn(false);
        frames.current.push(
          requestAnimationFrame(() => {
            setDrawn(true);
            frames.current = [];
          }),
        );
      }),
    ];
  };

  return (
    <a
      href="#home"
      onPointerEnter={redraw}
      onFocus={redraw}
      aria-label={`${organisation.name} — home`}
      className="group/brand rounded-2xl outline-offset-4"
    >
      <span
        className="flex origin-left items-center gap-3 transition-transform duration-[320ms] ease-settle"
        style={{ transform: condensed ? 'scale(0.9)' : 'none' }}
      >
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-line transition-[border-color,box-shadow] duration-[320ms] ease-settle group-hover/brand:border-gold/70 group-hover/brand:shadow-mark">
          <img
            src="/assets/logo.jpeg"
            alt="logo for the organisation"
            width={55}
            height={55}
            className="h-full w-full rounded-[13px] object-cover"
          />
        </span>

        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="font-display text-[19px] leading-none font-semibold tracking-[-0.02em] whitespace-nowrap text-ink">
              {organisation.name}
            </span>
            <StepsMotif drawn={drawn} />
          </span>

          {/* 10px is the floor here, not a style choice: at 360px the tagline is
              the widest element in the lockup, and the navigation still has to
              fit beside it. Above 640px there is room to breathe. */}
          <span
            className={`mt-[5px] block text-[10px] font-semibold tracking-[0.15em] whitespace-nowrap text-muted uppercase transition-opacity duration-[320ms] ease-settle sm:text-[11px] ${
              condensed ? 'opacity-55' : 'opacity-100'
            }`}
          >
            {organisation.tagline}
          </span>
        </span>
      </span>
    </a>
  );
}
