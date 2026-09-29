import { partners } from '@shared/content';
import { ButtonLink } from '@/components/ui/Button';
import { SectionHeading } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { ChapterBridge, ChapterMarker } from '@/components/ui/Chapter';

export function Partners() {
  return (
    <section id="partners" className="scroll-mt-24 bg-white px-0 py-20 md:py-28">
      <div className="shell">
        <ChapterMarker id="partners" />
        <Reveal>
          <SectionHeading
            eyebrow={partners.eyebrow}
            title={partners.title}
            accent={partners.titleAccent}
            lead={partners.lead}
          />
        </Reveal>

        {/*
          The divider rules are positional, and the item count is content, not
          layout — so they are written in terms of the *end* of the list rather
          than its start. `nth-last-child(-n+2)` suppresses the horizontal rule
          under the final two-cell row at every count; the previous
          `nth-child(-n+2)` only happened to be correct while there were exactly
          four partners, and drew a stray rule under the first row once there
          were ten.
        */}
        <ul className="my-12 grid grid-cols-2 border-y border-line py-5 lg:grid-cols-4">
          {partners.types.map((type, index) => (
            <Reveal
              as="li"
              key={type.name}
              variant="fill"
              delay={80 + index * 90}
              duration={700}
              className="border-line p-6 text-center text-sm font-extrabold text-[#56645d] even:border-r-0 lg:even:border-r lg:last:border-r-0 max-lg:[&:nth-child(2n)]:border-r-0 max-lg:[&:nth-last-child(-n+2)]:border-b-0"
            >
              {type.name}
              {type.sub ? (
                <small className="block text-[8px] tracking-[0.15em] uppercase">
                  {type.sub}
                </small>
              ) : null}
            </Reveal>
          ))}
        </ul>

        <Reveal variant="scale" delay={200} duration={820}>
          <div className="flex flex-col gap-7 rounded-[25px] bg-brand p-7 text-white md:flex-row md:items-center md:justify-between md:p-11">
            <div>
              {/* `gold-soft`, not `gold`: this is standing text rather than a
                  hover state, and on `bg-brand` plain gold measures 4.37:1,
                  just under the 4.5:1 AA minimum at this 11px size. `gold-soft`
                  reaches 5.61:1 on the same green. Same reason the TopBar link
                  uses it. */}
              <p className="eyebrow mb-3 text-gold-soft">{partners.cta.eyebrow}</p>
              <h3 className="m-0 max-w-[650px] font-display text-[clamp(1.35rem,2.6vw,1.75rem)]">
                {partners.cta.title}
              </h3>
            </div>
            <ButtonLink href={partners.cta.href} variant="onDark" className="shrink-0">
              {partners.cta.label} <span aria-hidden="true">→</span>
            </ButtonLink>
          </div>
        </Reveal>

        <ChapterBridge id="partners" />
      </div>
    </section>
  );
}
