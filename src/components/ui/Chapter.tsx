import { chapters } from '@shared/content';
import { Reveal } from './Reveal';

/**
 * Chapter label shown at the head of each section. Makes the narrative structure
 * explicit to the reader instead of leaving them to infer it from headings.
 */
export function ChapterMarker({
  id,
  tone = 'light',
}: {
  id: string;
  tone?: 'light' | 'gold' | 'dark' | 'cream';
}) {
  const chapter = chapters.find((item) => item.id === id);
  if (!chapter) return null;

  /*
   * The gold section is the one surface where light-on-dark logic inverts: gold
   * is itself the background, so white and pale cream on it measure 2.25:1 and
   * 1.91:1, and even `white/70` is 1.79:1. Every tone here is therefore the
   * brand's darkest green at an opacity that still clears 4.5:1 over `#d9a441`
   * (full 7.15, /85 5.47, /80 4.95). The /70 the darker tones get away with
   * lands at 3.98:1 here, so it is not used.
   */
  const numberTone =
    tone === 'gold'
      ? 'text-brand-900/85'
      : tone === 'dark'
        ? 'text-gold'
        : tone === 'cream'
          ? 'text-brand-600'
          : 'text-brand';

  const lineTone =
    tone === 'gold'
      ? 'bg-brand-900/30'
      : tone === 'dark'
        ? 'bg-gold/40'
        : 'bg-line';

  return (
    <Reveal
      variant="right"
      duration={620}
      className="mb-6 flex items-center gap-3.5"
    >
      <span
        className={`font-display text-[13px] leading-none font-bold tabular-nums ${numberTone}`}
      >
        {chapter.step}
      </span>
      <span className={`h-px w-8 ${lineTone}`} aria-hidden="true" />
      <span
        className={`text-[10px] font-extrabold tracking-[0.2em] uppercase ${
          tone === 'gold'
            ? 'text-brand-900/80'
            : tone === 'dark'
              ? 'text-[#8eaca0]'
              : 'text-muted'
        }`}
      >
        {chapter.label}
      </span>
    </Reveal>
  );
}

/**
 * The handoff between chapters. Sits at the foot of a section and tells the
 * reader what the next movement of the story is, so the page reads as one
 * continuous argument rather than a stack of independent blocks.
 *
 * Every section renders one, so it has to work on the light, cream and gold
 * surfaces alike. Its default colours are tuned for the light sections and all
 * three of them fail on gold — `brand-600` is 3.10:1, `muted` 2.32:1 and `coral`
 * 2.58:1 — so a section sitting on gold passes `tone="gold"` and gets the same
 * dark treatment `ChapterMarker` already uses there.
 */
export function ChapterBridge({ id, tone = 'light' }: { id: string; tone?: 'light' | 'gold' }) {
  const index = chapters.findIndex((item) => item.id === id);
  const chapter = chapters[index];
  const next = chapters[index + 1];

  if (!chapter?.bridge || !next) return null;

  const onGold = tone === 'gold';

  return (
    <Reveal variant="soft" duration={820} className="mt-16 md:mt-24">
      <div className="flex flex-col items-center gap-5 text-center">
        <span aria-hidden="true" className="flex items-end gap-1.5">
          {[0, 1, 2].map((step) => (
            <span
              key={step}
              style={{ height: `${6 + step * 6}px` }}
              className={`block w-1.5 rounded-full ${
                onGold ? 'bg-brand-900/45' : 'bg-gold/70'
              }`}
            />
          ))}
        </span>

        <p
          className={`max-w-[46ch] font-display text-[clamp(1.05rem,1.9vw,1.5rem)] leading-[1.4] text-balance italic ${
            onGold ? 'text-brand-900' : 'text-brand-600'
          }`}
        >
          {chapter.bridge}
        </p>

        <a
          href={`#${next.id}`}
          className={`group inline-flex items-center gap-2.5 text-[10px] font-extrabold tracking-[0.2em] uppercase transition-colors ${
            onGold ? 'text-brand-900/85 hover:text-brand-900' : 'text-muted hover:text-brand'
          }`}
        >
          <span className={`tabular-nums ${onGold ? 'text-brand-900' : 'text-coral'}`}>
            {next.step}
          </span>
          <span
            className={`h-px w-6 transition-all duration-300 group-hover:w-10 ${
              onGold
                ? 'bg-brand-900/30 group-hover:bg-brand-900/60'
                : 'bg-line group-hover:bg-gold'
            }`}
          />
          {next.label}
        </a>
      </div>
    </Reveal>
  );
}
