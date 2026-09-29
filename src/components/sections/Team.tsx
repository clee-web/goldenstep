import { Eyebrow } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { ChapterBridge, ChapterMarker } from '@/components/ui/Chapter';
import type { ResolvedSiteContent } from '@/lib/content';

const team = {
  eyebrow: 'Our team',
  title: 'The people behind',
  titleAccent: 'the mission.',
  lead: 'Meet the dedicated individuals who drive Golden Steps forward every day.',
  empty: 'Team members will be shown here. Add them from the admin dashboard.',
} as const;

function TeamMemberCard({ member }: { member: ResolvedSiteContent['teamMembers'][number] }) {
  return (
    <div className="flex h-full flex-col">
      {member.image ? (
        <div className="relative aspect-square overflow-hidden rounded-t-[16px] bg-cream">
          <img
            src={member.image}
            alt={member.imageAlt || member.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div className="aspect-square rounded-t-[16px] bg-cream flex items-center justify-center">
          <span className="text-6xl text-muted">👤</span>
        </div>
      )}

      <div className="flex grow flex-col p-6 bg-white rounded-b-[16px] border border-t-0 border-line">
        <h4 className="text-xl leading-snug font-display">{member.name}</h4>
        <p className="mt-1 text-sm font-extrabold tracking-[0.08em] uppercase text-brand">
          {member.role}
        </p>
        <p className="mt-3 grow text-[15px] leading-relaxed text-brand-900">
          {member.bio}
        </p>
        {member.email ? (
          <a
            href={`mailto:${member.email}`}
            className="mt-4 inline-flex items-center gap-2 text-[13px] font-extrabold text-brand transition hover:gap-3"
          >
            Contact <span aria-hidden="true">→</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function Team({ content }: { content: ResolvedSiteContent }) {
  const { teamMembers } = content;

  return (
    <section id="team" className="scroll-mt-24 px-0 py-20 md:py-28">
      <div className="shell">
        <ChapterMarker id="team" />
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:gap-16">
            <div>
              <Eyebrow>{team.eyebrow}</Eyebrow>
              <h2 className="text-[clamp(2.25rem,4.6vw,3.75rem)]">
                {team.title} <span className="text-brand-600">{team.titleAccent}</span>
              </h2>
            </div>
            <p className="self-end text-brand-900">{team.lead}</p>
          </div>
        </Reveal>

        {teamMembers.length === 0 ? (
          <Reveal delay={60}>
            <p className="mt-14 rounded-[16px] border border-dashed border-line bg-white/60 p-6 text-[15px] leading-relaxed text-muted">
              {team.empty}
            </p>
          </Reveal>
        ) : (
          <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {teamMembers.map((member, index) => (
              <Reveal
                as="li"
                key={member.id}
                delay={index * 70}
                duration={700}
                className="group overflow-hidden rounded-[16px] border border-line transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(26,58,47,0.55)]"
              >
                <TeamMemberCard member={member} />
              </Reveal>
            ))}
          </ul>
        )}

        <ChapterBridge id="team" />
      </div>
    </section>
  );
}