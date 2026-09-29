import { useRef, useState } from 'react';

import type { ManagedContent, PictureInput } from '@shared/schemas';
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
  SuccessBanner,
  TextInput,
} from './ui';

const blank = (): PictureInput => ({
  src: '',
  alt: '',
  tag: '',
  caption: '',
  poster: '',
  captionsSrc: '',
});

const toDraft = (picture: PictureInput) => ({ ...picture });

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm';
const ACCEPT_CAPTIONS = 'text/vtt';

/**
 * Same rule the gallery uses, so the form reveals the captions field at the
 * moment the video path lands rather than after a rejected save.
 */
const isVideoSrc = (src: string): boolean => /\.(mp4|webm|m4v)$/i.test(src.split(/[?#]/)[0]);

export function PicturesManager({
  content,
  refresh,
}: {
  content: ManagedContent;
  /** Re-reads managed content from the server after a successful write. */
  refresh: () => Promise<boolean>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const captionsRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /**
   * Set once a file is on the server but not yet published as a picture. Without
   * it the flow looks broken: the file input clears itself, the gallery does not
   * change, and nothing says a second click is still required.
   */
  const [staged, setStaged] = useState<string | null>(null);

  const editor = useEditor<PictureInput>({ blank });
  const removal = useAction();

  const save = async (draft: PictureInput, id: string | null) =>
    id ? api.updatePicture(id, draft) : api.createPicture(draft);

  const onSubmit = async () => {
    const ok = await editor.submit(save, {
      created: 'Picture added to the gallery.',
      updated: 'Picture updated.',
    });
    if (ok) {
      setStaged(null);
      await refresh();
    }
  };

  /**
   * Uploads first, then stores the returned path on the draft. The file is
   * written to disk before the picture record exists, so a failure here leaves
   * an orphan file rather than a picture pointing at a missing image.
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
    setStaged(result.data.src);
    editor.setDraft((draft) => {
      const uploaded = { ...draft, src: result.data.src };
      /*
       * A .vtt upload is a caption track, not a gallery entry, so it fills the
       * captions field rather than replacing the media on the draft. That is the
       * only thing a visitor would ever upload alongside a video.
       */
      if (result.data.kind === 'image' || /\.(mp4|webm|m4v)$/i.test(file.name)) {
        return uploaded;
      }
      return { ...uploaded, captionsSrc: result.data.src, src: draft.src };
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  /** Uploads a WebVTT file and points the draft's captions field at it. */
  const onPickCaptions = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const result = await api.uploadMedia(file);
    setUploading(false);
    if (!result.ok) {
      setUploadError(result.error.message);
      return;
    }
    editor.setDraft((draft) => ({ ...draft, captionsSrc: result.data.src }));
    if (captionsRef.current) captionsRef.current.value = '';
  };

  const onDelete = async (id: string, label: string) => {
    if (!window.confirm(`Delete “${label}”? The uploaded file is removed too.`)) return;
    const ok = await removal.run(() => api.deletePicture(id), `Deleted “${label}”.`);
    if (ok) {
      editor.clearNotice();
      await refresh();
    }
  };

  const pictures = content.pictures;
  const error = editor.error ?? removal.error;

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title={editor.mode === 'edit' ? 'Edit picture' : 'Add a picture'}
          description="Two steps: choose a file to upload it, then add alt text and a label and choose Add picture to publish it to the Stories gallery."
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
              label="Media file"
              htmlFor="picture-file"
              error={uploadError ?? undefined}
              hint="Photograph: JPEG, PNG, WebP, AVIF or GIF. Video: MP4 or WebM. A .vtt file uploads as the captions track for the video already chosen below."
            >
              <input
                ref={fileRef}
                id="picture-file"
                type="file"
                accept={ACCEPT}
                aria-invalid={uploadError ? true : undefined}
                aria-describedby={uploadError ? 'picture-file-error' : undefined}
                disabled={uploading}
                onChange={(event) => void onPickFile(event.target.files?.[0])}
                className="w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-[13px] file:font-extrabold file:text-white"
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field
              label="Media path"
              htmlFor="picture-src"
              error={editor.fieldErrors.src}
              hint="Filled in automatically by the upload. An /uploads path, /assets path or https URL."
            >
              <TextInput
                id="picture-src"
                value={editor.draft.src}
                invalid={Boolean(editor.fieldErrors.src)}
                onChange={(value) => editor.setDraft((draft) => ({ ...draft, src: value }))}
              />
            </Field>
          </div>

          {editor.draft.src ? (
            <div className="md:col-span-2">
              {isVideoSrc(editor.draft.src) ? (
                <video
                  src={editor.draft.src}
                  controls
                  preload="metadata"
                  playsInline
                  poster={editor.draft.poster || undefined}
                  aria-label="Preview of the video being added"
                  className="h-48 w-full rounded-[12px] border border-line bg-cream object-cover"
                />
              ) : (
                <img
                  src={editor.draft.src}
                  alt="Preview of the picture being added"
                  className="h-48 w-full rounded-[12px] border border-line bg-cream object-cover"
                />
              )}
            </div>
          ) : null}

          {isVideoSrc(editor.draft.src) ? (
            <>
              <div className="md:col-span-2">
                <Field
                  label="Captions track (.vtt)"
                  htmlFor="picture-captions-file"
                  hint="Required for every video — without one the video cannot be published, because uncaptioned video fails WCAG 1.2.2."
                >
                  <input
                    ref={captionsRef}
                    id="picture-captions-file"
                    type="file"
                    accept={ACCEPT_CAPTIONS}
                    disabled={uploading}
                    onChange={(event) => void onPickCaptions(event.target.files?.[0])}
                    className="w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-[13px] file:font-extrabold file:text-white"
                  />
                </Field>
              </div>

              <div className="md:col-span-2">
                <Field
                  label="Captions path"
                  htmlFor="picture-captions-src"
                  error={editor.fieldErrors.captionsSrc}
                  hint="Filled in by the upload above. Must end in .vtt."
                >
                  <TextInput
                    id="picture-captions-src"
                    value={editor.draft.captionsSrc}
                    invalid={Boolean(editor.fieldErrors.captionsSrc)}
                    onChange={(value) =>
                      editor.setDraft((draft) => ({ ...draft, captionsSrc: value }))
                    }
                  />
                </Field>
              </div>

              <div className="md:col-span-2">
                <Field
                  label="Poster image"
                  htmlFor="picture-poster"
                  error={editor.fieldErrors.poster}
                  hint="The still shown before the video plays. Without one the player opens on a black rectangle. Upload a photograph above, then paste its path here."
                >
                  <TextInput
                    id="picture-poster"
                    value={editor.draft.poster}
                    invalid={Boolean(editor.fieldErrors.poster)}
                    onChange={(value) =>
                      editor.setDraft((draft) => ({ ...draft, poster: value }))
                    }
                  />
                </Field>
              </div>
            </>
          ) : null}

          <Field
            label={isVideoSrc(editor.draft.src) ? 'Video description' : 'Alt text'}
            htmlFor="picture-alt"
            error={editor.fieldErrors.alt}
            hint="Describe what is in the media for screen readers. For a video this becomes the player's accessible name."
          >
            <TextInput
              id="picture-alt"
              value={editor.draft.alt}
              invalid={Boolean(editor.fieldErrors.alt)}
              onChange={(value) => editor.setDraft((draft) => ({ ...draft, alt: value }))}
            />
          </Field>

          <Field label="Label" htmlFor="picture-tag" error={editor.fieldErrors.tag}>
            <TextInput
              id="picture-tag"
              value={editor.draft.tag}
              invalid={Boolean(editor.fieldErrors.tag)}
              onChange={(value) => editor.setDraft((draft) => ({ ...draft, tag: value }))}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Caption" htmlFor="picture-caption" error={editor.fieldErrors.caption}>
              <TextInput
                id="picture-caption"
                value={editor.draft.caption}
                invalid={Boolean(editor.fieldErrors.caption)}
                onChange={(value) =>
                  editor.setDraft((draft) => ({ ...draft, caption: value }))
                }
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={editor.busy || uploading}>
              {editor.busy ? 'Saving…' : editor.mode === 'edit' ? 'Save changes' : 'Add picture'}
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
                <strong className="font-extrabold">Photo uploaded.</strong> It is not in the
                gallery yet. Add alt text and a label below, then choose{' '}
                <strong className="font-extrabold">Add picture</strong> to publish it.
              </p>
            ) : null}
            <ErrorBanner error={error} />
            <SuccessBanner message={editor.notice ?? removal.notice} />
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle
          title="Gallery pictures"
          count={pictures.length}
          description="The six programme photographs are part of the site content and are not listed here."
        />

        {pictures.length === 0 ? (
          <EmptyState>
            No extra pictures yet. Uploading one adds it to the Stories gallery.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {pictures.map((picture) => (
              <li key={picture.id} className="rounded-[12px] border border-line p-4">
                {isVideoSrc(picture.src) ? (
                  <video
                    src={picture.src}
                    controls
                    preload="none"
                    playsInline
                    poster={picture.poster || undefined}
                    aria-label={`Video: ${picture.tag}`}
                    className="h-40 w-full rounded-[10px] bg-cream object-cover"
                  />
                ) : (
                  <img
                    src={picture.src}
                    alt={picture.alt}
                    loading="lazy"
                    className="h-40 w-full rounded-[10px] bg-cream object-cover"
                  />
                )}
                <p className="mt-3 font-extrabold">{picture.tag}</p>
                <p className="mt-1 text-sm text-muted">{picture.caption}</p>
                <p className="mt-1.5 text-xs text-muted">{picture.alt}</p>
                <div className="mt-3">
                  <RowActions
                    onEdit={() => editor.startEdit(picture.id, toDraft(picture))}
                    onDelete={() => void onDelete(picture.id, picture.tag)}
                    deleteLabel={`Delete ${picture.tag}`}
                    disabled={removal.busy}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
