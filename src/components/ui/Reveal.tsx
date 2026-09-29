import { type CSSProperties, type ElementType, type ReactNode } from 'react';

import { useInView } from '@/hooks/useInView';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

export type RevealVariant =
  | 'up'
  | 'fill'
  | 'fillX'
  | 'scale'
  | 'left'
  | 'right'
  | 'soft';

interface Motion {
  from: CSSProperties;
  to: CSSProperties;
}

/**
 * Scroll-driven entrances. The previous implementation used a CSS `animation`,
 * which fires on mount — so every below-the-fold section animated the instant the
 * page loaded, which read as random movement rather than pacing. These are
 * transition-based and gated on intersection, so a section only moves once the
 * reader actually arrives at it.
 */
const VARIANTS: Record<RevealVariant, Motion> = {
  up: {
    from: { opacity: 0, transform: 'translateY(28px)' },
    to: { opacity: 1, transform: 'none' },
  },
  fill: {
    from: { opacity: 0, clipPath: 'inset(0 0 100% 0)', transform: 'translateY(10px)' },
    to: { opacity: 1, clipPath: 'inset(0 0 0% 0)', transform: 'none' },
  },
  fillX: {
    from: { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
    to: { opacity: 1, clipPath: 'inset(0 0% 0 0)' },
  },
  scale: {
    from: { opacity: 0, transform: 'scale(0.94)' },
    to: { opacity: 1, transform: 'none' },
  },
  left: {
    from: { opacity: 0, transform: 'translateX(-32px)' },
    to: { opacity: 1, transform: 'none' },
  },
  right: {
    from: { opacity: 0, transform: 'translateX(32px)' },
    to: { opacity: 1, transform: 'none' },
  },
  soft: {
    from: { opacity: 0, transform: 'translateY(14px)', filter: 'blur(6px)' },
    to: { opacity: 1, transform: 'none', filter: 'blur(0)' },
  },
};

export interface RevealProps {
  children: ReactNode;
  delay?: number;
  variant?: RevealVariant;
  duration?: number;
  className?: string;
  as?: ElementType;
  threshold?: number;
}

/**
 * Variants whose entrance is a clip-path wipe. These cannot be animated on the
 * observed element itself: Chrome applies an element's own `clip-path` to its
 * own IntersectionObserver rect, so a hidden `inset(0 0 100% 0)` keeps the
 * ratio at 0 forever, the observer never fires, and the content never appears.
 * For these the clip is moved to an inner layer and the observed element stays
 * unclipped.
 */
const CLIP_VARIANTS: ReadonlySet<RevealVariant> = new Set(['fill', 'fillX']);

export function Reveal({
  children,
  delay = 0,
  variant = 'up',
  duration = 720,
  className = '',
  as,
  threshold = 0.12,
}: RevealProps) {
  const reduceMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLElement>({
    threshold,
    rootMargin: '0px 0px -6% 0px',
  });

  const shown = inView || reduceMotion;
  const motion = VARIANTS[variant] ?? VARIANTS.up;
  const Tag = (as ?? 'div') as ElementType;

  const transition = reduceMotion
    ? 'none'
    : `opacity ${duration}ms cubic-bezier(.4,.05,.2,1), transform ${duration}ms cubic-bezier(.4,.05,.2,1), clip-path ${duration}ms cubic-bezier(.4,.05,.2,1), filter ${duration}ms cubic-bezier(.4,.05,.2,1)`;
  const transitionDelay = reduceMotion ? '0ms' : `${delay}ms`;
  const state = shown ? motion.to : motion.from;

  if (!CLIP_VARIANTS.has(variant)) {
    return (
      <Tag
        ref={ref}
        className={className}
        style={{ ...state, transition, transitionDelay }}
      >
        {children}
      </Tag>
    );
  }

  return (
    <Tag ref={ref} className={className} style={{ transitionDelay }}>
      <div className="h-full w-full" style={{ ...state, transition, transitionDelay }}>
        {children}
      </div>
    </Tag>
  );
}

/**
 * Reveals direct children one after another. Used for card grids so a row
 * cascades instead of appearing as one block.
 */
export function Stagger({
  children,
  step = 90,
  variant = 'up',
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode[];
  step?: number;
  variant?: RevealVariant;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Tag className={className}>
      {children.map((child, index) => (
        <Reveal key={index} variant={variant} delay={index * step}>
          {child}
        </Reveal>
      ))}
    </Tag>
  );
}
