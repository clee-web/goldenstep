import { useState } from 'react';

import { programmes as staticProgrammes } from '@shared/content';
import {
  programmeIds,
  type ManagedContent,
  type ProgrammeId,
  type ProgrammeOverrides,
} from '@shared/schemas';
import { mergeProgrammes } from '@/lib/content';
import * as api from '@/lib/adminApi';
import { useAction } from './useEditor';
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  SectionTitle,
  SuccessBanner,
  TextArea,
  TextInput,
} from './ui';

interface ProgrammeDraft {
  name: string;
  summary: string;
  description: string;
  beneficiaries: string;
  highlights: string;
  image: string;
  imageAlt: string;
  caption: string;
}

/** The editable surface for one programme, resolved against any live overrides. */
function toDraft(id: ProgrammeId, overrides: ProgrammeOverrides): ProgrammeDraft {
  const merged = mergeProgrammes(overrides).find((item) => item.id === id);
  const base = merged ?? staticProgrammes.find((item) => item.id === id);
  return {
    name: base?.name ?? '',
    summary: base?.summary ?? '',
    description: base?.description ?? '',
    beneficiaries: String(base?.beneficiaries ?? 0),
    highlights: (base?.highlights ?? []).join('\n'),
    image: base?.image ?? '',
    imageAlt: base?.imageAlt ?? '',
    caption: base?.caption ?? '',
  };
}

const blankDraft = (id: ProgrammeId, overrides: ProgrammeOverrides): ProgrammeDraft =>
  toDraft(id, overrides);

