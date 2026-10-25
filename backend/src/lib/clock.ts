// Jam yang bisa disuntik agar logika hari/minggu (hadiah harian, misi) bisa diuji deterministik.
let offsetMs = 0;
let fixed: number | null = null;

export const now = (): Date => new Date(fixed ?? Date.now() + offsetMs);
export const iso = (d: Date = now()): string => d.toISOString();

/** Hanya untuk tes. */
export function setClock(ms: number | null) {
  fixed = ms;
}
export function advanceClock(ms: number) {
  offsetMs += ms;
}

// Hari "lokal" pemain mengikuti zona waktu tetap (default WIB, UTC+7).
const TZ_OFFSET_MIN = Number(process.env.TZ_OFFSET_MIN ?? 420);

export function localDay(d: Date = now()): string {
  return new Date(d.getTime() + TZ_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** Awal hari lokal (sebagai ISO UTC) — batas query "hari ini". */
export function startOfLocalDayIso(d: Date = now()): string {
  const day = localDay(d);
  return new Date(Date.parse(day + "T00:00:00Z") - TZ_OFFSET_MIN * 60_000).toISOString();
}

/** Kunci minggu = tanggal Senin (lokal). */
export function localWeekKey(d: Date = now()): string {
  const local = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  const dow = (local.getUTCDay() + 6) % 7; // Senin = 0
  local.setUTCDate(local.getUTCDate() - dow);
  return local.toISOString().slice(0, 10);
}
