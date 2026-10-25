import crypto from "crypto";
import type { Rng } from "./types";

/** RNG produksi: CSPRNG Node (crypto.randomInt — seragam, tanpa modulo bias). */
export const secureRng: Rng = {
  int(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 2 ** 48 - 1) {
      throw new RangeError("maxExclusive harus bilangan bulat positif");
    }
    return crypto.randomInt(maxExclusive);
  },
};

/** RNG deterministik untuk tes: mengembalikan nilai dari urutan (dimodulo agar selalu valid). */
export function sequenceRng(values: number[]): Rng {
  let i = 0;
  return {
    int(maxExclusive) {
      if (i >= values.length) throw new Error("sequenceRng habis");
      const v = values[i++];
      if (v < 0 || v >= maxExclusive) throw new RangeError(`nilai ${v} di luar [0,${maxExclusive})`);
      return v;
    },
  };
}

/** Fisher-Yates dengan RNG yang disuntik. */
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pilih indeks berbobot (bobot bilangan bulat). */
export function weightedIndex(weights: number[], rng: Rng): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.int(total);
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  throw new Error("weightedIndex: tidak mungkin tercapai");
}
