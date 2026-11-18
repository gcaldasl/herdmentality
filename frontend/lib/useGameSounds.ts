"use client";

import { useEffect, useRef } from "react";
import { play, unlockAudio, vibrate } from "./sounds";
import type { GameState } from "./types";

/** Plays sounds / vibrates on meaningful transitions between state snapshots.
 *  The first snapshot (page load / reconnect) is silent. */
export function useGameSounds(state: GameState | null, me: string): void {
  const prev = useRef<GameState | null>(null);

  useEffect(() => unlockAudio(), []);

  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (!state || !before) return;

    const phaseChanged = before.phase !== state.phase;

    if (phaseChanged) {
      switch (state.phase) {
        case "choosing":
          if (state.chooser_player_id === me) {
            play("ding");
            vibrate([80, 60, 80]);
          }
          break;
        case "question":
          if (state.cow_round) {
            play("moo");
            vibrate([60, 40, 60]);
          } else play("start");
          break;
        case "reveal":
          // Timer closed the round on us before we answered.
          if (before.deadline && !before.answered_player_ids.includes(me)) play("buzz");
          else play("whoosh");
          break;
        case "scoring":
        case "game_over": {
          const result = state.result;
          const scored = (result?.point_deltas[me] ?? 0) > 0;
          const cowToMe = !!result?.cow_moved && result.new_cow_holder === me;
          if (state.phase === "game_over") {
            if (state.winner_player_id === me) {
              play("fanfare");
              vibrate([100, 50, 100, 50, 300]);
            } else play("outro");
            break;
          }
          if (scored) {
            play("chime");
            vibrate(60);
          }
          if (cowToMe) {
            play("bigMoo", scored ? 0.5 : 0.15);
            vibrate([250, 120, 250]);
          } else if (result?.cow_moved) {
            play("moo", scored ? 0.5 : 0.15);
          }
          if (result?.sour_milk_player_id === me && result.sour_milk_lost) {
            play("buzz", 1.2);
            vibrate([40, 30, 40]);
          }
          if (state.tied_player_ids.length > 1 && before.tied_player_ids.length < 2) {
            play("drum", 1.4);
          }
          break;
        }
      }
      return;
    }

    if (state.phase === "question") {
      const iAnsweredNow =
        state.answered_player_ids.includes(me) && !before.answered_player_ids.includes(me);
      const othersNow = state.answered_player_ids.filter(
        (id) => id !== me && !before.answered_player_ids.includes(id),
      ).length;
      if (iAnsweredNow) play("pop");
      else if (othersNow > 0) play("blip");
    }
  }, [state, me]);
}
