import { useState } from 'react';

import type { ManagedContent } from '@shared/schemas';
import * as api from '@/lib/adminApi';
import { ActivitiesManager } from './ActivitiesManager';
import { ImpactManager } from './ImpactManager';
import { PicturesManager } from './PicturesManager';
import { PoliciesManager } from './PoliciesManager';
import { ProgrammesManager } from './ProgrammesManager';
import { ProjectsManager } from './ProjectsManager';
import { TeamManager } from './TeamManager';
import { TestimonialsManager } from './TestimonialsManager';
import { useAction } from './useEditor';
import { Button, Card, ErrorBanner, SuccessBanner, TabPanel, Tabs, type TabDefinition } from './ui';

const TABS: TabDefinition[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'activities', label: 'Activity' },
  { id: 'pictures', label: 'Pictures' },
  { id: 'team', label: 'Team' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'policies', label: 'Policies' },
  { id: 'programmes', label: 'Programmes' },
  { id: 'impact', label: 'Impact' },
];

const PANELS: Record<
  string,
  (content: ManagedContent, refresh: () => Promise<boolean>) => React.ReactNode
> = {
  projects: (content, refresh) => <ProjectsManager content={content} refresh={refresh} />,
  activities: (content, refresh) => <ActivitiesManager content={content} refresh={refresh} />,
  pictures: (content, refresh) => <PicturesManager content={content} refresh={refresh} />,
  team: (content, refresh) => <TeamManager content={content} refresh={refresh} />,
  testimonials: (content, refresh) => <TestimonialsManager content={content} refresh={refresh} />,
  policies: (content, refresh) => <PoliciesManager content={content} refresh={refresh} />,
  programmes: (content, refresh) => <ProgrammesManager content={content} refresh={refresh} />,
  impact: (content, refresh) => <ImpactManager content={content} refresh={refresh} />,
};

export function Dashboard({
  content,
  refresh,
  onSignedOut,
}: {
  content: ManagedContent;
  refresh: () => Promise<boolean>;
  onSignedOut: () => void;
}) {
  const [active, setActive] = useState('projects');
  const reset = useAction();

  const onReset = async () => {
    const confirmed = window.confirm(
      'Remove every managed picture, project, update, team member, testimonial, policy document, programme edit and impact change?\n\n' +
        'The site returns to its built-in content. This cannot be undone.',
    );
    if (!confirmed) return;
    const ok = await reset.run(() => api.resetContent(), 'All managed content removed.');
    if (ok) await refresh();
  };

  const counts = {
    projects: content.projects.length,
    activities: content.activities.length,
    pictures: content.pictures.length,
    teamMembers: content.teamMembers.length,
    testimonials: content.testimonials.length,
    policies: content.policies.length,
    programmes: Object.keys(content.programmes).length,
  } as const;

  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.22em] text-coral uppercase">
              Golden Steps
            </p>
            <h1 className="font-display text-[24px]">Content dashboard</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/"
              className="rounded-full border border-line bg-white px-4 py-2.5 text-[13px] font-extrabold transition hover:border-brand"
            >
              View site
            </a>
            <Button variant="ghost" onClick={() => void refresh()}>
              Reload
            </Button>
            <Button variant="danger" onClick={() => void onReset()} disabled={reset.busy}>
              {reset.busy ? 'Clearing…' : 'Reset content'}
            </Button>
            <Button variant="ghost" onClick={onSignedOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main id="admin-main" className="mx-auto max-w-[1180px] px-5 py-8">
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <dl className="flex flex-wrap gap-6">
              {(
                [
                  ['Projects', counts.projects],
                  ['Updates', counts.activities],
                  ['Pictures', counts.pictures],
                  ['Team members', counts.teamMembers],
                  ['Testimonials', counts.testimonials],
                  ['Policies', counts.policies],
                  ['Programmes edited', counts.programmes],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] font-extrabold tracking-[0.16em] text-muted uppercase">
                    {label}
                  </dt>
                  <dd className="font-display text-[26px] leading-none tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-4 space-y-3">
            <ErrorBanner error={reset.error} />
            <SuccessBanner message={reset.notice} />
          </div>
        </Card>

        <Tabs tabs={TABS} active={active} onChange={setActive} />

        {TABS.map((tab) => (
          <TabPanel key={tab.id} id={tab.id} active={active}>
            {PANELS[tab.id]?.(content, refresh)}
          </TabPanel>
        ))}

        <footer className="mt-10 border-t border-line pt-6 text-sm text-muted">
          <p>
            Content is stored in the server&rsquo;s <code>data/content.json</code> and
            uploaded images in <code>data/uploads/</code>. Neither is part of the site
            build, so published content survives a redeploy.
          </p>
        </footer>
      </main>
    </>
  );
}
