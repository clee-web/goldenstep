import { useId, type ReactNode } from 'react';

/**
 * Small uppercase label used above every section heading.
 *
 * `accentClassName` tones the leading glyph separately, because the default
 * gold one disappears against the gold section: there the glyph has to be as
 * dark as the text or it reads as a rendering fault.
 */
export function Eyebrow({
  children,
  className = '',
  accentClassName = 'text-gold',
}: {
  children: ReactNode;
  className?: string;
  accentClassName?: string;
}) {
  return (
    <p className={`eyebrow mb-3.5 ${className}`}>
      <span aria-hidden="true" className={`mr-2 ${accentClassName}`}>
        ✦
      </span>
      {children}
    </p>
  );
}

/**
 * Section heading with an optional accented second line. Splitting the accent
 * into its own prop keeps the emphasis semantic (real markup) rather than a
 * styled span buried in a string.
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  accentLine2,
  lead,
  tone = 'light',
  id,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  accentLine2?: string;
  lead?: string;
  tone?: 'light' | 'gold' | 'dark';
  id?: string;
}) {
  const headingId = useId();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:gap-16">
      <div>
        <Eyebrow className={tone === 'gold' ? 'text-[#f6ecd5]' : undefined}>
          {eyebrow}
        </Eyebrow>
        <h2
          id={id ?? headingId}
          className={`text-[clamp(2.25rem,4.6vw,3.75rem)] ${
            tone === 'gold' ? 'text-white' : ''
          }`}
        >
          {title}
          {accent ? (
            <>
              {' '}
              <span
                className={
                  tone === 'gold' ? 'text-white' : 'text-brand-600'
                }
              >
                {accent}
              </span>
            </>
          ) : null}
          {accentLine2 ? (
            <>
              <br />
              <span
                className={tone === 'gold' ? 'text-white' : 'text-brand-600'}
              >
                {accentLine2}
              </span>
            </>
          ) : null}
        </h2>
      </div>

      {lead ? (
        <p
          className={
            tone === 'gold'
              ? 'self-end text-brand-900'
              : tone === 'dark'
                ? 'max-w-[500px] text-[#b8c9c1]'
                : 'self-end text-muted'
          }
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}
