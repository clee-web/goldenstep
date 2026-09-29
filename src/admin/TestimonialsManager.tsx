import { useState } from 'react';

import {
  type ManagedContent,
  type ManagedTestimonial,
  type TestimonialInput,
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
  NumberInput,
  RowActions,
  SectionTitle,
  SuccessBanner,
  TextArea,
  TextInput,
} from './ui';

const blank = (): TestimonialInput => ({
  name: '',
  role: '',
  testimonial: '',
  image: '',
  imageAlt: '',
  order: 0,
});

const toDraft = (testimonial: ManagedTestimonial): TestimonialInput => ({
  name: testimonial.name,
  role: testimonial.role,
  testimonial: testimonial.testimonial,
  image: testimonial.image,
  imageAlt: testimonial.imageAlt,
  order: testimonial.order,
});

export function TestimonialsManager({
  content,
  refresh,
}: {
  content: ManagedContent;
  /** Re-reads managed content from the server after a successful write. */
  refresh: () => Promise<boolean>;
}) {
  const editor = useEditor<TestimonialInput>({
    blank,
    onError: (error) =>
      error.error === 'not_found'
        ? 'That testimonial no longer exists. Reload the dashboard and try again.'
        : error.message,
  });

  const removal = useAction();
  /** Lets the submit button be disabled while a file is uploading. */
  const [uploading, setUploading] = useState(false);

  const testimonials = content.testimonials;

  const save = async (draft: TestimonialInput, id: string | null) =>
    id ? api.updateTestimonial(id, draft) : api.createTestimonial(draft);

  /**
   * Every successful write re-reads the server rather than patching local state,
   * so the list can never disagree with what the public site will render.
   */
  const onSubmit = async () => {
    const ok = await editor.submit(save, {
      created: 'Testimonial published.',
      updated: 'Testimonial updated.',
    });
    if (ok) await refresh();
  };

  const onDelete = async (testimonial: ManagedTestimonial) => {
    const confirmed = window.confirm(
      `Delete the testimonial from "${testimonial.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    const ok = await removal.run(
      () => api.deleteTestimonial(testimonial.id),
      `Deleted the testimonial from "${testimonial.name}".`,
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
          title={editor.mode === 'edit' ? 'Edit testimonial' : 'New testimonial'}
          description="Published testimonials appear in the Voices of change section on the public site."
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
            <Field label="Name" htmlFor="testimonial-name" error={editor.fieldErrors.name}>
              <TextInput
                id="testimonial-name"
                value={editor.draft.name}
                invalid={Boolean(editor.fieldErrors.name)}
                onChange={(value) =>
                  editor.setDraft((draft) => ({ ...draft, name: value }))
                }
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Role" htmlFor="testimonial-role" error={editor.fieldErrors.role}>
              <TextInput
                id="testimonial-role"
                value={editor.draft.role}
                invalid={Boolean(editor.fieldErrors.role)}
                onChange={(value) =>
                  editor.setDraft((draft) => ({ ...draft, role: value }))
                }
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field
              label="Testimonial"
              htmlFor="testimonial-quote"
              error={editor.fieldErrors.testimonial}
              hint="Their words, in their own voice, 10–800 characters."
            >
              <TextArea
                id="testimonial-quote"
                rows={5}
                value={editor.draft.testimonial}
                invalid={Boolean(editor.fieldErrors.testimonial)}
                onChange={(value) =>
                  editor.setDraft((draft) => ({ ...draft, testimonial: value }))
                }
              />
            </Field>
          </div>

          <Field
            label="Display order"
            htmlFor="testimonial-order"
            error={editor.fieldErrors.order}
            hint="Lower numbers appear first. Default is 0."
          >
            <NumberInput
              id="testimonial-order"
              value={editor.draft.order}
              invalid={Boolean(editor.fieldErrors.order)}
              onChange={(value) =>
                editor.setDraft((draft) => ({ ...draft, order: value }))
              }
            />
          </Field>

          <ImageField
            id="testimonial-image"
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
              {editor.busy
                ? 'Saving…'
                : editor.mode === 'edit'
                  ? 'Save changes'
                  : 'Publish testimonial'}
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
        <SectionTitle title="Published testimonials" count={testimonials.length} />

        {testimonials.length === 0 ? (
          <EmptyState>
            No testimonials published yet. The public site shows an empty-state message until you publish the first one.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {testimonials.map((testimonial) => (
              <li
                key={testimonial.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-[12px] border border-line p-4"
              >
                <div className="min-w-0 grow">
                  <p className="font-extrabold">{testimonial.name}</p>
                  <p className="mt-1 text-sm text-muted">{testimonial.role}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-brand-900 italic">
                    &ldquo;{testimonial.testimonial}&rdquo;
                  </p>
                  <p className="mt-1.5 text-xs tracking-[0.06em] text-muted uppercase">
                    Order: {testimonial.order}
                  </p>
                </div>
                <RowActions
                  onEdit={() => editor.startEdit(testimonial.id, toDraft(testimonial))}
                  onDelete={() => void onDelete(testimonial)}
                  deleteLabel={`Delete testimonial from ${testimonial.name}`}
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
