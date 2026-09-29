import { useCallback, useState } from 'react';

import type { ApiError } from '@shared/schemas';
import type { AdminResult } from '@/lib/adminApi';

export type EditorMode = 'create' | 'edit';

export interface EditorState<T> {
  mode: EditorMode;
  /** Id of the record being edited; null while creating. */
  id: string | null;
  draft: T;
  setDraft: (updater: (current: T) => T) => void;
  reset: (draft: T) => void;
  startCreate: (blank: T) => void;
  startEdit: (id: string, draft: T) => void;
  cancel: () => void;
  /** True when the create form is showing a draft the operator has typed into. */
  busy: boolean;
  error: ApiError | null;
  fieldErrors: Record<string, string>;
  notice: string | null;
  submit: (
    run: (draft: T, id: string | null) => Promise<AdminResult<unknown>>,
    messages: { created: string; updated: string },
  ) => Promise<boolean>;
  clearNotice: () => void;
}

export interface EditorOptions<T> {
  blank: () => T;
  /**
   * Maps a save failure onto a friendly message. The API's `not_found` case is
   * almost always a stale tab, so it gets its own wording.
   */
  onError?: (error: ApiError) => string;
}

/**
 * Shared create/edit/delete state for the dashboard managers.
 *
 * Centralised so all five behave identically: one busy flag, one place field
 * errors are extracted, and a notice that clears on the next interaction. It
 * also guarantees a save is never attempted while another is in flight, which
 * would let a double-click create duplicate records.
 */
export function useEditor<T>({ blank, onError }: EditorOptions<T>): EditorState<T> {
  const [mode, setMode] = useState<EditorMode>('create');
  const [id, setId] = useState<string | null>(null);
  const [draft, setDraftState] = useState<T>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const reset = useCallback((next: T) => {
    setDraftState(next);
    setError(null);
    setFieldErrors({});
  }, []);

  const cancel = useCallback(() => {
    setMode('create');
    setId(null);
    setDraftState(blank);
    setError(null);
    setFieldErrors({});
  }, [blank]);

  const startCreate = useCallback(
    (next: T) => {
      setMode('create');
      setId(null);
      setDraftState(next);
      setError(null);
      setFieldErrors({});
      setNotice(null);
    },
    [],
  );

  const startEdit = useCallback((nextId: string, next: T) => {
    setMode('edit');
    setId(nextId);
    setDraftState(next);
    setError(null);
    setFieldErrors({});
    setNotice(null);
  }, []);

  const submit = useCallback(
    async (
      run: (value: T, recordId: string | null) => Promise<AdminResult<unknown>>,
      messages: { created: string; updated: string },
    ): Promise<boolean> => {
      if (busy) return false;

      setBusy(true);
      setError(null);
      setFieldErrors({});

      const result = await run(draft, id);
      setBusy(false);

      if (result.ok) {
        setNotice(id ? messages.updated : messages.created);
        setMode('create');
        setId(null);
        setDraftState(blank);
        return true;
      }

      setError(
        onError
          ? { ...result.error, message: onError(result.error) }
          : result.error,
      );
      setFieldErrors(result.error.fields ?? {});
      return false;
    },
    [blank, busy, draft, id, onError],
  );

  return {
    mode,
    id,
    draft,
    setDraft: (updater) => setDraftState((current) => updater(current)),
    reset,
    startCreate,
    startEdit,
    cancel,
    busy,
    error,
    fieldErrors,
    notice,
    submit,
    clearNotice: () => setNotice(null),
  };
}

/** A one-off action such as delete or reset, with its own busy and error state. */
export interface ActionState {
  busy: boolean;
  error: ApiError | null;
  notice: string | null;
  /**
   * @param onError Optional mapper returning `null` to suppress the banner, which
   * lets a caller handle field-level errors itself instead of showing both.
   */
  run: (
    run: () => Promise<AdminResult<unknown>>,
    message: string,
    onError?: (error: ApiError) => string | null,
  ) => Promise<boolean>;
  clearNotice: () => void;
}

export function useAction(): ActionState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(
    async (
      task: () => Promise<AdminResult<unknown>>,
      message: string,
      onError?: (apiError: ApiError) => string | null,
    ): Promise<boolean> => {
      if (busy) return false;

      setBusy(true);
      setError(null);
      const result = await task();
      setBusy(false);

      if (result.ok) {
        setNotice(message);
        return true;
      }

      const messageText = onError ? onError(result.error) : result.error.message;
      setError(
        messageText === null
          ? null
          : { ...result.error, message: messageText },
      );
      return false;
    },
    [busy],
  );

  return { busy, error, notice, run, clearNotice: () => setNotice(null) };
}
