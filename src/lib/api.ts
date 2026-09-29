import type { ApiError, EnquiryResponse } from '@shared/schemas';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export interface SubmitEnquiryPayload {
  name: string;
  email: string;
  organisation?: string;
  topic: string;
  message: string;
  website?: string;
}

export type SubmitResult =
  | { ok: true; data: EnquiryResponse }
  | { ok: false; error: ApiError };

/**
 * Posts an enquiry to the API. Network failures and non-JSON error responses are
 * normalised into the same shape as a validation failure so the form has one
 * error path to render.
 */
export async function submitEnquiry(
  payload: SubmitEnquiryPayload,
  signal?: AbortSignal,
): Promise<SubmitResult> {
  const networkError: ApiError = {
    ok: false,
    error: 'server_error',
    message: 'We could not reach the server. Please check your connection and try again.',
  };

  try {
    const response = await fetch(`${API_BASE}/api/enquiries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        error: isApiError(body)
          ? body
          : {
              ok: false,
              error: response.status === 429 ? 'rate_limited' : 'server_error',
              message:
                response.status === 429
                  ? 'Too many enquiries from this connection. Please try again later.'
                  : 'Something went wrong. Please try again.',
            },
      };
    }

    if (!isEnquiryResponse(body)) {
      return { ok: false, error: networkError };
    }

    return { ok: true, data: body };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return { ok: false, error: { ...networkError, message: 'Request cancelled.' } };
    }
    return { ok: false, error: networkError };
  }
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value as ApiError).ok === false &&
    typeof (value as ApiError).message === 'string'
  );
}

function isEnquiryResponse(value: unknown): value is EnquiryResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value as EnquiryResponse).ok === true &&
    typeof (value as EnquiryResponse).id === 'string'
  );
}
