import { donate } from '@shared/content';
import { Eyebrow } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';

/**
 * The donation anchor, rendered inside the "Take the step" chapter.
 *
 * Gold is used here and, as far as the donation path is concerned, only here.
 * That is the point: deep green is the header, the ticker band, the Partners
 * card, the featured programme card and the Contact section, so green already
 * means "the organisation" everywhere on the site. Reserving gold for the ask
 * makes the single most important action on the page the one thing that looks
 * different from everything else. `brand-900` on gold measures 7.15:1, so the
 * label is not trading legibility for the distinction.
 *
 * The numbers are set in a monospaced face at display size and are selectable
 * text rather than an image, because a donor reading them off the screen has to
 * be able to select and copy them. They are also the largest type on the page:
 * a paybill is a thing to be read, not skimmed.
 */
export function Donate() {
  return (
    <div className="mb-14 md:mb-16">
      <Reveal variant="fill" duration={900}>
        <div className="overflow-hidden rounded-shell bg-gold px-6 py-10 text-brand-900 md:px-12 md:py-14">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
            <div>
              <Eyebrow
                className="text-brand-900"
                accentClassName="text-brand-900/85"
              >
                {donate.eyebrow}
              </Eyebrow>
              <h3 className="text-[clamp(1.85rem,3.6vw,2.9rem)] leading-[1.12]">
                {donate.title} <span className="text-brand-900">{donate.titleAccent}</span>
              </h3>
              <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-brand-900/85">
                {donate.lead}
              </p>
            </div>

            <div className="rounded-[20px] bg-white p-6 md:p-7">
              <span className="text-[10px] font-extrabold tracking-[0.16em] text-muted uppercase">
                {donate.mpesa.label}
              </span>

              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-[10px] font-extrabold tracking-[0.12em] text-muted uppercase">
                    {donate.mpesa.paybillLabel}
                  </dt>
                  <dd className="mt-0.5 font-mono text-[clamp(1.6rem,3.4vw,2.1rem)] leading-none font-bold tracking-tight text-ink tabular-nums select-all">
                    {donate.mpesa.paybill}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-extrabold tracking-[0.12em] text-muted uppercase">
                    {donate.mpesa.accountLabel}
                  </dt>
                  <dd className="mt-0.5 font-mono text-[clamp(1.6rem,3.4vw,2.1rem)] leading-none font-bold tracking-tight text-ink tabular-nums select-all">
                    {donate.mpesa.account}
                  </dd>
                </div>
              </dl>

              {/*
                The USSD code is the lowest-friction path available and it needs
                no data connection, so it is given its own line rather than
                buried in the steps below. It is a `tel:` href so that a phone
                can dial it, which is the only reason this is a link and not
                plain text.
              */}
              <p className="mt-6 border-t border-line pt-5 text-[12px] leading-relaxed text-muted">
                Or dial{' '}
                <a
                  href={`tel:${donate.mpesa.ussd.replace(/[^\d*#]/g, '')}`}
                  className="font-mono text-[15px] font-bold text-ink underline decoration-gold decoration-2 underline-offset-4"
                >
                  {donate.mpesa.ussd}
                </a>{' '}
                to give without data.
              </p>
            </div>
          </div>

          <ol className="mt-10 grid gap-4 border-t border-brand-900/25 pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {donate.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-900 text-[11px] font-extrabold text-gold tabular-nums">
                  {index + 1}
                </span>
                <span className="text-[13px] leading-relaxed text-brand-900/85">
                  {step}
                </span>
              </li>
            ))}
          </ol>

          {/* `/85` not `/70`: brand-900 at 70% on gold measures 3.98:1, which
              fails the 4.5:1 that 12px body copy needs. 85% is 5.47:1. */}
          <p className="mt-6 text-[12px] text-brand-900/85">{donate.note}</p>
        </div>
      </Reveal>
    </div>
  );
}
