import { field } from '@shared/content';
import { Eyebrow } from '@/components/ui/Primitives';
import { Reveal } from '@/components/ui/Reveal';
import { ChapterBridge, ChapterMarker } from '@/components/ui/Chapter';
import type { FieldProject, ResolvedSiteContent } from '@/lib/content';

const STATUS_TONE: Record<string, string> = {
  'In progress': 'bg-coral/12 text-brand-900 border-coral/40',
  Completed: 'bg-moss/15 text-brand-900 border-moss/45',
  Planned: 'bg-line/70 text-brand-900 border-line',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Formats an ISO date without a date library and without locale-dependent output,
 * so the server and the client can never render different strings.
 */
const formatDate = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  const name = month ? MONTHS[Number(month) - 1] : undefined;
  if (!year || !name || !day) return iso;
  return `${Number(day)} ${name} ${year}`;
};

function ProjectCard({ project }: { project: FieldProject }) {
  return (
    <div className="flex h-full flex-col">
      {project.image ? (
        <div className="relative aspect-4/3 overflow-hidden rounded-t-[16px] bg-cream">
          <img
            src={project.image}
            alt={project.imageAlt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : null}

      <div className="flex grow flex-col p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-[0.1em] uppercase ${
              STATUS_TONE[project.status] ?? STATUS_TONE.Planned
            }`}
          >
            {project.status}
          </span>
          <span className="text-[11px] tracking-[0.08em] uppercase text-muted">
            {project.programmeName}
          </span>
        </div>

        <h4 className="text-balance text-xl leading-snug">{project.title}</h4>
        <p className="mt-2.5 grow text-[15px] leading-relaxed text-brand-900">
          {project.summary}
        </p>

        <p className="mt-4 border-t border-line pt-3 text-[11px] tracking-[0.06em] uppercase text-muted">
          {project.location ? `${project.location} · ` : ''}
          <time dateTime={project.date}>{formatDate(project.date)}</time>
        </p>
      </div>
    </div>
  );
}

function ActivityRow({ activity }: { activity: ResolvedSiteContent['activities'][number] }) {
  return (
    <div className="flex gap-4">
      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-coral" aria-hidden="true" />
      {activity.image ? (
        /*
         * Activities carry an image the dashboard collects and the schema
         * insists on alt text for, so it is rendered here rather than accepted
         * and dropped. A wide crop on the leading edge keeps the row's text
         * column intact at every width, and the row grows downward instead of
         * forcing the marker out of alignment with the title.
         */
        <div className="hidden aspect-4/3 w-40 shrink-0 overflow-hidden rounded-[14px] bg-cream sm:block">
          <img
            src={activity.image}
            alt={activity.imageAlt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h4 className="text-lg leading-snug">{activity.title}</h4>
          <span className="text-[10px] font-extrabold tracking-[0.12em] uppercase text-muted">
            {activity.kind}
          </span>
        </div>
        <p className="mt-1.5 text-[15px] leading-relaxed text-brand-900">
          {activity.description}
        </p>
        <time
          dateTime={activity.date}
          className="mt-2 block text-[11px] tracking-[0.06em] uppercase text-muted"
        >
          {formatDate(activity.date)}
        </time>
      </div>
    </div>
  );
}

function EmptyNote({ children }: { children: string }) {
  return (
    <p className="mt-6 rounded-[16px] border border-dashed border-line bg-white/60 p-6 text-[15px] leading-relaxed text-muted">
      {children}
    </p>
  );
}

/**
 * The live layer of the story.
 *
 * Every word on the public site is written by default, so this section renders
 * completely with no data at all — it just shows its empty-state copy. When the
 * /api/content overlay arrives, published projects and activities appear here.
 *
 * It sits after impact and before partners, because the reader has just seen the
 * scale of the work and this is the evidence that it is still moving.
 */
export function Field({ content }: { content: ResolvedSiteContent }) {
  const { projects, activities } = content;

  return (
    <section id="field" className="scroll-mt-24 bg-cream px-0 py-20 md:py-28">
      <div className="shell">
        <ChapterMarker id="field" tone="cream" />
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:gap-16">
            <div>
              <Eyebrow>{field.eyebrow}</Eyebrow>
              <h2 className="text-[clamp(2.25rem,4.6vw,3.75rem)]">
                {field.title} <span className="text-coral">{field.titleAccent}</span>
              </h2>
            </div>
            <p className="self-end text-brand-900">{field.lead}</p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-14 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
          <section aria-labelledby="field-projects">
            <Reveal variant="right" duration={620}>
              <h3
                id="field-projects"
                className="text-[13px] font-extrabold tracking-[0.2em] uppercase"
              >
                {field.projectsTitle}
                {projects.length > 0 ? (
                  <span className="ml-2 text-muted">({projects.length})</span>
                ) : null}
              </h3>
            </Reveal>

            {projects.length === 0 ? (
              <Reveal delay={60}>
                <EmptyNote>{field.emptyProjects}</EmptyNote>
              </Reveal>
            ) : (
              <ul className="mt-6 grid gap-5 sm:grid-cols-2">
                {projects.map((project, index) => (
                  // Rendered as the list item itself so the reveal animation does
                  // not insert a div between <ul> and <li>.
                  <Reveal
                    as="li"
                    key={project.id}
                    delay={index * 70}
                    duration={700}
                    className="group overflow-hidden rounded-[16px] border border-line bg-white transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(26,58,47,0.55)]"
                  >
                    <ProjectCard project={project} />
                  </Reveal>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="field-activities">
            <Reveal variant="right" duration={620}>
              <h3
                id="field-activities"
                className="text-[13px] font-extrabold tracking-[0.2em] uppercase"
              >
                {field.activitiesTitle}
                {activities.length > 0 ? (
                  <span className="ml-2 text-muted">({activities.length})</span>
                ) : null}
              </h3>
            </Reveal>

            {activities.length === 0 ? (
              <Reveal delay={60}>
                <EmptyNote>{field.emptyActivities}</EmptyNote>
              </Reveal>
            ) : (
              <ul className="mt-6 divide-y divide-line">
                {activities.map((activity, index) => (
                  <Reveal
                    as="li"
                    key={activity.id}
                    delay={index * 60}
                    duration={620}
                    className="py-5 first:pt-0 last:pb-0"
                  >
                    <ActivityRow activity={activity} />
                  </Reveal>
                ))}
              </ul>
            )}
          </section>
        </div>

        <ChapterBridge id="field" />
      </div>
    </section>
  );
}
