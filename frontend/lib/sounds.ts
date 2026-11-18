"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny synthesized sound kit (Web Audio - no audio files) plus vibration.
 * Browsers only allow audio after a user gesture, so the context is created
 * lazily and resumed on the first tap/keypress (see `unlockAudio`).
 */

// ---- mute preference (per browser) ----

const MUTE_KEY = "herd:muted";
const muteListeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

let muted = typeof window === "undefined" ? false : readMuted();

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  muteListeners.forEach((l) => l());
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (l) => {
      muteListeners.add(l);
      return () => muteListeners.delete(l);
    },
    () => muted,
    () => false,
  );
}

// ---- audio context ----

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    loadMoo(ctx);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call once on mount: the first user gesture unlocks audio for the session. */
export function unlockAudio(): () => void {
  const unlock = () => audio();
  const opts = { once: true, passive: true } as const;
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("keydown", unlock, opts);
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

// ---- building blocks ----

type Wave = OscillatorType;

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  { type = "sine" as Wave, gain = 0.2, endFreq }: { type?: Wave; gain?: number; endFreq?: number } = {},
) {
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function noise(c: AudioContext, start: number, dur: number, from: number, to: number, gain = 0.15) {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + dur);
  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + dur * 0.3);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(amp).connect(c.destination);
  src.start(start);
}

/** The moo is a real recording (public/moo.mp3), decoded once and reused. */
const MOO_URL = "/moo.mp3";
let mooBuffer: AudioBuffer | null = null;
let mooLoading = false;

function loadMoo(c: AudioContext) {
  if (mooBuffer || mooLoading) return;
  mooLoading = true;
  fetch(MOO_URL)
    .then((r) => r.arrayBuffer())
    .then((data) => c.decodeAudioData(data))
    .then((buffer) => {
      mooBuffer = buffer;
    })
    .catch(() => {
      mooLoading = false; // try again next time
    });
}

function moo(c: AudioContext, start: number, gain: number) {
  if (!mooBuffer) {
    loadMoo(c); // not ready yet: skip this one rather than play it late
    return;
  }
  const src = c.createBufferSource();
  src.buffer = mooBuffer;
  const amp = c.createGain();
  amp.gain.value = gain;
  src.connect(amp).connect(c.destination);
  src.start(start);
}

// ---- the kit ----

const SOUNDS = {
  /** you locked in an answer */
  pop: (c: AudioContext, t: number) => tone(c, 520, t, 0.12, { endFreq: 880, gain: 0.18 }),
  /** someone else answered */
  blip: (c: AudioContext, t: number) => tone(c, 740, t, 0.07, { type: "triangle", gain: 0.08 }),
  /** last seconds of the timer */
  tick: (c: AudioContext, t: number) => tone(c, 1200, t, 0.05, { type: "square", gain: 0.05 }),
  /** time's up */
  buzz: (c: AudioContext, t: number) => {
    tone(c, 180, t, 0.35, { type: "sawtooth", gain: 0.12, endFreq: 120 });
  },
  /** a new question appears */
  start: (c: AudioContext, t: number) => {
    tone(c, 523, t, 0.15, { type: "triangle", gain: 0.15 });
    tone(c, 784, t + 0.09, 0.22, { type: "triangle", gain: 0.15 });
  },
  /** one answer flips over in the staged reveal */
  flip: (c: AudioContext, t: number) => {
    tone(c, 420, t, 0.06, { type: "triangle", gain: 0.12, endFreq: 640 });
    noise(c, t, 0.08, 2000, 5000, 0.05);
  },
  /** the herd is revealed */
  tada: (c: AudioContext, t: number) => {
    tone(c, 523, t, 0.12, { type: "triangle", gain: 0.16 });
    tone(c, 784, t + 0.1, 0.4, { type: "triangle", gain: 0.18 });
    tone(c, 1047, t + 0.1, 0.4, { gain: 0.08 });
  },
  /** answers flip over */
  whoosh: (c: AudioContext, t: number) => noise(c, t, 0.45, 300, 3000),
  /** you scored */
  chime: (c: AudioContext, t: number) => {
    [1047, 1319, 1568].forEach((f, i) => tone(c, f, t + i * 0.08, 0.5, { gain: 0.14 }));
  },
  /** the Pink Cow moved to someone else */
  moo: (c: AudioContext, t: number) => moo(c, t, 0.55),
  /** the Pink Cow is now YOURS */
  bigMoo: (c: AudioContext, t: number) => moo(c, t, 1),
  /** your turn to pick the question */
  ding: (c: AudioContext, t: number) => {
    tone(c, 659, t, 0.25, { gain: 0.16 });
    tone(c, 988, t + 0.12, 0.45, { gain: 0.16 });
  },
  /** sudden death */
  drum: (c: AudioContext, t: number) => {
    [0, 0.14, 0.28].forEach((d) => tone(c, 90, t + d, 0.12, { type: "triangle", gain: 0.3, endFreq: 50 }));
  },
  /** you won */
  fanfare: (c: AudioContext, t: number) => {
    const notes: [number, number, number][] = [
      [392, 0, 0.14], [523, 0.14, 0.14], [659, 0.28, 0.14], [784, 0.42, 0.5], [659, 0.62, 0.12], [784, 0.74, 0.7],
    ];
    notes.forEach(([f, d, len]) => tone(c, f, t + d, len, { type: "triangle", gain: 0.16 }));
  },
  /** game over, someone else won */
  outro: (c: AudioContext, t: number) => {
    [523, 440, 392].forEach((f, i) => tone(c, f, t + i * 0.18, 0.3, { type: "triangle", gain: 0.13 }));
  },
} as const;

export type SoundName = keyof typeof SOUNDS;

export function play(name: SoundName, delay = 0): void {
  if (muted) return;
  const c = audio();
  if (!c || c.state !== "running") return;
  SOUNDS[name](c, c.currentTime + delay);
}

/** Haptics (Android; iOS Safari ignores it). */
export function vibrate(pattern: number | number[]): void {
  if (muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
