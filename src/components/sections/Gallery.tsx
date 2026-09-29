import { useCallback, useEffect, useRef, useState } from 'react';

import { gallery } from '@shared/content';
import { Person } from '@/components/sections/Person';
import { SectionHeading } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { ChapterBridge, ChapterMarker } from '@/components/ui/Chapter';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import type { GallerySlide } from '@/lib/content';

const AUTOPLAY_MS = 5500;
const SWIPE_THRESHOLD = 45;
const pad = (value: number) => String(value).padStart(2, '0');

/** The upload route only accepts these two, so the mapping is exhaustive. */
const videoMimeOf = (src: string): string =>
  /\.webm$/i.test(src.split(/[?#]/)[0]) ? 'video/webm' : 'video/mp4';

/**
 * The six programme photographs are always present; admin uploads are appended.
 * The deck therefore only grows, so the narrative defaults can never be lost to
 * a mistake in the dashboard.
 */
export function Gallery({ slides }: { slides: GallerySlide[] }) {
  const total = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<number | null>(null);
  const reduceMotion = usePrefersReducedMotion();

  /*
   * Every slide stays mounted — the deck translates, it does not unmount — so a
   * video keeps playing after the reader has navigated away from it. Pausing on
   * slide change is enough; no `playing` flag is needed, because the autoplay
   * timer is already suspended whenever the active slide is a video.
   */
  const activeIsVideo = slides[index]?.kind === 'video';

  useEffect(() => {
    const videos = viewportRef.current?.querySelectorAll('video');
    videos?.forEach((video) => {
      if (!video.paused) video.pause();
    });
  }, [index]);

  const go = useCallback(
    (next: number) => setIndex(((next % total) + total) % total),
    [total],
  );

  // Autoplay pauses on hover, focus, tab-hidden and off-screen.
  useEffect(() => {
    if (reduceMotion || paused || total < 2) return;
    // Never advance away from a video: the deck would cut playback off mid-sentence.
    if (activeIsVideo) return;

    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % total);
    }, AUTOPLAY_MS);

    return () => window.clearInterval(timer);
  }, [paused, reduceMotion, total, activeIsVideo]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new IntersectionObserver(
      ([entry]) => setPaused(!entry.isIntersecting),
      { threshold: 0.25 },
    );

    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + 1);
    }
  };

  const onPointerDown = (event: React.PointerEvent) => {
    pointerStart.current = event.clientX;
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (start === null) return;

    const delta = event.clientX - start;
    if (Math.abs(delta) > SWIPE_THRESHOLD) go(index + (delta < 0 ? 1 : -1));
  };

  return (
    <section id="stories" className="scroll-mt-24 px-0 py-20 md:py-28">
      <div className="shell">
        <ChapterMarker id="stories" />
        {/*
          The person block leads the chapter rather than sitting below the
          heading: this chapter is the one that has to make the reader care about
          a specific human before the next chapter counts them. It renders
          nothing until `person` is populated.
        */}
        <Person />
        <Reveal>
          <SectionHeading
            eyebrow={gallery.eyebrow}
            title={gallery.title}
            accent={gallery.titleAccent}
            lead={gallery.lead}
          />
        </Reveal>
      </div>

      <div className="shell mt-9">
        <Reveal variant="fill" duration={980}>
        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div
            ref={viewportRef}
            role="region"
            aria-roledescription="carousel"
            aria-label="Golden Steps photographs and videos from the field"
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              pointerStart.current = null;
            }}
            aria-describedby="carousel-hint"
            className="relative touch-pan-y overflow-hidden rounded-shell focus-visible:shadow-[0_0_0_3px_rgba(22,76,61,.35)]"
          >
            <ul
              className="flex list-none p-0 transition-transform duration-500 [transition-timing-function:cubic-bezier(.4,.05,.2,1)] motion-reduce:transition-none"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {slides.map((slide, slideIndex) => (
                <li
                  key={slide.id}
                  aria-hidden={slideIndex !== index}
                  className="relative min-w-0 flex-[0_0_100%]"
                >
                  {/* `role="group"` lives on this inner element, not the `li`:
                      a list may only contain `li` children, so putting the role
                      on the `li` itself fails the WCAG 2.1.1 list structure. */}
                  <div
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${slideIndex + 1} of ${total}`}
                    className="relative"
                  >
                    {slide.kind === 'video' ? (
                      /*
                        A native player, not an autoplaying background video.
                        Field footage of survivors and children must never start
                        moving on its own, and the deck's own autoplay is paused
                        while a video slide is active — see `activeIsVideo`.
                      */
                      <video
                        className="block h-[400px] w-full bg-cream object-cover sm:h-[440px] lg:h-[clamp(300px,48vw,540px)]"
                        controls
                        preload="none"
                        playsInline
                        poster={slide.poster || undefined}
                        aria-label={slide.alt}
                      >
                        <source src={slide.image} type={videoMimeOf(slide.image)} />
                        {/*
                          Required by the schema for video entries (WCAG 1.2.2),
                          so this is never an empty `src`. `default` is set because
                          the track is the only one; without it Safari will not
                          turn captions on even when the visitor asks for them.
                        */}
                        {slide.captionsSrc ? (
                          <track
                            kind="captions"
                            src={slide.captionsSrc}
                            srcLang="en"
                            label="English"
                            default
                          />
                        ) : null}
                        Your browser cannot play this video.
                      </video>
                    ) : (
                      <img
                        src={slide.image}
                        alt={slide.alt}
                        loading={slideIndex === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        width={1200}
                        height={800}
                        className="block h-[400px] w-full bg-cream object-cover sm:h-[440px] lg:h-[clamp(300px,48vw,540px)]"
                      />
                    )}
                    {/*
                      The gradient flips for video slides. A native player's
                      control bar is drawn along the bottom edge of the element,
                      so the usual bottom caption would sit on top of the play
                      button, the scrubber and the fullscreen control — the
                      controls are unclickable under an absolutely-positioned
                      overlay even though they still paint. Moving the caption to
                      the top for videos leaves the controls clear.
                    */}
                    <div
                      className={`absolute inset-x-0 px-5 py-5 text-white md:px-8 md:py-8 ${
                        slide.kind === 'video'
                          ? 'top-0 bg-[linear-gradient(to_bottom,rgba(16,37,31,.9),rgba(16,37,31,.5)_48%,rgba(16,37,31,0))]'
                          : 'bottom-0 bg-[linear-gradient(to_top,rgba(16,37,31,.9),rgba(16,37,31,.5)_48%,rgba(16,37,31,0))]'
                      }`}
                    >
                      <span className="mb-3 inline-block rounded-full bg-gold px-3 py-1.5 text-[9px] font-extrabold tracking-[0.14em] text-brand-900 uppercase">
                        {slide.tag}
                      </span>
                      <p className="m-0 max-w-[740px] font-display text-[16px] leading-[1.22] sm:text-[19px] lg:text-[clamp(19px,2.4vw,30px)]">
                        {slide.caption}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous slide"
              className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full border border-[#c9d1ca] bg-white text-brand transition hover:border-brand hover:bg-brand hover:text-white"
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next slide"
              className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full border border-[#c9d1ca] bg-white text-brand transition hover:border-brand hover:bg-brand hover:text-white"
            >
              <span aria-hidden="true">→</span>
            </button>

            <div
              role="tablist"
              aria-label="Choose slide"
              className="mx-1.5 flex flex-1 items-center gap-2"
            >
              {slides.map((slide, dotIndex) => (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-label={`Go to slide ${dotIndex + 1}`}
                  aria-selected={dotIndex === index}
                  onClick={() => go(dotIndex)}
                  className={`h-[9px] rounded-full transition-all duration-200 ${
                    dotIndex === index
                      ? 'w-8 bg-brand'
                      : 'w-[9px] bg-[#cfd7d1] hover:bg-[#a9b6ae]'
                  }`}
                />
              ))}
            </div>

            <span
              aria-hidden="true"
              className="text-[11px] font-extrabold tracking-[0.12em] text-muted tabular-nums"
            >
              {pad(index + 1)} / {pad(total)}
            </span>
          </div>

          <p id="carousel-hint" className="sr-only" aria-live="polite">
            Use the left and right arrow keys, or swipe, to browse photographs and
            videos. Video slides play only when you press play.
          </p>
        </div>
        </Reveal>
      </div>

      <div className="shell mt-14 grid gap-8 rounded-shell bg-cream p-7 md:grid-cols-[0.8fr_1.2fr] md:items-center md:p-10">
        <Reveal variant="fill" duration={860}>
          <img
            src={gallery.whyWorkWithUs.image}
            alt={gallery.whyWorkWithUs.alt}
            loading="lazy"
            decoding="async"
            width={520}
            height={520}
            className="h-44 w-full rounded-[18px] object-cover md:h-full md:max-h-[300px]"
          />
        </Reveal>
        <Reveal variant="right" delay={110}>
          <p className="eyebrow mb-3">Why work with us</p>
          <h3 className="font-display text-[clamp(1.5rem,2.6vw,2rem)]">
            Empowered individuals plus strengthened communities.
          </h3>
          <p className="mt-3 max-w-[60ch] text-sm text-muted">
            Every programme is designed with the people it serves, so gains outlast the
            project cycle. Partnering with Golden Steps means investing in local
            leadership, accountable delivery and outcomes we can show you.
          </p>
          <a
            href="#contact"
            className="mt-5 inline-flex items-center gap-3 text-[13px] font-extrabold text-brand transition hover:gap-4"
          >
            Start a conversation <span aria-hidden="true">→</span>
          </a>
        </Reveal>
      </div>

      <div className="shell">
        <ChapterBridge id="stories" />
      </div>
    </section>
  );
}