export function ProgrammesManager({
  content,
  refresh,
}: {
  content: ManagedContent;
  /** Re-reads managed content from the server after a successful write. */
  refresh: () => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<ProgrammeId>(programmeIds[0]);
  const [draft, setDraft] = useState<ProgrammeDraft>(() =>
    blankDraft(selected, content.programmes),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const action = useAction();

  const select = (id: ProgrammeId) => {
    setSelected(id);
    setDraft(blankDraft(id, content.programmes));
    setFieldErrors({});
    setError(null);
  };

  const set = <K extends keyof ProgrammeDraft>(key: K, value: ProgrammeDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  /**
   * Only the fields the operator actually touched are sent, so editing one
   * value can never blank the others. Empty text fields are dropped for the
   * same reason: a blank string is not a valid value for most of them.
   */
  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (action.busy) return;

    const original = toDraft(selected, content.programmes);
    const patch: ProgrammeOverrides[ProgrammeId] = {};

    if (draft.name !== original.name && draft.name.trim()) patch.name = draft.name.trim();
    if (draft.summary !== original.summary && draft.summary.trim())
      patch.summary = draft.summary.trim();
    if (draft.description !== original.description && draft.description.trim())
      patch.description = draft.description.trim();
    if (draft.image !== original.image) patch.image = draft.image.trim();
    if (draft.imageAlt !== original.imageAlt) patch.imageAlt = draft.imageAlt.trim();
    if (draft.caption !== original.caption && draft.caption.trim())
      patch.caption = draft.caption.trim();
    if (draft.beneficiaries !== original.beneficiaries) {
      const parsed = Number(draft.beneficiaries);
      if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        setFieldErrors({ beneficiaries: 'Enter a whole number of people, or 0.' });
        return;
      }
      patch.beneficiaries = parsed;
    }
    if (draft.highlights !== original.highlights) {
      patch.highlights = draft.highlights
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }

    if (Object.keys(patch).length === 0) {
      setError('Nothing has changed yet.');
      return;
    }

    setFieldErrors({});
    setError(null);

    const ok = await action.run(
      () => api.patchProgramme(selected, patch),
      'Programme saved.',
      (apiError) => {
        // Field-level failures (e.g. a new image with no description) are shown
        // against the input rather than as a generic banner.
        if (apiError.fields) {
          setFieldErrors(apiError.fields);
          return null;
        }
        return apiError.message;
      },
    );
    if (ok) await refresh();
  };

  const merged = mergeProgrammes(content.programmes);
  const overridden = Object.keys(content.programmes);

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title="Programmes"
          description="Edits here change the programme cards, the detail panel, the gallery and the impact figures."
        />

        <div className="mb-6 flex flex-wrap gap-2">
          {programmeIds.map((id) => {
            const name = merged.find((item) => item.id === id)?.name ?? id;
            const isEdited = overridden.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => select(id)}
                aria-pressed={selected === id}
                className={`rounded-full px-3.5 py-2 text-[13px] font-bold ${
                  selected === id
                    ? 'bg-brand text-white'
                    : 'border border-line bg-white hover:border-brand'
                }`}
              >
                {name}
                {isEdited ? <span className="ml-1.5 text-coral">●</span> : null}
                {isEdited ? <span className="sr-only"> (edited)</span> : null}
              </button>
            );
          })}
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit} noValidate>
          <Field label="Name" htmlFor="programme-name" error={fieldErrors.name}>
            <TextInput
              id="programme-name"
              value={draft.name}
              invalid={Boolean(fieldErrors.name)}
              onChange={(value) => set('name', value)}
            />
          </Field>

          <Field
            label="Beneficiaries"
            htmlFor="programme-beneficiaries"
            error={fieldErrors.beneficiaries}
            hint="Shown in the impact figures and summed into the headline total."
          >
            <TextInput
              id="programme-beneficiaries"
              type="number"
              min={0}
              step={1}
              value={draft.beneficiaries}
              invalid={Boolean(fieldErrors.beneficiaries)}
              onChange={(value) => set('beneficiaries', value)}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Card summary" htmlFor="programme-summary" error={fieldErrors.summary}>
              <TextInput
                id="programme-summary"
                value={draft.summary}
                invalid={Boolean(fieldErrors.summary)}
                onChange={(value) => set('summary', value)}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field
              label="Full description"
              htmlFor="programme-description"
              error={fieldErrors.description}
            >
              <TextArea
                id="programme-description"
                rows={4}
                value={draft.description}
                invalid={Boolean(fieldErrors.description)}
                onChange={(value) => set('description', value)}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field
              label="Highlights"
              htmlFor="programme-highlights"
              error={fieldErrors.highlights}
              hint="One per line, up to six."
            >
              <TextArea
                id="programme-highlights"
                rows={4}
                value={draft.highlights}
                invalid={Boolean(fieldErrors.highlights)}
                onChange={(value) => set('highlights', value)}
              />
            </Field>
          </div>

          <Field
            label="Image path"
            htmlFor="programme-image"
            error={fieldErrors.image}
            hint="An /uploads path, /assets path or https URL."
          >
            <TextInput
              id="programme-image"
              value={draft.image}
              invalid={Boolean(fieldErrors.image)}
              onChange={(value) => set('image', value)}
            />
          </Field>

          <Field
            label="Image description"
            htmlFor="programme-image-alt"
            error={fieldErrors.imageAlt}
            hint="Required whenever the image is changed."
          >
            <TextInput
              id="programme-image-alt"
              value={draft.imageAlt}
              invalid={Boolean(fieldErrors.imageAlt)}
              onChange={(value) => set('imageAlt', value)}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Caption" htmlFor="programme-caption" error={fieldErrors.caption}>
              <TextInput
                id="programme-caption"
                value={draft.caption}
                invalid={Boolean(fieldErrors.caption)}
                onChange={(value) => set('caption', value)}
              />
            </Field>
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={action.busy}>
              {action.busy ? 'Saving…' : 'Save programme'}
            </Button>
            {overridden.length > 0 ? (
              <span className="text-sm text-muted">
                {overridden.length} programme{overridden.length === 1 ? '' : 's'} edited
              </span>
            ) : null}
          </div>

          <div className="md:col-span-2 space-y-3">
            <ErrorBanner
              error={
                error || action.error
                  ? { ok: false, error: 'server_error', message: error ?? action.error?.message ?? '' }
                  : null
              }
            />
            <SuccessBanner message={action.notice} />
          </div>
        </form>
      </Card>
    </div>
  );
}
