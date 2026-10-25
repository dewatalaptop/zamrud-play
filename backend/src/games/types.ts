// Antarmuka umum mesin game. Semua nilai uang-like adalah koin virtual bilangan bulat.
export interface Rng {
  /** Bilangan bulat acak seragam dalam [0, maxExclusive). */
  int(maxExclusive: number): number;
}

export type ConfigCheck<C> = { ok: true; config: C } | { ok: false; errors: string[] };

export interface StartResult {
  state: unknown;
  /** Taruhan yang dipotong dari saldo saat memulai. */
  stake: number;
  finished: boolean;
  /** Total pengembalian (termasuk taruhan) bila finished. */
  payout: number;
  outcome: Record<string, unknown>;
}

export interface ActResult {
  state: unknown;
  /** Taruhan tambahan (mis. double down) yang harus dipotong dari saldo. */
  extraStake: number;
  finished: boolean;
  payout: number;
  outcome: Record<string, unknown>;
}

export interface GameEngine<C = any, S = any> {
  slug: string;
  kind: "INSTANT" | "INTERACTIVE";
  defaultConfig: C;
  /** Validasi struktur + aturan semantik (mis. RTP wajar) sebelum konfigurasi boleh dipublikasikan. */
  validateConfig(raw: unknown): ConfigCheck<C>;
  /** Ringkasan publik: paytable/aturan + RTP eksak bila bisa dihitung. */
  describe(config: C): Record<string, unknown>;
  parseStart(raw: unknown, config: C): any;
  start(config: C, input: any, rng: Rng): StartResult;
  parseAction?(raw: unknown): any;
  act?(config: C, state: S, action: any, rng: Rng): ActResult;
  /** Tampilan state yang aman dikirim ke klien (tanpa kartu tersembunyi/shoe). */
  publicView(state: S, finished: boolean): unknown;
}

export const ZERO_OR_POSITIVE_INT = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
