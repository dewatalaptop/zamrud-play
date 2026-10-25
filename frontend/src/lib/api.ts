export class ApiError extends Error {
  constructor(public status: number, public code: string, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}

// Header kustom wajib untuk metode mengubah data (perlindungan CSRF; server memeriksanya).
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-zamrud-csrf": "1" },
      body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    const e = json?.error ?? {};
    throw new ApiError(res.status, e.code ?? "INTERNAL_ERROR", e);
  }
  return json.data as T;
}

export const api = {
  get: <T>(p: string) => request<T>("GET", p),
  post: <T>(p: string, b: unknown = {}) => request<T>("POST", p, b),
  put: <T>(p: string, b: unknown = {}) => request<T>("PUT", p, b),
  patch: <T>(p: string, b: unknown = {}) => request<T>("PATCH", p, b),
  del: <T>(p: string) => request<T>("DELETE", p),
};

/** ID acak untuk idempotensi permintaan (satu per aksi pemain). */
export const newRequestId = () =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g, "");

export interface Loc { id: string; en: string; }
