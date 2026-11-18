import type { GroupView } from "./types";

/**
 * Client-side mirror of backend `engine.resolve_round`, used only to *preview*
 * the outcome while the host is still regrouping. The server stays authoritative.
 */
export function previewRound(
  groups: GroupView[],
  cowHolder: string | null,
  { cowRound = false, sourMilk = false }: { cowRound?: boolean; sourMilk?: boolean } = {},
) {
  const nonEmpty = groups.filter((g) => g.player_ids.length > 0);
  const loners = nonEmpty.filter((g) => g.player_ids.length === 1).map((g) => g.player_ids[0]);

  const top = nonEmpty.reduce((m, g) => Math.max(m, g.player_ids.length), 0);
  const largest = nonEmpty.filter((g) => g.player_ids.length === top);
  // In a Cow Round the herd doesn't score (and isn't "the herd" at all).
  const herdKey = !cowRound && largest.length === 1 && top >= 1 ? largest[0].key : null;
  const tiedKeys = !cowRound && largest.length > 1 ? largest.map((g) => g.key) : [];

  const newCowHolder = !cowRound && loners.length === 1 ? loners[0] : cowHolder;
  const scorers = cowRound
    ? loners
    : (nonEmpty.find((g) => g.key === herdKey)?.player_ids ?? []);
  const soured = sourMilk && cowHolder !== null && newCowHolder === cowHolder ? cowHolder : null;

  return {
    herdKey,
    tiedKeys,
    loners,
    scorers,
    newCowHolder,
    cowMoves: newCowHolder !== cowHolder,
    soured,
  };
}
