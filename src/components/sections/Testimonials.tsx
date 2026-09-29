import { Eyebrow } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { ChapterBridge, ChapterMarker } from '@/components/ui/Chapter';
import type { ResolvedSiteContent } from '@/lib/content';

const testimonials = {
  eyebrow: 'Voices of change',
  title: 'What people',
  titleAccent: 'say about us.',
  lead: 'Stories from community members, partners, and those whose lives have been touched by our work.',
  empty: 'Testimonials will be shown here. Add them from the admin dashboard.',
} as const;

function TestimonialCard({ testimonial }: { testimonial: ResolvedSiteContent['testimonials'][number] }) {
  return (
    <div className="flex h-full flex-col bg-white rounded-[16px] border border-line p-6">
      <div className="flex items-start gap-4">
        {testimonial.image ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-cream">
            <img
              src={testimonial.image}
              alt={testimonial.imageAlt || testimonial.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-full bg-cream flex items-center justify-center">
            <span className="text-3xl text-muted">💬</span>
          </div>
        )}
        <div className="flex-1">
          <svg
            className="h-8 w-8 text-brand/20"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
        </div>
      </div>
      
      <blockquote className="mt-4 flex-1">
        <p className="text-[15px] leading-relaxed text-brand-900 italic">
          "{testimonial.testimonial}"
        </p>
      </blockquote>
      
      <div className="mt-6 flex items-center gap-3 border-t border-line pt-4">
        <div>
          <p className="font-display text-lg font-bold">{testimonial.name}</p>
          <p className="text-sm text-muted">{testimonial.role}</p>
        </div>
      </div>
    </div>
  );
}

export function Testimonials({ content }: { content: ResolvedSiteContent }) {
  const { testimonials: testimonialList } = content;

  return (
    <section id="testimonials" className="scroll-mt-24 bg-cream px-0 py-20 md:py-28">
      <div className="shell">
        <ChapterMarker id="testimonials" tone="cream" />
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:gap-16">
            <div>
              <Eyebrow>{testimonials.eyebrow}</Eyebrow>
              <h2 className="text-[clamp(2.25rem,4.6vw,3.75rem)]">
                {testimonials.title} <span className="text-brand-600">{testimonials.titleAccent}</span>
              </h2>
            </div>
            <p className="self-end text-brand-900">{testimonials.lead}</p>
          </div>
        </Reveal>

        {testimonialList.length === 0 ? (
          <Reveal delay={60}>
            <p className="mt-14 rounded-[16px] border border-dashed border-line bg-white/60 p-6 text-[15px] leading-relaxed text-muted">
              {testimonials.empty}
            </p>
          </Reveal>
        ) : (
          <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonialList.map((testimonial, index) => (
              <Reveal
                as="li"
                key={testimonial.id}
                delay={index * 70}
                duration={700}
                className="transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(26,58,47,0.55)]"
              >
                <TestimonialCard testimonial={testimonial} />
              </Reveal>
            ))}
          </ul>
        )}

        <ChapterBridge id="testimonials" />
      </div>
    </section>
  );
}