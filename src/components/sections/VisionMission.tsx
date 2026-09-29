import { vision } from '@shared/content';
import { Eyebrow } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { ChapterBridge, ChapterMarker } from '@/components/ui/Chapter';

export function VisionMission() {
  return (
    <section
      id="vision"
      className="scroll-mt-24 bg-cream px-0 py-20 text-center md:py-28"
    >
      <div className="shell">
        <ChapterMarker id="vision" />
      </div>

      <Reveal variant="soft" duration={900} className="mx-auto max-w-[900px]">
        <Eyebrow className="flex justify-center">{vision.eyebrow}</Eyebrow>
        <blockquote className="my-6 font-display text-[clamp(1.6rem,3.6vw,3rem)] leading-[1.2] text-balance">
          {vision.quote}
        </blockquote>
      </Reveal>

      {/*
        The mission sits directly under the vision, at a size and weight that
        makes the reading order obvious without needing a divider: the quote
        stays the largest thing on the page, and the mission reads as the
        sentence that follows it. Centred and capped so it holds the same
        measure as the quote instead of running the full shell width.
      */}
      <Reveal variant="soft" delay={120} duration={900} className="mx-auto mt-10 max-w-[720px]">
        <span className="text-[10px] font-extrabold tracking-[0.16em] text-coral uppercase">
          {vision.mission.label}
        </span>
        <p className="mt-3 text-[15px] leading-relaxed text-muted text-pretty md:text-base">
          {vision.mission.body}
        </p>
      </Reveal>

      {/* One card now, centred. A lone card left in a two-column grid reads as
          something that failed to render. */}
      <div className="mt-12 text-left">
        <Reveal
          variant="fill"
          delay={200}
          className="mx-auto max-w-[560px] rounded-[18px] bg-white p-7 md:p-8"
        >
          <span className="text-[10px] font-extrabold tracking-[0.14em] text-coral uppercase">
            {vision.values.label}
          </span>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {vision.values.items.map((value, index) => (
              <span key={value}>
                {value}
                {index < vision.values.items.length - 1 ? (
                  <b aria-hidden="true" className="ml-2 text-gold">
                    •
                  </b>
                ) : null}
              </span>
            ))}
          </p>
        </Reveal>
      </div>

      <div className="shell">
        <ChapterBridge id="vision" />
      </div>
    </section>
  );
}
