// `require` (bukan import) agar Vitest/Vite tidak salah menerjemahkan prefix "node:" untuk sqlite.
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
import fs from "fs";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "..", "data.db");

// Built-in node:sqlite (Node 22+) — no native compilation. Di Cloud Functions DB_PATH
// diarahkan ke os.tmpdir() (lihat functions/src/index.ts): data demo reset saat cold start.
export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA busy_timeout = 5000");

const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
db.exec(schema);

// Log migrasi kolom (no-op bila sudah diterapkan). Tambahkan di sini saat skema berubah.
export function migrateAddColumnIfMissing(table: string, column: string, definition: string): void {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (existing.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

let depth = 0;

/**
 * Menjalankan fn dalam satu transaksi tulis (BEGIN IMMEDIATE) — semua perubahan saldo,
 * sesi game, dan ledger terjadi atomik. Bersarang: ikut transaksi luar.
 * fn harus sinkron (node:sqlite sinkron), sehingga tidak ada interleaving antar request.
 */
export function tx<T>(fn: () => T): T {
  if (depth > 0) return fn();
  db.exec("BEGIN IMMEDIATE");
  depth++;
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* sudah di-rollback */
    }
    throw err;
  } finally {
    depth--;
  }
}

export function one<T>(sql: string, ...params: (string | number | null)[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}
export function all<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}
export function run(sql: string, ...params: (string | number | null)[]) {
  return db.prepare(sql).run(...params);
}
