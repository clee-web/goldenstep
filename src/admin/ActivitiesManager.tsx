import { useState } from 'react';

import {
  type ActivityInput,
  type ManagedActivity,
  type ManagedContent,
} from '@shared/schemas';
import * as api from '@/lib/adminApi';
import { ImageField } from './ImageField';
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

const KINDS = ['Outreach', 'Training', 'Partnership', 'Milestone'] as const;

const blank = (): ActivityInput => ({
  title: '',
  description: '',
  kind: 'Outreach',
  date: new Date().toISOString().slice(0, 10),
  image: '',
  imageAlt: '',
});

const toDraft = (activity: ManagedActivity): ActivityInput => ({
  title: activity.title,
  description: activity.description,
  kind: activity.kind,
  date: activity.date,
  image: activity.image,
  imageAlt: activity.imageAlt,
});

export function ActivitiesManager({
  content,
  refresh,
}: {
  content: ManagedContent;
  /** Re-reads managed content from the server after a successful write. */
  refresh: () => Promise<boolean>;
}) {
  const editor = useEditor<ActivityInput>({
    blank,
    onError: (error) =>
      error.error === 'not_found'
        ? 'That update no longer exists. Reload the dashboard and try again.'
        : error.message,
  });

  const removal = useAction();
  /** Lets the submit button be disabled while a file is uploading. */
  const [uploading, setUploading] = useState(false);

  const save = async (draft: ActivityInput, id: string | null) =>
    id ? api.updateActivity(id, draft) : api.createActivity(draft);

  const onSubmit = async () => {
    const ok = await editor.submit(save, {
      created: 'Update published.',
      updated: 'Update saved.',
    });
    if (ok) await refresh();
  };

  const onDelete = async (activity: ManagedActivity) => {
    const confirmed = window.confirm(`Delete “${activity.title}”? This cannot be undone.`);
    if (!confirmed) return;
    const ok = await removal.run(
      () => api.deleteActivity(activity.id),
      `Deleted “${activity.title}”.`,
    );
    if (ok) {
      editor.clearNotice();
      await refresh();
    }
  };

  const activities = content.activities;
  const error = editor.error ?? removal.error;

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title={editor.mode === 'edit' ? 'Edit update' : 'New update'}
          description="Short activity notes shown in the From the field chapter."
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
            <Field label="Headline" htmlFor="activity-title" error={editor.fieldErrors.title}>
              <TextInput
                id="activity-title"
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
              label="Description"
              htmlFor="activity-description"
              error={editor.fieldErrors.description}
              hint="10–400 characters."
            >
              <TextArea
                id="activity-description"
                value={editor.draft.description}
                invalid={Boolean(editor.fieldErrors.description)}
                onChange={(value) =>
                  editor.setDraft((draft) => ({ ...draft, description: value }))
                }
              />
            </Field>
          </div>

          <Field label="Type" htmlFor="activity-kind" error={editor.fieldErrors.kind}>
            <Select
              id="activity-kind"
              value={editor.draft.kind}
              invalid={Boolean(editor.fieldErrors.kind)}
              options={KINDS.map((kind) => ({ value: kind, label: kind }))}
              onChange={(value) =>
                editor.setDraft((draft) => ({
                  ...draft,
                  kind: value as ActivityInput['kind'],
                }))
              }
            />
          </Field>

          <Field label="Date" htmlFor="activity-date" error={editor.fieldErrors.date}>
            <TextInput
              id="activity-date"
              type="date"
              value={editor.draft.date}
              invalid={Boolean(editor.fieldErrors.date)}
              onChange={(value) => editor.setDraft((draft) => ({ ...draft, date: value }))}
            />
          </Field>

          <ImageField
            id="activity-image"
            label="Photograph"
            value={editor.draft.image}
            onChange={(value) =>
              editor.setDraft((draft) => ({ ...draft, image: value }))
            }
            altValue={editor.draft.imageAlt}
            onAltChange={(value) =>
              editor.setDraft((draft) => ({ ...draft, imageAlt: value }))
            }
            error={editor.fieldErrors.image}
            altError={editor.fieldErrors.imageAlt}
            onBusyChange={setUploading}
          />

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={editor.busy || uploading}>
              {editor.busy ? 'Saving…' : editor.mode === 'edit' ? 'Save changes' : 'Publish update'}
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
        <SectionTitle title="Published updates" count={activities.length} />

        {activities.length === 0 ? (
          <EmptyState>
            No activity published yet. Add the first update from this form.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {activities.map((activity) => (
              <li
                key={activity.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-[12px] border border-line p-4"
              >
                <div className="min-w-0 grow">
                  <p className="font-extrabold">{activity.title}</p>
                  <p className="mt-1 text-sm text-muted">{activity.description}</p>
                  <p className="mt-1.5 text-xs tracking-[0.06em] text-muted uppercase">
                    {activity.kind} · <time dateTime={activity.date}>{activity.date}</time>
                  </p>
                </div>
                <RowActions
                  onEdit={() => editor.startEdit(activity.id, toDraft(activity))}
                  onDelete={() => void onDelete(activity)}
                  deleteLabel={`Delete ${activity.title}`}
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
