import { person } from '@shared/content';
import { Reveal } from '@/components/ui/Reveal';

/**
 * The identifiable-victim beat, rendered at the head of the "Proof, in people"
 * chapter.
 *
 * Why a single static frame and not one more gallery slide: the effect this
 * section exists to create depends on the reader dwelling on one person, and a
 * carousel auto-advances every 5.5s, so it removes exactly the dwell time the
 * effect runs on. It also cannot be dismissed — there is no next slide to move
 * to, and nothing else on the page is a person at this size.
 *
 * Renders nothing while `person` is null, which is the default. That is
 * deliberate: publishing someone's name, image and words requires a consent
 * process, and the section must not be reachable by carelessness while writing.
 * See the note on `person` in `shared/content.ts` and
 * `docs/CONVERSION-STRATEGY.md` §4.3.
 */
export function Person() {
  if (!person) return null;

  const credit = person.anonymous ? person.role : person.name;

  return (
    <Reveal variant="fill" duration={920}>
      <figure className="mt-2 overflow-hidden rounded-shell bg-brand text-white">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_1fr]">
          {/*
            The heaviest image on the page. `fetchPriority` is deliberately not
            set: the person block sits below three chapters, and promoting it to
            high priority would compete with the hero for the same budget.
          */}
          <img
            src={person.image}
            alt={person.imageAlt}
            loading="lazy"
            decoding="async"
            width={1200}
            height={1400}
            className="h-[280px] w-full object-cover sm:h-[380px] lg:h-full lg:min-h-[440px]"
          />

          <div className="flex flex-col justify-center p-7 md:p-10 lg:p-12">
            <p className="eyebrow mb-5 text-gold-soft">One woman</p>

            {/*
              `font-display` at this size is the emotional peak of the page and is
              never used for a sentence that could be trimmed.
            */}
            <blockquote className="m-0">
              <p className="font-display text-[clamp(1.5rem,2.7vw,2.3rem)] leading-[1.28] text-balance">
                &ldquo;{person.quote}&rdquo;
              </p>
            </blockquote>

            <figcaption className="mt-7 border-t border-white/20 pt-5">
              <strong className="block text-[15px]">{credit}</strong>
              {person.anonymous ? (
                <small className="mt-1 block text-[12px] text-[#b8c9c1]">
                  {person.context} &middot; named at her request
                </small>
              ) : (
                <small className="mt-1 block text-[12px] text-[#b8c9c1]">
                  {person.role} &middot; {person.context}
                </small>
              )}
            </figcaption>

            {/*
              The one outcome tied to her rather than to a programme, so the
              aggregate in the next chapter has a unit the reader has already met.
            */}
            <p className="mt-5 border-l-2 border-gold-soft pl-4 text-[13px] leading-relaxed text-[#dbe6e0]">
              {person.outcome}
            </p>
          </div>
        </div>
      </figure>
    </Reveal>
  );
}
