"""End-of-game recap: every round's herd answer plus a few fun awards.

Pure (no database), like engine.py, so it can be unit-tested directly. The
room service feeds it the game's resolved rounds in order.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RecapRound:
    number: int
    question: str
    groups: list[dict]  # [{key, label, player_ids}]
    herd_group_key: str | None
    cow_holder_after: str | None  # who held the Pink Cow once the round was scored
    cow_round: bool = False  # lone answers scored instead of the herd


def _leaders(counts: dict[str, int]) -> tuple[list[str], int]:
    """Everyone tied for the highest count (empty if the best is 0)."""
    best = max(counts.values(), default=0)
    if best <= 0:
        return [], 0
    return sorted(pid for pid, n in counts.items() if n == best), best


def build_recap(rounds: list[RecapRound], player_ids: list[str]) -> dict:
    herd_counts = {pid: 0 for pid in player_ids}
    solo_counts = {pid: 0 for pid in player_ids}
    cow_streak_best = {pid: 0 for pid in player_ids}
    streak_holder: str | None = None
    streak = 0

    rounds_view = []
    for r in rounds:
        herd = next((g for g in r.groups if g["key"] == r.herd_group_key), None)
        loners = [g["player_ids"][0] for g in r.groups if len(g["player_ids"]) == 1]
        for pid in herd["player_ids"] if herd else []:
            if pid in herd_counts:
                herd_counts[pid] += 1
        for pid in loners:
            if pid in solo_counts:
                solo_counts[pid] += 1

        holder = r.cow_holder_after
        streak = streak + 1 if holder is not None and holder == streak_holder else (1 if holder else 0)
        streak_holder = holder
        if holder in cow_streak_best:
            cow_streak_best[holder] = max(cow_streak_best[holder], streak)

        top = max((len(g["player_ids"]) for g in r.groups), default=0)
        rounds_view.append(
            {
                "number": r.number,
                "question": r.question,
                "herd_label": herd["label"] if herd else None,
                "herd_player_ids": list(herd["player_ids"]) if herd else [],
                # labels of the groups that tied for biggest, when there was no herd
                "tied_labels": []
                if herd or r.cow_round
                else [g["label"] for g in r.groups if top and len(g["player_ids"]) == top],
                "cow_holder_after": holder,
                "cow_round": r.cow_round,
                # cow rounds: the lone answers that scored
                "solo": [
                    {"label": g["label"], "player_id": g["player_ids"][0]}
                    for g in r.groups
                    if len(g["player_ids"]) == 1
                ]
                if r.cow_round
                else [],
            }
        )

    awards = []
    for award_id, counts in (
        ("loyal_sheep", herd_counts),
        ("lone_wolf", solo_counts),
        ("cow_keeper", cow_streak_best),
    ):
        winners, value = _leaders(counts)
        if winners:
            awards.append({"id": award_id, "player_ids": winners, "value": value})

    return {"rounds": rounds_view, "awards": awards}
