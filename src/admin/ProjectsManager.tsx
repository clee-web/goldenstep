import { useState } from 'react';

import {
  programmeIds,
  type ManagedContent,
  type ManagedProject,
  type ProjectInput,
} from '@shared/schemas';
import { programmes as programmeList } from '@shared/content';
import * as api from '@/lib/adminApi';
import { useAction, useEditor } from './useEditor';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  RowActions,
  SectionTitle,
  Select,
  SuccessBanner,
  TextArea,
  TextInput,
} from './ui';

const STATUSES = ['Planned', 'In progress', 'Completed'] as const;

const programmeLabels = new Map(programmeList.map((p) => [p.id, p.name]));

const blank = (): ProjectInput => ({
  title: '',
  summary: '',
  programme: 'gender',
  status: 'Planned',
  date: new Date().toISOString().slice(0, 10),
  location: '',
  image: '',
  imageAlt: '',
});

const toDraft = (project: ManagedProject): ProjectInput => ({
  title: project.title,
  summary: project.summary,
  programme: project.programme,
  status: project.status,
  date: project.date,
  location: project.location,
  image: project.image,
  imageAlt: project.imageAlt,
});

export function ProjectsManager({
  content,
  refresh,
}: {
  content: ManagedContent;
  /** Re-reads managed content from the server after a successful write. */
  refresh: () => Promise<boolean>;
}) {
  const [filter, setFilter] = useState<string>('all');

  const editor = useEditor<ProjectInput>({
    blank,
    onError: (error) =>
      error.error === 'not_found'
        ? 'That project no longer exists. Reload the dashboard and try again.'
        : error.message,
  });

  const removal = useAction();

  const projects = content.projects;
  const visible = filter === 'all'
    ? projects
    : projects.filter((project) => project.programme === filter);

  const save = async (draft: ProjectInput, id: string | null) =>
    id ? api.updateProject(id, draft) : api.createProject(draft);

  /**
   * Every successful write re-reads the server rather than patching local state,
   * so the list can never disagree with what the public site will render.
   */
  const onSubmit = async () => {
    const ok = await editor.submit(save, {
      created: 'Project published.',
      updated: 'Project updated.',
    });
    if (ok) await refresh();
  };

  const onDelete = async (project: ManagedProject) => {
    const confirmed = window.confirm(
      `Delete “${project.title}”? This cannot be undone.`,
    );
    if (!confirmed) return;

    const ok = await removal.run(
      () => api.deleteProject(project.id),
      `Deleted “${project.title}”.`,
    );
    if (ok) {
      editor.clearNotice();
      await refresh();
    }
  };

  const error = editor.error ?? removal.error;

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title={editor.mode === 'edit' ? 'Edit project' : 'New project'}
          description="Published projects appear in the From the field chapter on the public site."
        />

        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
          noValidate
        >
          <div className="md:col-span-2">
            <Field label="Title" htmlFor="project-title" error={editor.fieldErrors.title}>
              <TextInput
                id="project-title"
                value={editor.draft.title}
                invalid={Boolean(editor.fieldErrors.title)}
                onChange={(value) =>
                  editor.setDraft((draft) => ({ ...draft, title: value }))
                }
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field
              label="Summary"
              htmlFor="project-summary"
              error={editor.fieldErrors.summary}
              hint="One or two sentences, 10–400 characters."
            >
              <TextArea
                id="project-summary"
                value={editor.draft.summary}
                invalid={Boolean(editor.fieldErrors.summary)}
                onChange={(value) =>
                  editor.setDraft((draft) => ({ ...draft, summary: value }))
                }
              />
            </Field>
          </div>

          <Field
            label="Programme"
            htmlFor="project-programme"
            error={editor.fieldErrors.programme}
          >
            <Select
              id="project-programme"
              value={editor.draft.programme}
              invalid={Boolean(editor.fieldErrors.programme)}
              options={programmeIds.map((id) => ({
                value: id,
                label: programmeLabels.get(id) ?? id,
              }))}
              onChange={(value) =>
                editor.setDraft((draft) => ({
                  ...draft,
                  programme: value as ProjectInput['programme'],
                }))
              }
            />
          </Field>

          <Field label="Status" htmlFor="project-status" error={editor.fieldErrors.status}>
            <Select
              id="project-status"
              value={editor.draft.status}
              invalid={Boolean(editor.fieldErrors.status)}
              options={STATUSES.map((status) => ({ value: status, label: status }))}
              onChange={(value) =>
                editor.setDraft((draft) => ({
                  ...draft,
                  status: value as ProjectInput['status'],
                }))
              }
            />
          </Field>

          <Field label="Date" htmlFor="project-date" error={editor.fieldErrors.date}>
            <TextInput
              id="project-date"
              type="date"
              value={editor.draft.date}
              invalid={Boolean(editor.fieldErrors.date)}
              onChange={(value) => editor.setDraft((draft) => ({ ...draft, date: value }))}
            />
          </Field>

          <Field
            label="Location"
            htmlFor="project-location"
            error={editor.fieldErrors.location}
            hint="Optional."
          >
            <TextInput
              id="project-location"
              value={editor.draft.location}
              invalid={Boolean(editor.fieldErrors.location)}
              onChange={(value) =>
                editor.setDraft((draft) => ({ ...draft, location: value }))
              }
            />
          </Field>

          <Field
            label="Image path"
            htmlFor="project-image"
            error={editor.fieldErrors.image}
            hint="Optional. An /uploads path, /assets path or https URL."
          >
            <TextInput
              id="project-image"
              value={editor.draft.image}
              invalid={Boolean(editor.fieldErrors.image)}
              onChange={(value) =>
                editor.setDraft((draft) => ({ ...draft, image: value }))
              }
            />
          </Field>

          <Field
            label="Image description"
            htmlFor="project-image-alt"
            error={editor.fieldErrors.imageAlt}
            hint="Required when an image is set, so screen readers can describe it."
          >
            <TextInput
              id="project-image-alt"
              value={editor.draft.imageAlt}
              invalid={Boolean(editor.fieldErrors.imageAlt)}
              onChange={(value) =>
                editor.setDraft((draft) => ({ ...draft, imageAlt: value }))
              }
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={editor.busy}>
              {editor.busy
                ? 'Saving…'
                : editor.mode === 'edit'
                  ? 'Save changes'
                  : 'Publish project'}
            </Button>
            {editor.mode === 'edit' ? (
              <Button variant="ghost" onClick={() => editor.startCreate(blank())}>
                Cancel edit
              </Button>
            ) : null}
          </div>

          <div className="md:col-span-2 space-y-3">
            <ErrorBanner error={error} />
            <SuccessBanner message={editor.notice ?? removal.notice} />
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle title="Published projects" count={projects.length} />

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-extrabold">Filter</span>
          <button
            type="button"
            onClick={() => setFilter('all')}
            aria-pressed={filter === 'all'}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              filter === 'all' ? 'bg-brand text-white' : 'border border-line'
            }`}
          >
            All
          </button>
          {programmeIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                filter === id ? 'bg-brand text-white' : 'border border-line'
              }`}
            >
              {programmeLabels.get(id) ?? id}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState>
            {projects.length === 0
              ? 'No projects published yet. The public site shows an empty-state message until you publish the first one.'
              : 'No projects in this programme area yet.'}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {visible.map((project) => (
              <li
                key={project.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-[12px] border border-line p-4"
              >
                <div className="min-w-0 grow">
                  <p className="font-extrabold">{project.title}</p>
                  <p className="mt-1 text-sm text-muted">{project.summary}</p>
                  <p className="mt-1.5 text-xs tracking-[0.06em] text-muted uppercase">
                    {project.status} ·{' '}
                    {programmeLabels.get(project.programme) ?? project.programme} ·{' '}
                    <time dateTime={project.date}>{project.date}</time>
                  </p>
                </div>
                <RowActions
                  onEdit={() => editor.startEdit(project.id, toDraft(project))}
                  onDelete={() => void onDelete(project)}
                  deleteLabel={`Delete ${project.title}`}
                  disabled={removal.busy}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
