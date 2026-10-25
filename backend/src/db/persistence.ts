// Hook persistensi opsional. Di Cloud Functions (filesystem sementara), functions/src/index.ts memasang
// hook yang mengunggah berkas SQLite ke Cloud Storage; di lokal/tes hook kosong sehingga tidak ada efek.
let hook: (() => Promise<void>) | null = null;
let inflight: Promise<void> | null = null;
let queued: Promise<void> | null = null;

export function setDbSyncHook(fn: (() => Promise<void>) | null) {
  hook = fn;
}
export const hasSyncHook = () => hook !== null;

async function run(): Promise<void> {
  try {
    await hook!();
  } catch (e) {
    console.error("db sync gagal", e);
  }
}

/**
 * Group commit: paling banyak satu unggahan berjalan dan satu antre. Semua pemanggil yang datang saat unggahan
 * berjalan berbagi SATU unggahan berikutnya (yang dimulai setelah tulisan mereka ter-commit), sehingga durabilitas
 * terjaga (respons baru dikirim setelah unggahan yang memuat tulisannya selesai) dengan latensi terbatas
 * ≈ dua unggahan berapa pun jumlah request bersamaan.
 */
export function syncDb(): Promise<void> {
  if (!hook) return Promise.resolve();
  if (!inflight) {
    inflight = run().finally(() => { inflight = null; });
    return inflight;
  }
  if (!queued) {
    queued = inflight.then(() => {
      queued = null;
      inflight = run().finally(() => { inflight = null; });
      return inflight;
    });
  }
  return queued;
}
