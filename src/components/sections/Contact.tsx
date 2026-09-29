import { useId, useState, type FormEvent } from 'react';

import { contact, organisation } from '@shared/content';
import { submitEnquiry } from '@/lib/api';
import { emailDisplay, hasEmail, hasPhone, phoneLinks, site } from '@/config/site';
import { Button } from '@/components/ui/Button';
import { Donate } from '@/components/sections/Donate';
import { Eyebrow } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { ChapterMarker } from '@/components/ui/Chapter';

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface FieldErrors {
  name?: string;
  email?: string;
  organisation?: string;
  topic?: string;
  message?: string;
}

const fieldClass =
  'mt-2 block w-full rounded-[11px] border border-[#dce2dd] bg-[#fbfcfa] p-3 font-sans text-[13px] text-ink outline-none transition focus:border-brand';

const labelClass = 'block text-[11px] font-extrabold text-ink';

export function Contact() {
  const formId = useId();
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState('');

  const errorProps = (field: keyof FieldErrors) =>
    errors[field]
      ? ({
          'aria-invalid': true,
          'aria-describedby': `${formId}-${field}-error`,
        } as const)
      : {};

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus('submitting');
    setErrors({});
    setNotice('');

    const result = await submitEnquiry({
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      organisation: String(data.get('organisation') ?? ''),
      topic: String(data.get('topic') ?? ''),
      message: String(data.get('message') ?? ''),
      // Honeypot: hidden from humans, tempting to bots.
      website: String(data.get('website') ?? ''),
    });

    if (result.ok) {
      setStatus('success');
      setNotice('Thank you. Your enquiry has been received — we will be in touch shortly.');
      form.reset();
      return;
    }

    setStatus('error');
    setErrors(result.error.fields ?? {});
    setNotice(result.error.message);
  };

  return (
    <section
      id="contact"
      className="scroll-mt-24 bg-[#18372e] px-0 py-20 text-white md:py-28"
    >
      <div className="shell">
        <ChapterMarker id="contact" tone="dark" />
        {/*
          The donation anchor leads this chapter rather than sitting below the
          form. The form is the highest-commitment path and is correctly last;
          the paybill is the lowest, and asking for the largest ask first is how
          a two-tier donate path collapses into one.
        */}
        <Donate />
      </div>

      <div className="shell grid gap-12 lg:grid-cols-2 lg:gap-24">
        <Reveal variant="left" delay={60}>
          <Eyebrow>{contact.eyebrow}</Eyebrow>
          <h2 className="text-[clamp(2.25rem,4.6vw,4rem)]">
            {contact.title} <span className="text-gold">{contact.titleAccent}</span>
          </h2>
          <p className="max-w-[500px] text-[#b8c9c1]">{contact.lead}</p>

          <div className="mt-9">
            <div className="my-4 flex items-center gap-3.5">
              <span
                aria-hidden="true"
                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-brand-700"
              >
                ✉
              </span>
              <div>
                <small className="block text-[9px] tracking-[0.12em] text-[#8eaca0] uppercase">
                  Email
                </small>
                {hasEmail ? (
                  <a href={`mailto:${site.email}`} className="text-xs hover:text-gold">
                    {emailDisplay}
                  </a>
                ) : (
                  <strong className="text-xs font-normal text-[#8eaca0]">
                    {emailDisplay}
                  </strong>
                )}
              </div>
            </div>

            <div className="my-4 flex items-center gap-3.5">
              <span
                aria-hidden="true"
                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-brand-700"
              >
                ✆
              </span>
              <div>
                <small className="block text-[9px] tracking-[0.12em] text-[#8eaca0] uppercase">
                  Phone
                </small>
                {hasPhone ? (
                  /*
                   * Both numbers stay visible as text rather than one becoming a
                   * link and the other a label: on a phone the two sit far enough
                   * apart that a visitor cannot reliably tap the right one, and
                   * the stack reads the same either way.
                   */
                  <span className="flex flex-wrap gap-x-3">
                    {phoneLinks.map((phone) => (
                      <a
                        key={phone.href}
                        href={phone.href}
                        className="text-xs transition hover:text-gold"
                      >
                        {phone.display}
                      </a>
                    ))}
                  </span>
                ) : (
                  <strong className="text-xs font-normal text-[#8eaca0]">
                    Phone not published yet
                  </strong>
                )}
              </div>
            </div>

            <div className="my-4 flex items-center gap-3.5">
              <span
                aria-hidden="true"
                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-brand-700"
              >
                ⌖
              </span>
              <div>
                <small className="block text-[9px] tracking-[0.12em] text-[#8eaca0] uppercase">
                  Location
                </small>
                <strong className="text-xs font-normal">{site.address}</strong>
              </div>
            </div>

            <div className="my-4 flex items-center gap-3.5">
              <span
                aria-hidden="true"
                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-brand-700"
              >
                ✦
              </span>
              <div>
                <small className="block text-[9px] tracking-[0.12em] text-[#8eaca0] uppercase">
                  Founded
                </small>
                <strong className="text-xs font-normal">
                  {organisation.founded} • {organisation.descriptor}
                </strong>
              </div>
            </div>

            {/*
              The registration number is defined in `site.ts` and was rendered
              nowhere. For an organisation asking a stranger to write in — and
              eventually to send money — it is the one detail a Kenyan donor can
              actually check: NGO registration is a public record, so displaying
              it is the cheapest trust signal available, and its absence reads
              as evasion rather than as an oversight.
            */}
            {site.registrationNumber ? (
              <div className="my-4 flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-brand-700"
                >
                  ⛉
                </span>
                <div>
                  <small className="block text-[9px] tracking-[0.12em] text-[#8eaca0] uppercase">
                    Registration
                  </small>
                  <strong className="text-xs font-normal">
                    {site.registrationNumber}
                  </strong>
                </div>
              </div>
            ) : null}
          </div>
        </Reveal>

        <Reveal variant="right" delay={140}>
          <form
            onSubmit={onSubmit}
            noValidate
            className="rounded-shell bg-white p-7 text-ink shadow-shell md:p-8"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${formId}-name`} className={labelClass}>
                  Name <span aria-hidden="true">*</span>
                </label>
                <input
                  id={`${formId}-name`}
                  name="name"
                  required
                  autoComplete="name"
                  placeholder="Your name"
                  className={fieldClass}
                  {...errorProps('name')}
                />
                {errors.name ? (
                  <FieldError id={`${formId}-name-error`}>{errors.name}</FieldError>
                ) : null}
              </div>

              <div>
                <label htmlFor={`${formId}-email`} className={labelClass}>
                  Email <span aria-hidden="true">*</span>
                </label>
                <input
                  id={`${formId}-email`}
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={fieldClass}
                  {...errorProps('email')}
                />
                {errors.email ? (
                  <FieldError id={`${formId}-email-error`}>{errors.email}</FieldError>
                ) : null}
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor={`${formId}-organisation`} className={labelClass}>
                Organisation <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id={`${formId}-organisation`}
                name="organisation"
                autoComplete="organization"
                placeholder="Your organisation"
                className={fieldClass}
                {...errorProps('organisation')}
              />
              {errors.organisation ? (
                <FieldError id={`${formId}-organisation-error`}>
                  {errors.organisation}
                </FieldError>
              ) : null}
            </div>

            <div className="mt-4">
              <label htmlFor={`${formId}-topic`} className={labelClass}>
                How can we collaborate? <span aria-hidden="true">*</span>
              </label>
              <select
                id={`${formId}-topic`}
                name="topic"
                required
                defaultValue={contact.topics[0]}
                className={fieldClass}
                {...errorProps('topic')}
              >
                {contact.topics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
              {errors.topic ? (
                <FieldError id={`${formId}-topic-error`}>{errors.topic}</FieldError>
              ) : null}
            </div>

            <div className="mt-4">
              <label htmlFor={`${formId}-message`} className={labelClass}>
                Message <span aria-hidden="true">*</span>
              </label>
              <textarea
                id={`${formId}-message`}
                name="message"
                rows={5}
                required
                placeholder="Tell us a little about your interest..."
                className={`${fieldClass} resize-y`}
                {...errorProps('message')}
              />
              {errors.message ? (
                <FieldError id={`${formId}-message-error`}>{errors.message}</FieldError>
              ) : null}
            </div>

            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label htmlFor={`${formId}-website`}>Website</label>
              <input
                id={`${formId}-website`}
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <Button type="submit" disabled={status === 'submitting'} className="mt-5 w-full sm:w-auto">
              {status === 'submitting' ? 'Sending…' : 'Send enquiry'}{' '}
              <span aria-hidden="true">↗</span>
            </Button>

            <p
              role="status"
              aria-live="polite"
              className={`mt-3 text-[11px] ${
                status === 'error' ? 'text-coral' : 'text-brand'
              }`}
            >
              {notice}
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="mt-1.5 text-[11px] font-semibold text-coral">
      {children}
    </p>
  );
}
