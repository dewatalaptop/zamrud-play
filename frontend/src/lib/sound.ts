import { useSyncExternalStore } from "react";

/**
 * Efek suara sintetis (WebAudio) — tanpa berkas audio, jadi tanpa biaya transfer. BAWAAN MATI dan hanya aktif
 * setelah pemain menyalakannya sendiri. Aturan bermain sehat: suara HANYA untuk kemenangan nyata (payout > taruhan)
 * dan ketukan netral saat gulungan berhenti; tidak ada suara untuk pengembalian 1×, kekalahan, atau "nyaris menang".
 */
const KEY = "zp-sound";
const EVT = "zp-sound-change";
type Kind = "stop" | "win" | "big" | "mega";

let ctx: AudioContext | null = null;

export function soundEnabled(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

export function setSoundEnabled(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* penyimpanan diblokir: tetap berlaku untuk sesi ini lewat event */ }
  if (on) { audio(); sfx("stop", true); } // dipanggil dari klik pemain → konteks audio boleh dibuka
  window.dispatchEvent(new Event(EVT));
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    (cb) => { window.addEventListener(EVT, cb); return () => window.removeEventListener(EVT, cb); },
    soundEnabled,
    () => false,
  );
}

function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, peak: number) {
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.015); // atak singkat agar tidak berderak
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at); o.stop(at + dur + 0.02);
}

// Nada tangga mayor C: C5 E5 G5 C6 E6 G6
const N = { c5: 523.25, e5: 659.25, g5: 783.99, c6: 1046.5, e6: 1318.5, g6: 1568 };

export function sfx(kind: Kind, force = false) {
  if (!force && (!soundEnabled() || document.hidden)) return;
  const c = audio(); if (!c) return;
  const t0 = c.currentTime + 0.01;
  switch (kind) {
    case "stop": tone(c, 180, t0, 0.07, "triangle", 0.05); break;
    case "win": [N.c5, N.e5, N.g5].forEach((f, i) => tone(c, f, t0 + i * 0.09, 0.22, "sine", 0.07)); break;
    case "big": [N.c5, N.e5, N.g5, N.c6, N.e6].forEach((f, i) => { tone(c, f, t0 + i * 0.08, 0.3, "sine", 0.08); tone(c, f * 2, t0 + i * 0.08, 0.18, "triangle", 0.02); }); break;
    case "mega": [N.c5, N.e5, N.g5, N.c6, N.e6, N.g6, N.e6, N.g6, N.c6 * 2].forEach((f, i) => { tone(c, f, t0 + i * 0.07, 0.34, "sine", 0.08); tone(c, f * 2, t0 + i * 0.07, 0.2, "triangle", 0.025); }); break;
  }
}
