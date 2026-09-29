import { organisation } from '@shared/content';

/**
 * The utility strip above the header. It is deliberately quiet: one line of
 * provenance and one way in. It shares the header's sticky wrapper (see
 * `Header.tsx`) so the two move as one object, which is why it needs no state
 * of its own.
 */
export function TopBar() {
  return (
    // An `aside` landmark, because this strip sits outside <header> and <main>
    // and axe flags its text as page content with no enclosing landmark.
    <aside aria-label="Organisation details" className="bg-brand text-[#e9f2ec]">
      {/*
        34px, and the number is load-bearing rather than decorative. This strip
        shares the header's sticky wrapper (see `Header.tsx`), so its height
        stacks with the header row's and the pair is what an in-page anchor has
        to clear:

          condensed  34 + 60 + 1 = 95px
          at rest    34 + 78 + 1 = 113px  (desktop)
          at rest    34 + 68 + 1 = 103px  (mobile)

        34px is what makes the condensed case fit inside the 120px anchor
        reservation set in `index.css`. It is not enough on its own — 36px would
        push the condensed stack to 97px and the resting one to 115px, both
        still inside 120px, but the margin would be gone and the next section
        padding change would have nothing left to absorb the overlap. Anyone
        raising this height has to re-check that reservation, which is the one
        thing about this strip that is easy to miss.
      */}
      <div className="shell flex h-[34px] items-center justify-between gap-4 text-[11px] tracking-[0.03em] sm:text-xs">
        <p className="truncate">
          {organisation.descriptor}
          {/* Below 640px the two halves of this line do not both fit beside the
              link, and the descriptor is the one that identifies us. */}
          <span className="hidden sm:inline">
            {' • '}
            {organisation.location}
          </span>
        </p>

        <a
          href="#contact"
          className="group/link inline-flex shrink-0 items-center gap-1.5 font-bold transition-colors duration-[220ms] ease-state hover:text-gold-soft"
        >
          Partner with us
          {/* `gold-soft`, not `gold`: on this green `--color-gold` measures
              4.37:1, which fails AA for text by 0.13. (`--color-gold` is far
              worse on the cream and paper surfaces, at 2.2:1 and 2.05:1 — that
              is the figure behind the palette's wider warning, but it is not
              the one that applies here.) `gold-soft` reaches 5.61:1 on the same
              background. The arrow below keeps plain gold, being decoration
              that the link's own text already carries. */}
          <span
            aria-hidden="true"
            className="text-gold transition-transform duration-[260ms] ease-settle group-hover/link:translate-x-1"
          >
            →
          </span>
        </a>
      </div>
    </aside>
  );
}
