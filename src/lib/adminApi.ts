import type {
  ActivityInput,
  ApiError,
  ContentResponse,
  ImpactPatch,
  ManagedActivity,
  ManagedContent,
  ManagedPicture,
  ManagedProject,
  ManagedTeamMember,
  ManagedTestimonial,
  ManagedPolicy,
  PictureInput,
  PolicyInput,
  ProgrammeId,
  ProgrammeOverrides,
  ProjectInput,
  TeamMemberInput,
  TestimonialInput,
} from '@shared/schemas';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const ADMIN = `${API_BASE}/api/admin`;

export type AdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface SessionState {
  authenticated: boolean;
  configured: boolean;
}

const networkError = (message: string): ApiError => ({
  ok: false,
  error: 'server_error',
  message,
});

/**
 * One request path for the whole dashboard.
 *
 * `credentials: 'include'` is required: the session is a cookie, and without it
 * every write would 401 even with a valid session.
 *
 * A 401 is translated into `unauthorized` so the shell can drop back to the
 * login screen instead of showing a generic failure — an expired session is a
 * normal event, not a bug.
 */
async function request<T>(
  path: string,
  init: RequestInit = {},
  { upload = false }: { upload?: boolean } = {},
): Promise<AdminResult<T>> {
  try {
    const response = await fetch(`${ADMIN}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        accept: 'application/json',
        // Let the browser set the multipart boundary itself.
        ...(upload ? {} : { 'content-type': 'application/json' }),
        ...(init.headers ?? {}),
      },
    });

    const body: unknown = await response.json().catch(() => null);

    if (response.status === 401) {
      // Keep the server's wording: it distinguishes "Incorrect password." from
      // "Sign in to continue.", and overwriting both with one message tells the
      // operator the wrong thing. Either way the `unauthorized` code is what
      // signals the shell to fall back to the sign-in screen.
      return {
        ok: false,
        error: isApiError(body)
          ? body
          : {
              ok: false,
              error: 'unauthorized',
              message: 'Your session has expired. Please sign in again.',
            },
      };
    }

    if (!response.ok) {
      if (isApiError(body)) return { ok: false, error: body };
      return {
        ok: false,
        error: {
          ok: false,
          error: response.status === 429 ? 'rate_limited' : 'server_error',
          message:
            response.status === 429
              ? 'Too many attempts. Please wait a moment and try again.'
              : `Request failed (${response.status}).`,
        },
      };
    }

    return { ok: true, data: body as T };
  } catch {
    return {
      ok: false,
      error: networkError('Could not reach the server. Check your connection and try again.'),
    };
  }
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ApiError).ok === false &&
    typeof (value as ApiError).message === 'string'
  );
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

/* --------------------------------- session -------------------------------- */

export const getSession = (): Promise<AdminResult<SessionState>> =>
  request<SessionState>('/session');

export const login = (password: string): Promise<AdminResult<{ ok: true }>> =>
  request<{ ok: true }>('/login', json('POST', { password }));

export const logout = (): Promise<AdminResult<{ ok: true }>> =>
  request<{ ok: true }>('/logout', { method: 'POST' });

/* --------------------------------- content -------------------------------- */

export const getContent = (): Promise<AdminResult<ManagedContent>> =>
  request<{ content: ManagedContent }>('/content').then((result) =>
    result.ok ? { ok: true, data: result.data.content } : result,
  );

export const resetContent = (): Promise<AdminResult<ManagedContent>> =>
  request<{ content: ManagedContent }>('/content/reset', { method: 'POST' }).then((result) =>
    result.ok ? { ok: true, data: result.data.content } : result,
  );

/** Public endpoint, used to confirm an edit reached the live site. */
export const getPublicContent = (): Promise<AdminResult<ContentResponse>> =>
  fetch(`${API_BASE}/api/content`, { headers: { accept: 'application/json' } })
    .then((response) => (response.ok ? response.json() : Promise.reject(response)))
    .then((body) => ({ ok: true as const, data: body as ContentResponse }))
    .catch(() => ({
      ok: false as const,
      error: networkError('Could not read the public content endpoint.'),
    }));

/* --------------------------------- pictures ------------------------------- */

export const createPicture = (input: PictureInput): Promise<AdminResult<ManagedPicture>> =>
  request<{ picture: ManagedPicture }>('/pictures', json('POST', input)).then(unwrap('picture'));

export const updatePicture = (
  id: string,
  input: PictureInput,
): Promise<AdminResult<ManagedPicture>> =>
  request<{ picture: ManagedPicture }>(`/pictures/${id}`, json('PUT', input)).then(
    unwrap('picture'),
  );

export const deletePicture = (id: string): Promise<AdminResult<{ id: string }>> =>
  request<{ id: string }>(`/pictures/${id}`, { method: 'DELETE' });

export interface UploadResult {
  src: string;
  /**
   * Which element the site will use for this file: an `<img>`, a `<video>`, or a
   * downloadable document. Returned by the server rather than inferred here so
   * the dashboard and the site cannot disagree.
   */
  kind: 'image' | 'video' | 'document';
  /** Stored size in bytes, for showing a download size before the reader clicks. */
  bytes: number;
}

/**
 * Uploads one image, video, WebVTT track or PDF.
 *
 * Named for the media rather than the field: the server validates the MIME type
 * against all four, and the `image` multipart field name is multer's, not ours
 * to change.
 */
export const uploadMedia = (file: File): Promise<AdminResult<UploadResult>> => {
  const form = new FormData();
  form.append('image', file);
  return request<UploadResult>(
    '/uploads',
    { method: 'POST', body: form },
    { upload: true },
  );
};

/* --------------------------------- projects ------------------------------- */

export const createProject = (input: ProjectInput): Promise<AdminResult<ManagedProject>> =>
  request<{ project: ManagedProject }>('/projects', json('POST', input)).then(
    unwrap('project'),
  );

export const updateProject = (
  id: string,
  input: ProjectInput,
): Promise<AdminResult<ManagedProject>> =>
  request<{ project: ManagedProject }>(`/projects/${id}`, json('PUT', input)).then(
    unwrap('project'),
  );

export const deleteProject = (id: string): Promise<AdminResult<{ id: string }>> =>
  request<{ id: string }>(`/projects/${id}`, { method: 'DELETE' });

/* -------------------------------- activities ------------------------------ */

export const createActivity = (input: ActivityInput): Promise<AdminResult<ManagedActivity>> =>
  request<{ activity: ManagedActivity }>('/activities', json('POST', input)).then(
    unwrap('activity'),
  );

export const updateActivity = (
  id: string,
  input: ActivityInput,
): Promise<AdminResult<ManagedActivity>> =>
  request<{ activity: ManagedActivity }>(`/activities/${id}`, json('PUT', input)).then(
    unwrap('activity'),
  );

export const deleteActivity = (id: string): Promise<AdminResult<{ id: string }>> =>
  request<{ id: string }>(`/activities/${id}`, { method: 'DELETE' });

/* --------------------------------- team ---------------------------------- */

export const createTeamMember = (input: TeamMemberInput): Promise<AdminResult<ManagedTeamMember>> =>
  request<{ teamMember: ManagedTeamMember }>('/team', json('POST', input)).then(
    unwrap('teamMember'),
  );

export const updateTeamMember = (
  id: string,
  input: TeamMemberInput,
): Promise<AdminResult<ManagedTeamMember>> =>
  request<{ teamMember: ManagedTeamMember }>(`/team/${id}`, json('PUT', input)).then(
    unwrap('teamMember'),
  );

export const deleteTeamMember = (id: string): Promise<AdminResult<{ id: string }>> =>
  request<{ id: string }>(`/team/${id}`, { method: 'DELETE' });

/* ------------------------------ testimonials ----------------------------- */

export const createTestimonial = (
  input: TestimonialInput,
): Promise<AdminResult<ManagedTestimonial>> =>
  request<{ testimonial: ManagedTestimonial }>('/testimonials', json('POST', input)).then(
    unwrap('testimonial'),
  );

export const updateTestimonial = (
  id: string,
  input: TestimonialInput,
): Promise<AdminResult<ManagedTestimonial>> =>
  request<{ testimonial: ManagedTestimonial }>(`/testimonials/${id}`, json('PUT', input)).then(
    unwrap('testimonial'),
  );

export const deleteTestimonial = (id: string): Promise<AdminResult<{ id: string }>> =>
  request<{ id: string }>(`/testimonials/${id}`, { method: 'DELETE' });

/* -------------------------------- policies -------------------------------- */

export const createPolicy = (input: PolicyInput): Promise<AdminResult<ManagedPolicy>> =>
  request<{ policy: ManagedPolicy }>('/policies', json('POST', input)).then(
    unwrap('policy'),
  );

export const updatePolicy = (
  id: string,
  input: PolicyInput,
): Promise<AdminResult<ManagedPolicy>> =>
  request<{ policy: ManagedPolicy }>(`/policies/${id}`, json('PUT', input)).then(
    unwrap('policy'),
  );

export const deletePolicy = (id: string): Promise<AdminResult<{ id: string }>> =>
  request<{ id: string }>(`/policies/${id}`, { method: 'DELETE' });

/* ------------------------- programmes and impact -------------------------- */

export const patchProgramme = (
  id: ProgrammeId,
  patch: ProgrammeOverrides[ProgrammeId],
): Promise<AdminResult<ProgrammeOverrides>> =>
  request<{ programmes: ProgrammeOverrides }>(`/programmes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then(unwrap('programmes'));

export const patchImpact = (patch: ImpactPatch): Promise<AdminResult<ImpactPatch>> =>
  request<{ impact: ImpactPatch }>('/impact', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then(unwrap('impact'));

/** Pulls a single key out of a response envelope, preserving the error union. */
function unwrap<K extends string, T>(key: K) {
  return (result: AdminResult<Record<K, T>>): AdminResult<T> =>
    result.ok ? { ok: true, data: result.data[key] } : result;
}
