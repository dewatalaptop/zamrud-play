import { z } from "zod";
import { one, run, tx } from "../db";
import { iso, now } from "../lib/clock";
import { conflict, forbidden, HttpError, unauthorized } from "../lib/errors";
import { DUMMY_HASH, hashPassword, newId, newToken, sha256, verifyPassword } from "../lib/security";
import { createWallet } from "./wallet";
import { getEconomy } from "./settings";
import { ensureSettings } from "./responsible";

export const SESSION_DAYS = 14;

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,20}$/),
  displayName: z.string().trim().min(2).max(30),
  password: z.string().min(8).max(128),
  locale: z.enum(["id", "en"]).default("id"),
}).strict();

export const LoginSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  password: z.string().min(1).max(128),
}).strict();

export interface AuthUser {
  id: string; email: string; username: string; role: "USER" | "ADMIN"; status: string; xp: number;
}

export async function register(raw: unknown): Promise<AuthUser> {
  const input = RegisterSchema.parse(raw);
  if (input.password.toLowerCase().includes(input.username.toLowerCase()) && input.username.length >= 4) {
    throw new HttpError(400, "WEAK_PASSWORD");
  }
  const hash = await hashPassword(input.password);
  return tx(() => {
    if (one("SELECT 1 x FROM users WHERE email=? COLLATE NOCASE", input.email)) throw conflict("EMAIL_TAKEN");
    if (one("SELECT 1 x FROM users WHERE username=? COLLATE NOCASE", input.username)) throw conflict("USERNAME_TAKEN");
    const id = newId();
    const at = iso();
    run("INSERT INTO users(id,email,username,password_hash,role,status,xp,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
      id, input.email, input.username, hash, "USER", "ACTIVE", 0, at, at);
    run("INSERT INTO user_profiles(user_id,display_name) VALUES(?,?)", id, input.displayName);
    run("INSERT INTO user_preferences(user_id,locale) VALUES(?,?)", id, input.locale);
    ensureSettings(id);
    createWallet(id, getEconomy().startingBalance);
    return { id, email: input.email, username: input.username, role: "USER" as const, status: "ACTIVE", xp: 0 };
  });
}

export async function login(raw: unknown): Promise<AuthUser> {
  const input = LoginSchema.parse(raw);
  const row = one<any>("SELECT * FROM users WHERE email=? COLLATE NOCASE OR username=? COLLATE NOCASE", input.identifier, input.identifier);
  // Selalu jalankan verifikasi (hash tiruan bila user tidak ada) agar waktu respons seragam.
  const ok = await verifyPassword(input.password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok || row.status === "DELETED") throw unauthorized("INVALID_CREDENTIALS");
  if (row.status === "SUSPENDED") throw forbidden("ACCOUNT_SUSPENDED");
  run("UPDATE users SET last_login_at=? WHERE id=?", iso(), row.id);
  return { id: row.id, email: row.email, username: row.username, role: row.role, status: row.status, xp: row.xp };
}

/** Membuat sesi; hanya hash token yang disimpan di DB. */
export function createSession(userId: string, userAgent?: string): { token: string; expiresAt: string } {
  const token = newToken();
  const expiresAt = new Date(now().getTime() + SESSION_DAYS * 86_400_000).toISOString();
  run("INSERT INTO auth_sessions(id,token_hash,user_id,expires_at,created_at,user_agent) VALUES(?,?,?,?,?,?)",
    newId(), sha256(token), userId, expiresAt, iso(), (userAgent ?? "").slice(0, 200));
  // Bersihkan sesi kedaluwarsa milik user ini.
  run("DELETE FROM auth_sessions WHERE user_id=? AND expires_at<?", userId, iso());
  return { token, expiresAt };
}

export function resolveSession(token: string): { user: AuthUser; sessionId: string; expiresAt: string } | null {
  const row = one<any>(
    `SELECT s.id sid, s.expires_at, u.id, u.email, u.username, u.role, u.status, u.xp
     FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`, sha256(token)
  );
  if (!row || row.expires_at < iso() || row.status !== "ACTIVE") return null;
  return { sessionId: row.sid, expiresAt: row.expires_at, user: { id: row.id, email: row.email, username: row.username, role: row.role, status: row.status, xp: row.xp } };
}

export function destroySession(token: string) {
  run("DELETE FROM auth_sessions WHERE token_hash=?", sha256(token));
}
export function destroyAllSessions(userId: string) {
  run("DELETE FROM auth_sessions WHERE user_id=?", userId);
}

/** Hapus akun = anonimisasi. Riwayat ledger dipertahankan (tanpa data pribadi) demi integritas audit. */
export async function deleteAccount(userId: string, password: string) {
  const row = one<any>("SELECT password_hash, role FROM users WHERE id=?", userId);
  if (!row || !(await verifyPassword(password, row.password_hash))) throw unauthorized("INVALID_CREDENTIALS");
  if (row.role === "ADMIN") throw forbidden("ADMIN_CANNOT_SELF_DELETE");
  tx(() => {
    const at = iso();
    run("UPDATE users SET status='DELETED', email=?, username=?, password_hash='!', anonymized_at=?, updated_at=? WHERE id=?",
      `deleted+${userId}@invalid.local`, `deleted_${userId.slice(0, 8)}`, at, at, userId);
    run("UPDATE user_profiles SET display_name='Pengguna terhapus', bio='', show_on_leaderboard=0 WHERE user_id=?", userId);
    run("DELETE FROM user_events WHERE user_id=?", userId);
    run("DELETE FROM user_favorites WHERE user_id=?", userId);
    run("DELETE FROM support_requests WHERE user_id=?", userId);
    destroyAllSessions(userId);
  });
}

export async function changePassword(userId: string, current: string, next: string) {
  const row = one<any>("SELECT password_hash FROM users WHERE id=?", userId);
  if (!row || !(await verifyPassword(current, row.password_hash))) throw unauthorized("INVALID_CREDENTIALS");
  z.string().min(8).max(128).parse(next);
  const hash = await hashPassword(next);
  run("UPDATE users SET password_hash=?, updated_at=? WHERE id=?", hash, iso(), userId);
}
