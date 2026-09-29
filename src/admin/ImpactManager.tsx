import { useState } from 'react';

import { impact as staticImpact } from '@shared/content';
import type { ImpactPatch, ManagedContent } from '@shared/schemas';
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

/** Concrete draft: every field is a string, so the inputs are always controlled. */
interface ImpactDraft {
  lead: string;
  totalLabel: string;
  totalCaption: string;
}

export function ImpactManager({
  content,
  refresh,
}: {
  content: ManagedContent;
  /** Re-reads managed content from the server after a successful write. */
  refresh: () => Promise<boolean>;
}) {
  const patch = content.impact;
  const [draft, setDraft] = useState<ImpactDraft>(() => ({
    lead: patch.lead ?? '',
    totalLabel: patch.totalLabel ?? '',
    totalCaption: patch.totalCaption ?? '',
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const action = useAction();

  const set = (key: keyof ImpactDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (action.busy) return;

    /** Only changed, non-blank fields are sent, matching the sparse patch API. */
    const next: ImpactPatch = {};
    if (draft.lead !== (patch.lead ?? '') && draft.lead.trim()) next.lead = draft.lead.trim();
    if (draft.totalLabel !== (patch.totalLabel ?? '') && draft.totalLabel.trim())
      next.totalLabel = draft.totalLabel.trim();
    if (draft.totalCaption !== (patch.totalCaption ?? '') && draft.totalCaption.trim())
      next.totalCaption = draft.totalCaption.trim();

    if (Object.keys(next).length === 0) {
      setLocalError('Nothing has changed yet.');
      return;
    }

    setFieldErrors({});
    setLocalError(null);
    const ok = await action.run(() => api.patchImpact(next), 'Impact figures updated.');
    if (ok) await refresh();
  };

  return (
    <Card>
      <SectionTitle
        title="Impact figures"
        description="Labels and the lead paragraph around the impact numbers. The numbers themselves are the per-programme beneficiary counts."
      />

      <form className="grid gap-4" onSubmit={onSubmit} noValidate>
        <Field
          label="Lead paragraph"
          htmlFor="impact-lead"
          error={fieldErrors.lead}
          hint="Leave blank to keep the current wording. 10–400 characters."
        >
          <TextArea
            id="impact-lead"
            value={draft.lead}
            invalid={Boolean(fieldErrors.lead)}
            onChange={(value) => set('lead', value)}
          />
        </Field>

        <Field
          label="Headline label"
          htmlFor="impact-total-label"
          error={fieldErrors.totalLabel}
          hint={`Currently: ${staticImpact.totalLabel}`}
        >
          <TextInput
            id="impact-total-label"
            value={draft.totalLabel}
            invalid={Boolean(fieldErrors.totalLabel)}
            onChange={(value) => set('totalLabel', value)}
          />
        </Field>

        <Field
          label="Headline caption"
          htmlFor="impact-total-caption"
          error={fieldErrors.totalCaption}
          hint={`Currently: ${staticImpact.totalCaption}`}
        >
          <TextInput
            id="impact-total-caption"
            value={draft.totalCaption}
            invalid={Boolean(fieldErrors.totalCaption)}
            onChange={(value) => set('totalCaption', value)}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={action.busy}>
            {action.busy ? 'Saving…' : 'Save impact copy'}
          </Button>
        </div>

        <div className="space-y-3">
          <ErrorBanner
            error={
              localError || action.error
                ? {
                    ok: false,
                    error: 'server_error',
                    message: localError ?? action.error?.message ?? '',
                  }
                : null
            }
          />
          <SuccessBanner message={action.notice} />
        </div>
      </form>
    </Card>
  );
}
