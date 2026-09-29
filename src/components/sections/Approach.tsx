import { approach } from '@shared/content';
import { Eyebrow } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { ChapterBridge, ChapterMarker } from '@/components/ui/Chapter';

export function Approach() {
  return (
    <section id="approach" className="scroll-mt-24 px-0 py-20 md:py-28">
      <div className="shell">
        <ChapterMarker id="approach" />
      </div>

      <div className="shell grid items-center gap-10 lg:grid-cols-2 lg:gap-24">
        <Reveal variant="left" duration={860}>
          {/*
            The steps panel is a sibling of the clipped shape, not a child of it.
            `rounded-[45%_22px_45%_22px]` resolves its percentage against each axis,
            so on a 745x450 box the bottom-right corner is a 335x202px ellipse —
            and anything anchored in `bottom-6 right-6` falls entirely outside the
            painted shape. With `overflow-hidden` on the shape it was being
            clipped away, leaving the "Listen / Co-create / Act / Learn" list
            entirely invisible. Positioning it against an unclipped wrapper means
            no future radius or breakpoint can hide it again.
          */}
          <div className="relative">
            <div className="relative grid h-[360px] place-items-center overflow-hidden rounded-[45%_22px_45%_22px] bg-brand md:h-[450px]">
              <div
                aria-hidden="true"
                className="absolute h-[420px] w-[420px] rounded-full border border-white/20 max-md:h-[280px] max-md:w-[280px]"
              />
              <div
                aria-hidden="true"
                className="absolute h-[280px] w-[280px] rounded-full border border-white/20 max-md:h-[190px] max-md:w-[190px]"
              />
              <p className="text-center font-display text-[clamp(1.9rem,5vw,2.6rem)] leading-none text-white">
                {approach.visual.word}
                <br />
                {/*
                  `gold-soft` rather than gold. On the brand green gold measures
                  4.37:1, which is the weakest-contrast colour on the page sitting
                  on the single largest word of the visual. gold-soft is 5.61:1.
                */}
                <span className="text-gold-soft">{approach.visual.wordAccent}</span>
              </p>
            </div>

            <div className="absolute right-0 bottom-0 translate-y-1/2 rounded-[13px] bg-white px-4 py-3 text-[10px] leading-relaxed font-extrabold text-brand shadow-shell">
              {approach.visual.steps.map((step) => (
                <span key={step} className="block">
                  {step}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal variant="right" delay={120}>
          <Eyebrow>{approach.eyebrow}</Eyebrow>
          <h2 className="text-[clamp(2.25rem,4.6vw,3.75rem)]">
            {approach.title}{' '}
            <span className="text-brand-600">{approach.titleAccent}</span>
          </h2>
          <p className="mt-6 text-base text-muted">{approach.lead}</p>

          <div className="mt-7">
            {approach.principles.map((principle, index) => (
              <Reveal
                key={principle.number}
                variant="right"
                delay={200 + index * 110}
                className="grid grid-cols-[38px_1fr] gap-4 border-t border-line py-4"
              >
                <span className="text-[10px] font-extrabold text-coral">
                  {principle.number}
                </span>
                <div>
                  <h3 className="mb-1 text-sm font-bold">{principle.title}</h3>
                  <p className="m-0 text-xs text-muted">{principle.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>

      <div className="shell">
        <ChapterBridge id="approach" />
      </div>
    </section>
  );
}
