import os from "os";
import path from "path";
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import type { Express } from "express";

// Diset SEBELUM backend diimpor: db/index.ts membaca DB_PATH saat modul dimuat. os.tmpdir() valid
// di Windows (analisis lokal `firebase deploy`) maupun di runtime Linux.
const DB_PATH = path.join(os.tmpdir(), "zamrud-play.db");
process.env.DB_PATH = DB_PATH;
process.env.TRUST_PROXY = "1"; // satu proxy tepercaya (Google front end) → req.ip = IP klien sebenarnya

// Filesystem Cloud Functions sementara → pulihkan berkas SQLite terakhir dari Cloud Storage sebelum backend
// membukanya, dan unggah ulang setelah tiap mutasi (hook di backend/src/db/persistence.ts).
// Pola yang sama dengan retail-pos. maxInstances: 1 menjaga satu-satunya penulis DB.
const BUCKET_NAME = "ai-app-builder-7bf8e.firebasestorage.app";
const DB_STORAGE_PATH = "zamrud-play-db/data.db";

if (!admin.apps.length) admin.initializeApp({ storageBucket: BUCKET_NAME });

async function downloadDbIfExists(): Promise<boolean> {
  const file = admin.storage().bucket().file(DB_STORAGE_PATH);
  const [exists] = await file.exists();
  if (!exists) return false;
  await file.download({ destination: DB_PATH });
  return true;
}

async function uploadDb(): Promise<void> {
  // Mode WAL: tulisan bisa masih di berkas -wal; paksa checkpoint agar berkas utama lengkap sebelum diunggah.
  const { db } = await import("./backend/db");
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  await admin.storage().bucket().upload(DB_PATH, { destination: DB_STORAGE_PATH, resumable: false }); // sekali jalan, tanpa handshake resumable
}

let appPromise: Promise<Express> | null = null;

async function initApp(): Promise<Express> {
  await downloadDbIfExists(); // harus selesai sebelum backend membuka SQLite
  const { app } = await import("./backend/app"); // seedAll() idempoten dijalankan di dalam app.ts
  const { setDbSyncHook } = await import("./backend/db/persistence");
  setDbSyncHook(uploadDb);
  await uploadDb(); // jaminkan baseline (seed) tersimpan untuk cold start berikutnya
  return app;
}
const getApp = () => (appPromise ??= initApp());

// Jangan menamai fungsi `api` (nama fungsi unik per project, bukan per codebase).
export const zamrudPlayApi = onRequest({ region: "asia-southeast2", maxInstances: 1, memory: "512MiB" }, async (req, res) => {
  const app = await getApp();
  app(req, res);
});
