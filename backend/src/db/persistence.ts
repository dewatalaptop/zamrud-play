// Hook persistensi opsional. Di Cloud Functions (filesystem sementara), functions/src/index.ts memasang
// hook yang mengunggah berkas SQLite ke Cloud Storage; di lokal/tes hook kosong sehingga tidak ada efek.
let hook: (() => Promise<void>) | null = null;
let chain: Promise<void> = Promise.resolve();

export function setDbSyncHook(fn: (() => Promise<void>) | null) {
  hook = fn;
}
export const hasSyncHook = () => hook !== null;

/** Antrekan sinkronisasi (serial, tanpa unggahan bersamaan). Dipanggil sebelum respons mutasi dikirim. */
export function syncDb(): Promise<void> {
  if (!hook) return Promise.resolve();
  const run = hook;
  chain = chain.then(() => run()).catch((e) => console.error("db sync gagal", e));
  return chain;
}
