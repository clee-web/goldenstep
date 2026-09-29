import { about } from '@shared/content';
import { Eyebrow } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { ChapterBridge, ChapterMarker } from '@/components/ui/Chapter';

export function About() {
  return (
    <section id="about" className="scroll-mt-24 px-0 py-20 md:py-28">
      <div className="shell">
        <ChapterMarker id="about" />
      </div>

      <div className="shell grid gap-10 lg:grid-cols-2 lg:gap-24">
        <Reveal variant="left">
          <Eyebrow>{about.eyebrow}</Eyebrow>
          <h2 className="text-[clamp(2.25rem,4.6vw,3.75rem)]">
            {about.title}
            <br />
            <span className="text-brand-600">{about.titleAccent}</span>
          </h2>
        </Reveal>

        <Reveal variant="right" delay={120} className="max-w-[550px] text-muted">
          <p className="text-xl leading-relaxed text-ink">{about.lead}</p>
          {about.body.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="mt-4">
              {paragraph}
            </p>
          ))}
          <a
            href={about.cta.href}
              className="mt-5 inline-flex items-center gap-3 text-[13px] font-extrabold text-brand transition hover:gap-4"
          >
            {about.cta.label} <span aria-hidden="true">→</span>
          </a>
        </Reveal>
      </div>

      <div className="shell">
        <Reveal variant="fillX" delay={200} duration={900} className="mt-16 md:mt-20">
          <div className="grid gap-6 border-t border-line pt-7 md:grid-cols-[160px_1fr]">
            <p className="text-[10px] font-extrabold tracking-[0.15em] text-coral uppercase">
              {about.footprint.title}
            </p>
            <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 text-xs text-[#68746d]">
              <strong className="text-sm text-ink">{about.footprint.county}</strong>
              {/*
                The county is the claim; the ward list is the evidence, and it is
                from Kisumu East. Labelling the sub-county keeps the two from
                reading as a contradiction — the site works across the county,
                and the figures below are collected in these five wards.
              */}
              <span className="before:mr-[18px] before:text-[#c7cec8] before:content-['•']">
                <strong className="font-semibold text-ink">
                  {about.footprint.subCounty}
                </strong>
                <span className="ml-1.5 text-[11px] text-muted">(field data)</span>
              </span>
              {about.footprint.wards.map((ward) => (
                <span
                  key={ward}
                  className="before:mr-[18px] before:text-[#c7cec8] before:content-['•']"
                >
                  {ward}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <ChapterBridge id="about" />
      </div>
    </section>
  );
}
