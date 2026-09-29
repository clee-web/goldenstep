import { contact, organisation, programmes, vision } from '@shared/content';
import { emailHref, emailDisplay, hasEmail, phoneLinks, site, socialLinks } from '@/config/site';

const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-brand-900 px-0 pb-6 pt-14 text-[#a9bbb4]">
      <div className="shell">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.2fr]">
          <div>
            <a href="#home" className="flex items-center gap-2.5 text-white">
              <img
                src="/assets/logo.jpeg"
                alt=""
                width={42}
                height={42}
                className="h-[42px] w-[42px] rounded-[13px] object-cover"
              />
              <span>
                <strong className="block font-display text-xl leading-none">
                  {organisation.name}
                </strong>
                <small className="mt-1 block text-[9px] tracking-[0.12em] uppercase">
                  {organisation.tagline}
                </small>
              </span>
            </a>
            <p className="mt-5 max-w-[390px] text-xs">
              Working with women, youth and communities to live free from violence and
              inequality.
            </p>
            <p className="mt-4 max-w-[390px] text-xs italic text-[#8eaca0]">
              {vision.values.items.join(' • ')}
            </p>
          </div>

          <nav aria-label="Explore">
            <h2 className="text-[11px] font-extrabold tracking-[0.15em] text-white uppercase">
              Explore
            </h2>
            <ul className="mt-4 space-y-2.5 text-xs">
              {[
                { label: 'About', href: '#about' },
                { label: 'Our Team', href: '#team' },
                { label: 'Programmes', href: '#programs' },
                { label: 'Stories', href: '#stories' },
                { label: 'Impact', href: '#impact' },
                { label: 'Testimonials', href: '#testimonials' },
                { label: 'Our Policies', href: '#policies' },
                { label: 'Our approach', href: '#approach' },
              ].map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="transition hover:text-gold">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Connect">
            <h2 className="text-[11px] font-extrabold tracking-[0.15em] text-white uppercase">
              Connect
            </h2>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>
                <a href="#partners" className="transition hover:text-gold">
                  Partnerships
                </a>
              </li>
              <li>
                <a href="#contact" className="transition hover:text-gold">
                  Contact
                </a>
              </li>
              {socialLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="transition hover:text-gold"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-[11px] font-extrabold tracking-[0.15em] text-white uppercase">
              Our programmes
            </h2>
            <ul className="mt-4 space-y-2.5 text-xs">
              {programmes.map((programme) => (
                <li key={programme.id}>
                  <a
                    href="#programs"
                    onClick={(event) => {
                      const trigger = document.querySelector<HTMLButtonElement>(
                        `[data-program="${programme.id}"]`,
                      );
                      if (!trigger) return;
                      event.preventDefault();
                      trigger.click();
                    }}
                    className="transition hover:text-gold"
                  >
                    {programme.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-11 flex flex-col gap-4 border-t border-[#294139] pt-5 text-[10px] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {organisation.name}. Founded {organisation.founded}. Content based on
            the project overview.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {hasEmail ? (
              <a href={emailHref} className="transition hover:text-gold">
                {emailDisplay}
              </a>
            ) : null}
            {phoneLinks.map((phone) => (
              <a
                key={phone.href}
                href={phone.href}
                className="transition hover:text-gold"
              >
                {phone.display}
              </a>
            ))}
            <span>{site.address}</span>
            {contact.topics.length > 0 ? (
              <a href="#contact" className="transition hover:text-gold">
                Get involved
              </a>
            ) : null}
            <a href="#home" className="transition hover:text-gold">
              Back to top ↑
            </a>
          </div>
        </div>

        {/*
          The credit sits on its own line rather than in the contact row above.
          Awaken Systems' number next to Golden Steps' own address and phone
          lines would read as another way to reach the organisation, which is
          not what it is.
        */}
        <p className="mt-5 text-center text-[10px] text-[#7d968c]">
          Site created by{' '}
          <a
            href="tel:+254758183740"
            className="whitespace-nowrap transition hover:text-gold"
          >
            Awaken Systems, Kisumu · +254 758 183 740
          </a>
        </p>
      </div>
    </footer>
  );
}
