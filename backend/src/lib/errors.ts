// Error terstruktur: `code` dipetakan ke terjemahan di frontend (errors.<code>).
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public extra?: Record<string, unknown>
  ) {
    super(message ?? code);
  }
}

export const badRequest = (code = "BAD_REQUEST", extra?: Record<string, unknown>) => new HttpError(400, code, code, extra);
export const unauthorized = (code = "UNAUTHORIZED") => new HttpError(401, code);
export const forbidden = (code = "FORBIDDEN") => new HttpError(403, code);
export const notFound = (code = "NOT_FOUND") => new HttpError(404, code);
export const conflict = (code = "CONFLICT", extra?: Record<string, unknown>) => new HttpError(409, code, code, extra);
