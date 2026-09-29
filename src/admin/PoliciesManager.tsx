import { useRef, useState } from 'react';

import type { ManagedContent, ManagedPolicy, PolicyInput } from '@shared/schemas';
import * as api from '@/lib/adminApi';
import { useAction, useEditor } from './useEditor';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  NumberInput,
  RowActions,
  SectionTitle,
  SuccessBanner,
  TextArea,
  TextInput,
} from './ui';

const blank = (): PolicyInput => ({
  title: '',
  category: '',
  summary: '',
  file: '',
  date: '',
  bytes: 0,
  order: 0,
});

const toDraft = (policy: ManagedPolicy): PolicyInput => ({
  title: policy.title,
  category: policy.category,
  summary: policy.summary,
  file: policy.file,
  date: policy.date,
  bytes: policy.bytes,
  order: policy.order,
});

const ACCEPT = 'application/pdf';

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes < 1024) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function PoliciesManager({
  content,
  refresh,
}: {
  content: ManagedContent;
  /** Re-reads managed content from the server after a successful write. */
  refresh: () => Promise<boolean>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /**
   * Set once a PDF is on the server but not yet published. Without it the flow
   * looks broken: the file input clears itself, the public section does not
   * change, and nothing says a second click is still required.
   */
  const [staged, setStaged] = useState<{ src: string; name: string } | null>(null);

  const editor = useEditor<PolicyInput>({ blank });
  const removal = useAction();

  const save = async (draft: PolicyInput, id: string | null) =>
    id ? api.updatePolicy(id, draft) : api.createPolicy(draft);

  const onSubmit = async () => {
    const ok = await editor.submit(save, {
      created: 'Policy published.',
      updated: 'Policy updated.',
    });
    if (ok) {
      setStaged(null);
      await refresh();
    }
  };

  /**
   * Uploads the PDF, then stores its path on the draft. The file reaches disk
   * before the policy record exists, so a failure here leaves an orphan file
   * rather than a published document pointing at a missing PDF — the safe
   * direction to fail in, and the orphan is swept by the content reset.
   *
   * The client-supplied filename is never stored: the server names the file, and
   * the operator names the document with the title field. A filename is
   * attacker-controlled and would be a stored path-traversal vector if it were.
   */
  const onPickFile = async (file: File | undefined) => {
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    const result = await api.uploadMedia(file);
    setUploading(false);

    if (!result.ok) {
      setUploadError(result.error.message);
      return;
    }

    setUploadError(null);
    setStaged({ src: result.data.src, name: file.name });
    editor.setDraft((draft) => ({
      ...draft,
      file: result.data.src,
      bytes: result.data.bytes,
    }));

    // Pre-fill the title from the filename on first use only, so a rename never
    // overwrites wording the operator has already corrected.
    editor.setDraft((draft) =>
      draft.title.trim() === ''
        ? { ...draft, title: file.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ') }
        : draft,
    );

    if (fileRef.current) fileRef.current.value = '';
  };

  const onDelete = async (policy: ManagedPolicy) => {
    const confirmed = window.confirm(
      `Delete "${policy.title}"? The uploaded PDF is removed too.`,
    );
    if (!confirmed) return;

    const ok = await removal.run(
      () => api.deletePolicy(policy.id),
      `Deleted "${policy.title}".`,
    );
    if (ok) {
      editor.clearNotice();
      await refresh();
    }
  };

  const policies = content.policies;
  const error = editor.error ?? removal.error;

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title={editor.mode === 'edit' ? 'Edit policy document' : 'Add a policy document'}
          description="Two steps: upload the PDF, then give it a title and choose Publish policy. Published documents appear as download links in the Our Policies section."
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
            <Field
              label="Policy document (PDF)"
              htmlFor="policy-file"
              error={uploadError ?? undefined}
              hint="PDF only. Up to 25MB. Documents are served as a download, never opened inside the site."
            >
              <input
                ref={fileRef}
                id="policy-file"
                type="file"
                accept={ACCEPT}
                aria-invalid={uploadError ? true : undefined}
                aria-describedby={uploadError ? 'policy-file-error' : undefined}
                disabled={uploading}
                onChange={(event) => void onPickFile(event.target.files?.[0])}
                className="w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-[13px] file:font-extrabold file:text-white"
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field
              label="Document path"
              htmlFor="policy-file-path"
              error={editor.fieldErrors.file}
              hint="Filled in by the upload above. Must end in .pdf."
            >
              <TextInput
                id="policy-file-path"
                value={editor.draft.file}
                invalid={Boolean(editor.fieldErrors.file)}
                onChange={(value) => editor.setDraft((draft) => ({ ...draft, file: value }))}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Title" htmlFor="policy-title" error={editor.fieldErrors.title}>
              <TextInput
                id="policy-title"
                value={editor.draft.title}
                invalid={Boolean(editor.fieldErrors.title)}
                onChange={(value) => editor.setDraft((draft) => ({ ...draft, title: value }))}
              />
            </Field>
          </div>

          <Field
            label="Category"
            htmlFor="policy-category"
            error={editor.fieldErrors.category}
            hint="Optional. For example Safeguarding, Child protection, Governance."
          >
            <TextInput
              id="policy-category"
              value={editor.draft.category}
              invalid={Boolean(editor.fieldErrors.category)}
              onChange={(value) =>
                editor.setDraft((draft) => ({ ...draft, category: value }))
              }
            />
          </Field>

          <Field
            label="Adoption or review date"
            htmlFor="policy-date"
            error={editor.fieldErrors.date}
            hint="Optional. Shown as the month and year."
          >
            <TextInput
              id="policy-date"
              type="date"
              value={editor.draft.date}
              invalid={Boolean(editor.fieldErrors.date)}
              onChange={(value) => editor.setDraft((draft) => ({ ...draft, date: value }))}
            />
          </Field>

          <div className="md:col-span-2">
            <Field
              label="Summary"
              htmlFor="policy-summary"
              error={editor.fieldErrors.summary}
              hint="One line on what the document commits to. 300 characters or fewer."
            >
              <TextArea
                id="policy-summary"
                rows={3}
                value={editor.draft.summary}
                invalid={Boolean(editor.fieldErrors.summary)}
                onChange={(value) =>
                  editor.setDraft((draft) => ({ ...draft, summary: value }))
                }
              />
            </Field>
          </div>

          <Field
            label="Display order"
            htmlFor="policy-order"
            error={editor.fieldErrors.order}
            hint="Lower numbers appear first. Default is 0."
          >
            <NumberInput
              id="policy-order"
              value={editor.draft.order}
              invalid={Boolean(editor.fieldErrors.order)}
              onChange={(value) => editor.setDraft((draft) => ({ ...draft, order: value }))}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={editor.busy || uploading}>
              {editor.busy
                ? 'Saving…'
                : editor.mode === 'edit'
                  ? 'Save changes'
                  : 'Publish policy'}
            </Button>
            {editor.mode === 'edit' ? (
              <Button variant="ghost" onClick={() => editor.startCreate(blank())}>
                Cancel edit
              </Button>
            ) : null}
            {uploading ? <span className="text-sm text-muted">Uploading…</span> : null}
          </div>

          <div className="md:col-span-2 space-y-3">
            {staged ? (
              <p
                role="status"
                className="rounded-[10px] border border-brand/30 bg-brand/5 px-3.5 py-3 text-sm text-brand"
              >
                <strong className="font-extrabold">PDF uploaded.</strong> It is not published
                yet. Add a title above, then choose{' '}
                <strong className="font-extrabold">Publish policy</strong> to make it
                downloadable from the site.
              </p>
            ) : null}
            <ErrorBanner error={error} />
            <SuccessBanner message={editor.notice ?? removal.notice} />
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle title="Published policy documents" count={policies.length} />

        {policies.length === 0 ? (
          <EmptyState>
            No policy documents yet. The public site shows an empty-state message until you
            publish the first one.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {policies.map((policy) => {
              const size = formatBytes(policy.bytes);
              return (
                <li
                  key={policy.id}
                  className="flex flex-wrap items-start justify-between gap-4 rounded-[12px] border border-line p-4"
                >
                  <div className="min-w-0 grow">
                    <p className="font-extrabold">{policy.title}</p>
                    <p className="mt-1 text-sm text-muted">
                      {[policy.category, policy.date, size].filter(Boolean).join(' • ')}
                    </p>
                    {policy.summary ? (
                      <p className="mt-1.5 text-[13px] leading-relaxed text-brand-900">
                        {policy.summary}
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-xs tracking-[0.06em] text-muted uppercase">
                      Order: {policy.order}
                    </p>
                    <a
                      href={policy.file}
                      download
                      className="mt-2 inline-block text-[13px] font-extrabold text-brand transition hover:underline"
                    >
                      Open the file to check it downloads
                    </a>
                  </div>
                  <RowActions
                    onEdit={() => editor.startEdit(policy.id, toDraft(policy))}
                    onDelete={() => void onDelete(policy)}
                    deleteLabel={`Delete ${policy.title}`}
                    disabled={removal.busy}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
