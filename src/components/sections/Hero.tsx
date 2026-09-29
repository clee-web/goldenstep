import { useCallback, useEffect, useRef, useState } from 'react';

import { hero } from '@shared/content';
import { ButtonLink } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import type { ResolvedSiteContent } from '@/lib/content';

// Decorative initials, but still legible: the two mid-tone swatches were
// darkened (same hues) so the white 9px initials clear 4.5:1 against them.
const trustAvatars = [
  { letter: 'W', className: 'bg-[#8f6420]' },
  { letter: 'Y', className: 'bg-[#4b7d69]' },
  { letter: 'C', className: 'bg-[#a8492f]' },
];

/** Slow enough to read, and slower than the gallery. */
const ROTATE_MS = 4500;
/** Text carousel rotates at a different pace for readability */
const TEXT_ROTATE_MS = 6000;

interface HeroTextCarouselProps {
  content: ResolvedSiteContent;
}

function HeroTextCarousel({ content }: HeroTextCarouselProps) {
  const { projects, activities } = content;
  
  // Combine projects and activities for the text carousel
  const textMessages = [
    {
      text: "Every step toward empowerment matters. Golden Steps works with women, youth and communities to live free from violence and inequality — building safer, healthier and more empowered communities.",
      source: "Our Mission"
    },
    ...projects.slice(0, 3).map(project => ({
      text: project.summary,
      source: `${project.programmeName} · ${project.title}`
    })),
    ...activities.slice(0, 2).map(activity => ({
      text: activity.description,
      source: `${activity.kind} · ${activity.title}`
    }))
  ];

  const total = textMessages.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  const go = useCallback(
    (next: number) => setIndex(((next % total) + total) % total),
    [total],
  );

  useEffect(() => {
    if (reduceMotion || paused || total < 2) return;

    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % total);
    }, TEXT_ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [paused, reduceMotion, total]);

  if (total === 0) return null;

  return (
    <div 
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative overflow-hidden">
        {textMessages.map((message, messageIndex) => {
          const isActive = messageIndex === index;
          return (
            <div
              key={messageIndex}
              className={`transition-all duration-700 ease-out ${
                isActive 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4 absolute inset-0'
              }`}
            >
              <p className="text-[17px] leading-relaxed text-[#526058] md:text-lg">
                {message.text}
              </p>
              <p className="mt-3 text-xs font-extrabold tracking-[0.12em] uppercase text-muted">
                {message.source}
              </p>
            </div>
          );
        })}
      </div>

      {total > 1 ? (
        <div
          role="tablist"
          aria-label="Choose a message"
          className="mt-4 flex gap-2"
        >
          {textMessages.map((_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              role="tab"
              aria-label={`Message ${dotIndex + 1} of ${total}`}
              aria-selected={dotIndex === index}
              onClick={() => go(dotIndex)}
              className={`h-[9px] rounded-full transition-all duration-200 ${
                dotIndex === index
                  ? 'w-7 bg-brand'
                  : 'w-[9px] bg-[#75827a] hover:bg-[#5d6a62]'
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Hero({ content }: { content: ResolvedSiteContent }) {
  const [rawBefore, rawAfter] = hero.title.split(hero.titleAccent);
  const before = rawBefore ?? hero.title;
  const after = rawAfter ?? '';

  const images = hero.images;
  const total = images.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  const go = useCallback(
    (next: number) => setIndex(((next % total) + total) % total),
    [total],
  );

  // Rotation pauses on hover, on focus, when the tab is hidden, and when the
  // hero has scrolled away. A timer that keeps running behind a section the
  // reader is not looking at is how a page ends up three slides ahead by the
  // time they scroll back up.
  useEffect(() => {
    if (reduceMotion || paused || total < 2) return;

    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % total);
    }, ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [paused, reduceMotion, total]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const observer = new IntersectionObserver(
      ([entry]) => setPaused(!entry.isIntersecting),
      { threshold: 0.25 },
    );

    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative overflow-hidden bg-cream">
      <div
        aria-hidden="true"
        className="absolute top-[-160px] right-[25%] h-[300px] w-[300px] rounded-full bg-gold-soft opacity-40 blur-[1px]"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[50px] left-[-70px] h-[180px] w-[180px] rounded-full bg-[#9ac4ad] opacity-40 blur-[1px]"
      />

      <div className="shell relative grid items-center gap-10 py-16 md:min-h-[690px] md:grid-cols-[1.02fr_0.98fr] md:py-0">
        <Reveal>
          <Eyebrow>{hero.eyebrow}</Eyebrow>
          <h1 className="max-w-[760px] text-[clamp(2.9rem,6vw,5.1rem)]">
            {`${before.trim()} `}
            {rawAfter === undefined ? null : (
              <span className="text-brand-600">{hero.titleAccent}</span>
            )}
            {` ${after.trim()}`}
          </h1>
          <HeroTextCarousel content={content} />

          {/*
            One filled button, one text link. Two equal-weight buttons split the
            eye and make the ask ambiguous, which defeats the point of having a
            primary CTA at all — the secondary path is still offered, it is just
            no longer dressed as a competing action.
          */}
          <div className="my-7 flex flex-wrap items-center gap-x-7 gap-y-3">
            <ButtonLink href={hero.primaryCta.href}>
              {hero.primaryCta.label} <span aria-hidden="true">↗</span>
            </ButtonLink>
            <a
              href={hero.secondaryCta.href}
              className="group inline-flex items-center gap-2.5 text-[13px] font-extrabold text-brand transition hover:gap-3.5"
            >
              {hero.secondaryCta.label}
              <span
                aria-hidden="true"
                className="text-muted transition group-hover:text-brand"
              >
                →
              </span>
            </a>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex">
              {trustAvatars.map((avatar) => (
                <span
                  key={avatar.letter}
                  aria-hidden="true"
                  className={`-mr-[7px] grid h-7 w-7 place-items-center rounded-full border-2 border-cream text-[9px] font-bold text-white ${avatar.className}`}
                >
                  {avatar.letter}
                </span>
              ))}
            </span>
            <span>{hero.trust}</span>
          </div>
        </Reveal>

        <Reveal
          variant="scale"
          duration={900}
          className="relative h-[350px] md:h-[540px]"
        >
          {/*
            The shape and the crop live on one wrapper rather than on each
            image. Every photograph is then absolutely stacked inside the same
            masked frame, so the crossfade cannot drift the crop, the radius or
            the shadow between slides — which is what happens the moment the
            shape is a property of the picture instead of the frame.
          */}
          <div
            ref={frameRef}
            role="region"
            aria-roledescription="carousel"
            aria-label="Golden Steps in the community"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="absolute inset-[10px_15px_10px_20px] overflow-hidden rounded-[42%_42%_18px_42%] shadow-shell md:inset-[35px_0_25px_55px]"
          >
            {images.map((image, imageIndex) => {
              const isActive = imageIndex === index;

              return (
                <img
                  key={image.src}
                  src={image.src}
                  /*
                    Only the visible photograph carries alt text. All seven are
                    in the DOM at once, so describing the hidden ones would have
                    a screen reader announce every still in the stack.
                  */
                  alt={isActive ? image.alt : ''}
                  aria-hidden={isActive ? undefined : true}
                  width={1200}
                  height={1400}
                  /* The first frame is the LCP image, so it keeps the priority
                     hint; the rest must not compete for bandwidth with it. */
                  fetchPriority={imageIndex === 0 ? 'high' : 'low'}
                  loading={imageIndex < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover object-[center_22%] transition-opacity duration-1000 ease-out motion-reduce:transition-none ${
                    isActive ? 'z-10 opacity-100' : 'z-0 opacity-0'
                  }`}
                />
              );
            })}
          </div>

          {total > 1 ? (
            <div
              role="tablist"
              aria-label="Choose a photograph"
              className="absolute inset-x-0 bottom-0 z-20 flex justify-center gap-2 pb-0.5"
            >
              {images.map((image, dotIndex) => (
                <button
                  key={image.src}
                  type="button"
                  role="tab"
                  aria-label={`${image.tag}: photograph ${dotIndex + 1} of ${total}`}
                  aria-selected={dotIndex === index}
                  onClick={() => go(dotIndex)}
                  className={`h-[9px] rounded-full transition-all duration-200 ${
                    dotIndex === index
                      ? 'w-7 bg-brand'
                      : // An inactive dot is a control, so 1.4.11 applies to its
                        // edge rather than only to its fill. The old grey
                        // measured 1.63:1 on cream; this is 3.66:1.
                        'w-[9px] bg-[#75827a] hover:bg-[#5d6a62]'
                  }`}
                />
              ))}
            </div>
          ) : null}

          <div className="absolute bottom-3 left-0 z-20 flex max-w-[260px] items-center gap-3 rounded-[18px] bg-white px-4 py-3.5 shadow-shell md:bottom-[45px]">
            <span
              aria-hidden="true"
              className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-[#edf3eb] text-lg text-brand"
            >
              ✦
            </span>
            <div>
              <strong className="block text-xs">{hero.visionCard.title}</strong>
              <small className="text-[10px] text-muted">{hero.visionCard.subtitle}</small>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="absolute top-0 right-0 z-20 grid h-[90px] w-[90px] rotate-6 place-items-center rounded-full bg-gold text-center text-brand-900 shadow-[0_12px_30px_rgba(0,0,0,.12)] md:top-[18px] md:right-[-8px] md:h-[116px] md:w-[116px]"
          >
            <span className="text-[9px] tracking-[0.12em] uppercase">Est.</span>
            <strong className="font-display text-xl md:text-[27px]">2023</strong>
            <small className="text-[9px] tracking-[0.12em] uppercase">Golden Steps</small>
          </div>
        </Reveal>
      </div>

      <div
        aria-hidden="true"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-[9px] tracking-[0.18em] text-muted md:block"
      >
        Scroll <span className="ml-2 text-[15px]">↓</span>
      </div>
    </section>
  );
}
