import type { Programme, ProgrammeId } from '@shared/content';

/**
 * Disclosure panel that renders the full activity list for the selected
 * programme. Rendered unconditionally (rather than conditionally) so the
 * open/close transition can play and so the region is always in the DOM.
 */
export function ProgrammeDetail({
  activeId,
  programmes,
  onClose,
}: {
  activeId: ProgrammeId | null;
  programmes: Programme[];
  onClose: () => void;
}) {
  const programme = programmes.find((item) => item.id === activeId) ?? null;

  return (
    <div
      id="programme-detail"
      role="region"
      aria-live="polite"
      className={`grid transition-all duration-300 ${
        programme ? 'mt-8 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="overflow-hidden">
        {programme ? (
          <div className="rounded-shell bg-white p-7 shadow-shell md:p-10">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#edf3eb] text-2xl text-brand"
                >
                  {programme.icon}
                </span>
                <div>
                  <p className="eyebrow mb-1.5">Programme {programme.number}</p>
                  <h3 className="font-display text-[clamp(1.6rem,3vw,2.4rem)]">
                    {programme.name}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-lg text-brand transition hover:bg-brand hover:text-white"
                aria-label={`Close ${programme.name} details`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <p className="mt-5 max-w-[70ch] text-[15px] text-muted">{programme.description}</p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px]">
              <span className="rounded-full bg-[#edf3eb] px-3.5 py-1.5 font-extrabold text-brand">
                {programme.beneficiaries.toLocaleString('en-US')} estimated beneficiaries
              </span>
              {programme.highlights.map((highlight) => (
                <span
                  key={highlight}
                  className="rounded-full border border-line px-3.5 py-1.5 font-semibold text-[#58655e]"
                >
                  {highlight}
                </span>
              ))}
            </div>

            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {programme.activities.map((activity) => (
                <li key={activity.title} className="rounded-[15px] bg-[#f7f9f6] p-5">
                  <strong className="mb-1.5 block text-[13px] text-brand">
                    {activity.title}
                  </strong>
                  <span className="text-[12.5px] leading-relaxed text-muted">
                    {activity.description}
                  </span>
                </li>
              ))}
            </ul>

            <figure className="mt-7 overflow-hidden rounded-[18px]">
              <img
                src={programme.image}
                alt={programme.imageAlt}
                loading="lazy"
                decoding="async"
                width={1200}
                height={675}
                className="h-[240px] w-full object-cover md:h-[340px]"
              />
              <figcaption className="mt-3 text-[12px] text-muted">
                {programme.caption}
              </figcaption>
            </figure>
          </div>
        ) : null}
      </div>
    </div>
  );
}
