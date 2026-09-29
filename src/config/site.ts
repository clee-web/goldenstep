/**
 * Runtime configuration for Golden Steps' public contact details.
 *
 * Every value falls back to an empty string so the site still builds and runs
 * before anyone fills in `.env`. Contact surfaces detect the empty state and
 * render an honest "not published yet" affordance rather than a broken link.
 */

import { organisation } from '@shared/content';

const env = import.meta.env;

const trim = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export interface SocialLink {
  label: string;
  href: string;
}

export interface PhoneLink {
  /** Exactly as the organisation publishes it, spaces and all. */
  display: string;
  /** Dialable: the same digits with punctuation stripped. */
  href: string;
}

/**
 * A `tel:` target has to be dialable, so spaces, brackets and dashes are
 * removed. `+` is kept because it is meaningful to dialled numbers, and any
 * extension marker would be lost, so a number written as `+254 722 999 630`
 * keeps its meaning on both halves of the pair.
 */
const dialable = (value: string): string => `tel:+${value.replace(/\D/g, '')}`;

export const site = {
  ...organisation,
  /** Empty until VITE_ORG_EMAIL is set. */
  email: env.VITE_ORG_EMAIL?.trim() ?? '',
  phone: env.VITE_ORG_PHONE?.trim() ?? '',
  /** Optional second line. The organisation publishes two numbers. */
  phoneSecondary: env.VITE_ORG_PHONE_2?.trim() ?? '',
  /*
   * The fallback composes the country in rather than reusing `location` alone.
   * That field is the top bar's provenance line and reads "Kisumu County"; in
   * the footer's address slot the country is what a reader needs to place it, and
   * `VITE_ORG_ADDRESS` is blank in `.env.example`, so this path is what a fresh
   * deployment actually renders.
   */
  address: env.VITE_ORG_ADDRESS?.trim() || `${organisation.location}, Kenya`,
  mapUrl: env.VITE_ORG_MAP_URL?.trim() ?? '',
  registrationNumber: env.VITE_ORG_REGISTRATION?.trim() ?? '',
  socials: {
    facebook: trim(env.VITE_ORG_FACEBOOK),
    x: trim(env.VITE_ORG_X),
    linkedin: trim(env.VITE_ORG_LINKEDIN),
    instagram: trim(env.VITE_ORG_INSTAGRAM),
  },
} as const;

export const socialLinks: SocialLink[] = [
  { label: 'Facebook', href: site.socials.facebook },
  { label: 'X', href: site.socials.x },
  { label: 'LinkedIn', href: site.socials.linkedin },
  { label: 'Instagram', href: site.socials.instagram },
].filter((link) => link.href.length > 0);

export const hasEmail = site.email.length > 0;

/**
 * Every published number, in the order given, minus any that were left blank.
 * A single unset value drops out rather than rendering an empty link, so a
 * half-filled pair degrades to the one real number instead of a dead `tel:`.
 */
export const phoneLinks: PhoneLink[] = [site.phone, site.phoneSecondary]
  .filter((value) => value.length > 0)
  .map((display) => ({ display, href: dialable(display) }));

export const hasPhone = phoneLinks.length > 0;

/** Human-readable label for the contact card, degrading gracefully when unset. */
export const emailDisplay = hasEmail ? site.email : 'Email not published yet';

export const emailHref = hasEmail ? `mailto:${site.email}` : undefined;
