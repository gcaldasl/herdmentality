"""Pure game logic: scoring, the Pink Cow, and the win check.

Nothing in here touches the database or the network so it can be unit-tested
in isolation.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class RoundResult:
    herd_group_key: str | None
    point_deltas: dict[str, int] = field(default_factory=dict)
    previous_cow_holder: str | None = None
    new_cow_holder: str | None = None
    cow_round: bool = False
    # Sour milk: who held the cow for the whole round (loses a point); the
    # room service applies it with a floor of 0.
    sour_milk_player_id: str | None = None

    @property
    def cow_moved(self) -> bool:
        return self.new_cow_holder != self.previous_cow_holder


def resolve_round(
    groups: list[dict],
    current_cow_holder: str | None,
    cow_round: bool = False,
    sour_milk: bool = False,
) -> RoundResult:
    """Score a round from its final (host-confirmed) groups.

    - The herd is the single largest group; everyone in it gets +1.
    - A tie for largest means there is no herd and nobody scores.
    - The Pink Cow goes to the one player who answered alone. If nobody is
      alone, or two or more players are each alone, the cow does not move.

    Variants:
    - Cow round: the goal flips - every lone answer scores +1, the herd gets
      nothing, and the cow stays put (being alone is the point this round).
    - Sour milk: whoever held the cow for the whole round (had it before and
      still has it after) is flagged to lose a point.
    """
    non_empty = [g for g in groups if g["player_ids"]]
    loners = [g["player_ids"][0] for g in non_empty if len(g["player_ids"]) == 1]

    herd_key: str | None = None
    point_deltas: dict[str, int] = {}
    if cow_round:
        point_deltas = {player_id: 1 for player_id in loners}
    elif non_empty:
        top_size = max(len(g["player_ids"]) for g in non_empty)
        largest = [g for g in non_empty if len(g["player_ids"]) == top_size]
        if len(largest) == 1 and top_size >= 1:
            herd = largest[0]
            herd_key = herd["key"]
            for player_id in herd["player_ids"]:
                point_deltas[player_id] = 1

    new_cow_holder = current_cow_holder
    if len(loners) == 1 and not cow_round:
        new_cow_holder = loners[0]

    soured = (
        current_cow_holder
        if sour_milk and current_cow_holder is not None and new_cow_holder == current_cow_holder
        else None
    )

    return RoundResult(
        herd_group_key=herd_key,
        point_deltas=point_deltas,
        previous_cow_holder=current_cow_holder,
        new_cow_holder=new_cow_holder,
        cow_round=cow_round,
        sour_milk_player_id=soured,
    )


def is_cow_round(mode: str, number: int, previous_was_cow: bool, roll: float) -> bool:
    """Whether round `number` is a Cow Round. "every4": rounds 4, 8, 12...
    "random": ~1 in 4, never round 1 and never twice in a row. `roll` is a
    random float in [0, 1) passed in so this stays pure."""
    if mode == "every4":
        return number % 4 == 0
    if mode == "random":
        return number > 1 and not previous_was_cow and roll < 0.25
    return False


def next_chooser(
    order: list[str], connected: set[str], previous: str | None
) -> str | None:
    """Who picks the next question: the first connected player after `previous`
    in join order (wrapping around). With no previous chooser, the first
    connected player in order. None if nobody is connected."""
    if not order:
        return None
    start = order.index(previous) + 1 if previous in order else 0
    for offset in range(len(order)):
        candidate = order[(start + offset) % len(order)]
        if candidate in connected:
            return candidate
    return None


def check_winner(
    scores: dict[str, int], cow_holder: str | None, win_target: int
) -> str | None:
    """Return the winning player id, or None if the game continues.

    A player wins by reaching the target score, but the current Pink Cow
    holder can never win - they must pass the cow on first. If the best
    eligible scores are tied, nobody wins yet: play continues as sudden death
    until one of them pulls ahead.
    """
    contenders = [
        (player_id, score)
        for player_id, score in scores.items()
        if score >= win_target and player_id != cow_holder
    ]
    if not contenders:
        return None
    best = max(score for _, score in contenders)
    leaders = [player_id for player_id, score in contenders if score == best]
    return leaders[0] if len(leaders) == 1 else None


def tied_leaders(
    scores: dict[str, int], cow_holder: str | None, win_target: int
) -> list[str]:
    """Players in a sudden-death tie: 2+ eligible players sharing the best
    score at or above the target. Empty when there's no tie."""
    contenders = {
        player_id: score
        for player_id, score in scores.items()
        if score >= win_target and player_id != cow_holder
    }
    if len(contenders) < 2:
        return []
    best = max(contenders.values())
    leaders = sorted(pid for pid, score in contenders.items() if score == best)
    return leaders if len(leaders) > 1 else []
