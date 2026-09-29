import { Eyebrow } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { ChapterBridge, ChapterMarker } from '@/components/ui/Chapter';
import { useCountUp } from '@/hooks/useCountUp';
import { useInView } from '@/hooks/useInView';
import type { ResolvedSiteContent } from '@/lib/content';

function Counter({ value, className }: { value: number; className?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.3 });
  const display = useCountUp(value, inView);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}

/**
 * Figures come from the resolved content rather than the static module, so an
 * admin edit to a programme's beneficiary count is reflected here immediately.
 * The headline total is summed from the same per-programme values the cards
 * show, which makes it impossible for the two to disagree.
 */
export function Impact({ content }: { content: ResolvedSiteContent }) {
  const { impact, totalBeneficiaries } = content;

  return (
    /*
     * Gold is the background here, so the section reads dark-on-light rather
     * than light-on-dark. White on `#d9a441` is 2.25:1 and the pale cream the
     * heading accent used was 1.91:1, both far under the 4.5:1 minimum — this
     * was the least legible section on the site. The brand's darkest green is
     * 7.15:1 on the same gold, and the lead paragraph below already used it,
     * so the whole section now shares one passing colour.
     */
    <section id="impact" className="scroll-mt-24 bg-gold px-0 py-20 text-brand-900 md:py-28">
      <div className="shell">
        <ChapterMarker id="impact" tone="gold" />
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:gap-16">
            <div>
              <Eyebrow
                className="text-brand-900"
                accentClassName="text-brand-900/85"
              >
                {impact.eyebrow}
              </Eyebrow>
              <h2 className="text-[clamp(2.25rem,4.6vw,3.75rem)]">
                {impact.title} <span className="text-brand-900">{impact.titleAccent}</span>
                <br />
                <span className="text-brand-900">{impact.titleAccentLine2}</span>
              </h2>
            </div>
            <p className="self-end text-brand-900">{impact.lead}</p>
          </div>
        </Reveal>

        <Reveal variant="fill" delay={80} duration={900}>
          {/* The rules between the figures stay light: they are decoration, and
              a dark hairline on gold reads as a gap in the panel rather than a
              division. */}
          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-white/35 bg-white/28 md:gap-px lg:grid-cols-[2fr_repeat(3,1fr)]">
            <div className="col-span-2 row-span-1 flex flex-col justify-center bg-gold p-6 lg:col-span-1 lg:row-span-2 lg:p-7">
              <span className="text-[10px] tracking-[0.12em] uppercase text-brand-900/85">
                {impact.totalLabel}
              </span>
              <strong className="my-6 block font-display text-[clamp(3rem,7vw,4.6rem)] leading-none">
                <Counter value={totalBeneficiaries} />
              </strong>
              <small className="text-[10px] tracking-[0.12em] uppercase text-brand-900/85">
                {impact.totalCaption}
              </small>
            </div>

            {impact.metrics.map((metric) => (
              <div key={metric.id} className="bg-gold p-6 lg:p-7">
                <strong className="block font-display text-[clamp(1.75rem,3.4vw,2.5rem)] leading-none">
                  <Counter value={metric.value} />
                </strong>
                <span className="mt-2 block text-[11px] tracking-[0.08em] uppercase text-brand-900/85">
                  {metric.label}
                </span>
              </div>
            ))}
          </div>
        </Reveal>

        <p className="mt-4 text-[11px] text-brand-900/80">
          Figures are the estimated direct beneficiaries stated in the project overview.
        </p>

        <ChapterBridge id="impact" tone="gold" />
      </div>
    </section>
  );
}
