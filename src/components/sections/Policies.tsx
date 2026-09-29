import { policies as policiesCopy } from '@shared/content';
import { Eyebrow } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { ChapterBridge, ChapterMarker } from '@/components/ui/Chapter';
import type { ResolvedSiteContent } from '@/lib/content';

/**
 * Human-readable file size.
 *
 * The byte count is display data supplied by the uploader, so it is rendered
 * defensively: a record seeded by hand may carry 0 or nothing at all, and
 * showing "0 KB" next to a document that is obviously not empty reads as a bug.
 * Below a kilobyte the size is omitted rather than rounded to zero.
 */
function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes < 1024) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Renders a single date as e.g. "March 2026".
 *
 * Built by hand rather than with `toLocaleDateString` because the output is
 * baked into a static build on one machine and read on another: the server's ICU
 * data and locale would otherwise decide the wording. The month names are
 * written out, so the section is identical in every environment.
 */
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function formatMonth(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '';
  const year = match[1];
  const month = MONTHS[Number(match[2]) - 1];
  if (!year || !month) return '';
  return `${month} ${year}`;
}

function PolicyRow({
  policy,
}: {
  policy: ResolvedSiteContent['policies'][number];
}) {
  const size = formatBytes(policy.bytes);
  const month = formatMonth(policy.date);

  return (
    <div className="flex flex-col gap-5 rounded-[16px] border border-line bg-white p-6 transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(26,58,47,0.55)] sm:flex-row sm:items-start sm:gap-7">
      {/*
        The badge marks the file type, not the document's subject — the category
        is the text beside it. Kept as a static glyph rather than an <img> so the
        list needs no image request per row.
      */}
      <span
        aria-hidden="true"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-[#edf3eb] text-[10px] font-extrabold tracking-[0.06em] text-brand"
      >
        PDF
      </span>

      <div className="min-w-0 grow">
        <h3 className="font-display text-lg leading-snug text-ink">{policy.title}</h3>

        {policy.category || month || size ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-extrabold tracking-[0.08em] text-muted uppercase">
            {policy.category ? <span className="text-brand">{policy.category}</span> : null}
            {policy.category && (month || size) ? (
              <span aria-hidden="true" className="text-line">
                •
              </span>
            ) : null}
            {month ? <span>{month}</span> : null}
            {month && size ? (
              <span aria-hidden="true" className="text-line">
                •
              </span>
            ) : null}
            {size ? <span>{size}</span> : null}
          </p>
        ) : null}

        {policy.summary ? (
          <p className="mt-3 text-[15px] leading-relaxed text-brand-900">
            {policy.summary}
          </p>
        ) : null}

        {/*
          `download` is only a hint — a browser ignores it for cross-origin URLs
          and honours the server's Content-Disposition otherwise, which is what
          actually keeps an uploaded PDF from rendering inside the site's own
          origin. The visible label carries "PDF" so the link says what it is
          even when the attribute is dropped.
        */}
        <a
          href={policy.file}
          download
          className="group/dl mt-5 inline-flex items-center gap-2.5 text-[13px] font-extrabold text-brand transition hover:gap-3.5"
        >
          {policiesCopy.download}
          <span
            aria-hidden="true"
            className="text-muted transition group-hover/dl:text-brand"
          >
            ↓
          </span>
          <span className="sr-only">: {policy.title}</span>
        </a>
      </div>
    </div>
  );
}

export function Policies({ content }: { content: ResolvedSiteContent }) {
  const { policies } = content;

  return (
    <section id="policies" className="scroll-mt-24 bg-cream px-0 py-20 md:py-28">
      <div className="shell">
        <ChapterMarker id="policies" tone="cream" />
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:gap-16">
            <div>
              <Eyebrow>{policiesCopy.eyebrow}</Eyebrow>
              <h2 className="text-[clamp(2.25rem,4.6vw,3.75rem)]">
                {policiesCopy.title}{' '}
                <span className="text-brand-600">{policiesCopy.titleAccent}</span>
              </h2>
            </div>
            <p className="self-end text-brand-900">{policiesCopy.lead}</p>
          </div>
        </Reveal>

        {policies.length === 0 ? (
          <Reveal delay={60}>
            <p className="mt-14 rounded-[16px] border border-dashed border-line bg-white/60 p-6 text-[15px] leading-relaxed text-muted">
              {policiesCopy.empty}
            </p>
          </Reveal>
        ) : (
          <ul className="mt-14 space-y-4">
            {policies.map((policy, index) => (
              <Reveal
                as="li"
                key={policy.id}
                delay={index * 60}
                duration={700}
              >
                <PolicyRow policy={policy} />
              </Reveal>
            ))}
          </ul>
        )}

        <ChapterBridge id="policies" />
      </div>
    </section>
  );
}
