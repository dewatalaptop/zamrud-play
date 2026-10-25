import http from "http";
import type { AddressInfo } from "net";
import { app } from "../src/app";
import { resetRateLimits } from "../src/lib/security";

let server: http.Server;
export let base = "";

export async function startServer() {
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
export const stopServer = () => new Promise<void>((r) => server.close(() => r()));
export { resetRateLimits };

/** Klien HTTP dengan cookie jar + header CSRF, seperti browser sungguhan. */
export class Client {
  cookie = "";
  async req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { "content-type": "application/json", "x-zamrud-csrf": "1", ...extra };
    if (this.cookie) headers.cookie = this.cookie;
    const res = await fetch(base + path, { method, headers, body: body === undefined || method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const [k, v] = [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)];
      this.cookie = v ? `${k}=${v}` : "";
    }
    const json: any = await res.json().catch(() => null);
    return { status: res.status, json, data: json?.data, error: json?.error?.code as string | undefined };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b?: unknown) => this.req("POST", p, b ?? {});
  put = (p: string, b?: unknown) => this.req("PUT", p, b ?? {});
  patch = (p: string, b?: unknown) => this.req("PATCH", p, b ?? {});
  del = (p: string) => this.req("DELETE", p);
}

let n = 0;
export async function newUser(name?: string): Promise<{ c: Client; email: string; id: string }> {
  const i = ++n;
  const c = new Client();
  const email = `${name ?? "user"}${i}@test.dev`;
  const r = await c.post("/api/auth/register", {
    email, username: `${name ?? "user"}${i}`, displayName: `Pemain ${i}`, password: "kata-sandi-aman-1",
  });
  if (r.status !== 200) throw new Error("register gagal " + JSON.stringify(r.json));
  return { c, email, id: r.data.id };
}
export const rid = () => "r" + Math.random().toString(36).slice(2) + Date.now().toString(36);
