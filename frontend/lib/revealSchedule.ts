import type { GroupAnswer, GroupView } from "./types";

/**
 * Timeline of the staged reveal, in seconds since the server's `revealed_at`.
 * Pure, so every phone computes the same schedule and stays in sync.
 *
 *   0 ─ intro ─┬─ flip, flip, flip… ─┬─ hold ─┬─ grouped board ─┬─ controls
 *              flipsStart            lastFlip  groupAt           doneAt
 */
const INTRO = 0.8;
const HOLD = 1.0;
const SETTLE = 0.6;

export interface RevealSchedule {
  /** individual answers in flip order (same on every phone) */
  order: GroupAnswer[];
  /** when each answer in `order` flips */
  flipAt: number[];
  /** when the individual cards give way to the grouped board */
  groupAt: number;
  /** when the host's controls and the preview come in */
  doneAt: number;
}

// Small string hash so the shuffle is deterministic per round.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function revealSchedule(groups: GroupView[], seed: string): RevealSchedule {
  const order = groups
    .flatMap((g) => g.answers)
    .sort((a, b) => hash(seed + a.player_id) - hash(seed + b.player_id));
  const n = order.length;
  // ~3s of flipping in total, but never rushed or sluggish per card.
  const step = n ? Math.min(0.9, Math.max(0.5, 3 / n)) : 0;
  const flipAt = order.map((_, i) => INTRO + i * step);
  const lastFlip = n ? flipAt[n - 1] : INTRO;
  const groupAt = lastFlip + HOLD;
  return { order, flipAt, groupAt, doneAt: groupAt + SETTLE };
}
