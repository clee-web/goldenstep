import { useEffect, useRef, useState } from 'react';

import { programmesIntro, type ProgrammeId } from '@shared/content';
import { SectionHeading } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { ChapterBridge, ChapterMarker } from '@/components/ui/Chapter';
import type { Programme } from '@shared/content';
import { ProgrammeDetail } from './ProgrammeDetail';

export function Programs({ programmes }: { programmes: Programme[] }) {
  const [activeId, setActiveId] = useState<ProgrammeId | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const select = (id: ProgrammeId, shouldScroll: boolean) => {
    setActiveId(id);
    if (!shouldScroll) return;
    // Wait for the detail panel to render before scrolling to it.
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  // Escape closes the open programme, matching the disclosure pattern.
  useEffect(() => {
    if (!activeId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId]);

  return (
    <section id="programs" className="scroll-mt-24 bg-[#eef2ed] px-0 py-20 md:py-28">
      <div className="shell">
        <ChapterMarker id="programs" />
        <Reveal>
          <SectionHeading
            eyebrow={programmesIntro.eyebrow}
            title={programmesIntro.title}
            accent={programmesIntro.titleAccent}
            lead={programmesIntro.lead}
          />
        </Reveal>

        <ul className="mt-12 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {programmes.map((programme, index) => {
            const isFeatured = programme.id === 'gender';
            const isOpen = activeId === programme.id;

            return (
              <Reveal
                as="li"
                key={programme.id}
                variant="fill"
                delay={index * 80}
                duration={780}
                className="h-full"
              >
                <article
                  className={`relative flex h-full min-h-[365px] flex-col rounded-[22px] border p-7 transition duration-200 hover:-translate-y-1.5 hover:shadow-shell ${
                    isFeatured
                      ? 'border-brand bg-brand text-white'
                      : 'border-[#e0e6e0] bg-white'
                  }`}
                >
                  {/*
                    The card number is decorative and `aria-hidden`, but it is
                    still visible text, so 1.4.3 applies to it like anything else:
                    the old greys measured 3.83:1 on the green card and 2.39:1 on
                    white. gold-soft is 5.61:1 on brand, and the muted ink is
                    5.21:1 on white — both comfortably over the 4.5:1 that 10px
                    copy needs.
                  */}
                  <span
                    aria-hidden="true"
                    className={`absolute top-6 right-7 text-[10px] ${
                      isFeatured ? 'text-gold-soft' : 'text-[#68746d]'
                    }`}
                  >
                    {programme.number}
                  </span>

                  {/*
                    The card is `bg-brand` when featured and `bg-white`
                    otherwise, so one colour cannot serve both: this glyph sat
                    at 2.21:1 on the white cards, under even the 3:1 that
                    decorative graphics need. `brand-600` clears AA on white and
                    `gold-soft` clears it on the green.
                  */}
                  <span
                    aria-hidden="true"
                    className={`mb-7 text-[27px] ${
                      isFeatured ? 'text-gold-soft' : 'text-brand-600'
                    }`}
                  >
                    {programme.icon}
                  </span>

                  <h3 className="font-display text-[25px]">{programme.name}</h3>
                  <p
                    className={`text-[13px] ${isFeatured ? 'text-[#d4e1dc]' : 'text-muted'}`}
                  >
                    {programme.summary}
                  </p>

                  <ul
                    className={`my-4 space-y-[7px] text-[11px] ${
                      isFeatured ? 'text-[#d4e1dc]' : 'text-[#58655e]'
                    }`}
                  >
                    {programme.highlights.map((highlight) => (
                      <li key={highlight} className="before:mr-2 before:text-gold before:content-['✓']">
                        {highlight}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    data-program={programme.id}
                    onClick={() => select(programme.id, !isOpen)}
                    aria-expanded={isOpen}
                    aria-controls="programme-detail"
                    className={`mt-auto self-start text-left text-[11px] font-extrabold transition hover:underline ${
                      isFeatured ? 'text-white' : 'text-brand'
                    }`}
                  >
                    {isOpen ? 'Close programme' : 'Explore programme'}{' '}
                    <span aria-hidden="true">{isOpen ? '↑' : '→'}</span>
                  </button>
                </article>
              </Reveal>
            );
          })}
        </ul>

        <div ref={detailRef}>
          <ProgrammeDetail
            activeId={activeId}
            programmes={programmes}
            onClose={() => setActiveId(null)}
          />
        </div>

        <ChapterBridge id="programs" />
      </div>
    </section>
  );
}
