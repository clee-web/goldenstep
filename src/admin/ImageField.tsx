import { useRef, useState } from 'react';

import * as api from '@/lib/adminApi';
import { Field, TextInput } from './ui';

/**
 * Images only. The gallery has its own field because it must also accept video
 * and caption tracks, but everywhere else an image field that silently accepted
 * a video would store a `.mp4` where the site renders an `<img>`, producing a
 * broken image with no error anywhere.
 */
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif';

/** Shared by the file inputs so every manager looks and behaves the same. */
const fileInputClass =
  'w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-[13px] file:font-extrabold file:text-white';

/**
 * An image field with a file picker, a preview, and the alt text that has to
 * travel with it.
 *
 * The picker is the primary control. Typing a path is still possible behind the
 * "use an existing path" disclosure, because two real cases need it: an image
 * already in `public/assets` that should not be re-uploaded, and a photograph
 * hosted on a CDN. Removing the box entirely would mean re-uploading existing
 * assets and losing the option of an external URL, so it is kept but demoted —
 * nothing in the normal flow requires typing anything.
 *
 * The alt text is folded into this component rather than sitting in a separate
 * field next to it, because the two are one decision: the server rejects an
 * image with no description, and an operator filling in alt text in a field
 * across the row from the photo is how that check gets discovered by accident.
 */
export function ImageField({
  id,
  label,
  value,
  onChange,
  altValue,
  onAltChange,
  error,
  altError,
  onBusyChange,
}: {
  id: string;
  label: string;
  /** The stored path. Empty means no image is set. */
  value: string;
  onChange: (path: string) => void;
  /**
   * Omitted for a decorative image that is not described on its own — the video
   * poster, which is covered by the video's own alt text. Every other caller
   * passes both, because the server refuses an image with no description.
   */
  altValue?: string;
  onAltChange?: (value: string) => void;
  /** Validation error for the path, from the save response. */
  error?: string;
  /** Validation error for the alt text, from the save response. */
  altError?: string;
  /**
   * Reports upload progress so the caller can disable its submit button. Without
   * it the operator can save mid-upload and publish a record pointing at an
   * image that was never written.
   */
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const setBusy = (busy: boolean) => {
    setUploading(busy);
    onBusyChange?.(busy);
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;

    setBusy(true);
    setUploadError(null);
    const result = await api.uploadMedia(file);
    setBusy(false);

    if (!result.ok) {
      setUploadError(result.error.message);
      return;
    }

    /*
     * `accept` already filters the picker, but a file can still arrive with a
     * misleading extension or from a drag-and-drop. The server accepts video and
     * documents on this one route, so the kind is checked here rather than
     * trusting the client to have honoured `accept`.
     */
    if (result.data.kind !== 'image') {
      setUploadError(`"${file.name}" is not an image. Choose a JPEG, PNG, WebP, AVIF or GIF file.`);
      return;
    }

    setUploadError(null);
    onChange(result.data.src);

    // Clears the native control so re-picking the same file fires `change`
    // again. Without this, replacing a photo with a corrected one silently does
    // nothing and the form looks broken.
    if (inputRef.current) inputRef.current.value = '';
  };

  /**
   * Removes the image and its description together. Leaving the alt text behind
   * would publish a description for a photograph that is no longer there, and
   * re-attaching a different image would then inherit it.
   */
  const clear = () => {
    onChange('');
    onAltChange?.('');
    setUploadError(null);
  };

  return (
    <div className="md:col-span-2 space-y-4 rounded-[12px] border border-line bg-cream/40 p-4">
      <Field
        label={label}
        htmlFor={`${id}-file`}
        error={uploadError ?? undefined}
        hint="JPEG, PNG, WebP, AVIF or GIF, up to 8 MB. The file is uploaded when you choose it and the path is filled in for you."
      >
        <input
          ref={inputRef}
          id={`${id}-file`}
          type="file"
          accept={ACCEPT}
          aria-invalid={uploadError ? true : undefined}
          aria-describedby={uploadError ? `${id}-file-error` : undefined}
          disabled={uploading}
          onChange={(event) => void onPick(event.target.files?.[0])}
          className={fileInputClass}
        />
      </Field>

      {value ? (
        <div className="flex flex-wrap items-start gap-4">
          <img
            src={value}
            /* When a description is being collected, it describes this very
               image, so the preview is not separate content. Without one the
               alt is empty and the preview is marked decorative instead. */
            alt={altValue ?? ''}
            aria-hidden={altValue ? undefined : true}
            className="h-28 w-40 rounded-[10px] border border-line bg-white object-cover"
          />
          <div className="min-w-[12rem] flex-1 space-y-3">
            <p className="break-all font-mono text-xs text-muted">{value}</p>
            <button
              type="button"
              onClick={clear}
              disabled={uploading}
              className="rounded-full border border-coral/50 bg-white px-3.5 py-1.5 text-[13px] font-extrabold text-coral transition hover:bg-coral/8 disabled:opacity-50"
            >
              Remove image
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">
          No image chosen. This field is optional — leave it empty to publish
          without a photograph.
        </p>
      )}

      {onAltChange ? (
        <Field
          label="Image description"
          htmlFor={`${id}-alt`}
          error={altError}
          hint="Required whenever an image is set. Describe what is in the picture for someone who cannot see it."
        >
          <TextInput
            id={`${id}-alt`}
            value={altValue ?? ''}
            invalid={Boolean(altError)}
            disabled={uploading}
            onChange={onAltChange}
          />
        </Field>
      ) : null}

      {/*
        Escape hatch, not part of the normal flow. `<details>` rather than a
        toggle button so it works without JavaScript and needs no aria state to
        keep in sync.
      */}
      <details className="text-sm">
        <summary className="cursor-pointer text-[13px] font-extrabold text-brand-900">
          Use an existing path instead
        </summary>
        <div className="mt-3">
          <Field
            label="Image path"
            htmlFor={`${id}-path`}
            error={error}
            hint="For an image already in /assets, or a photograph hosted elsewhere. An /uploads path, /assets path or https URL."
          >
            <TextInput
              id={`${id}-path`}
              value={value}
              invalid={Boolean(error)}
              onChange={onChange}
              placeholder="/assets/example.jpg"
            />
          </Field>
        </div>
      </details>
    </div>
  );
}
