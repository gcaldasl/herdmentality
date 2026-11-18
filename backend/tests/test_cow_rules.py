"""Pink Cow variants: Cow Rounds and Sour Milk."""

import pytest

from app.game import engine, room_service
from app.models import Round

G = lambda *groups: [{"key": k, "label": k, "player_ids": ids} for k, ids in groups]  # noqa: E731


# ---------- engine ----------

def test_cow_round_scores_every_loner_and_not_the_herd():
    groups = G(("gato", ["a", "b"]), ("zebra", ["c"]), ("lhama", ["d"]))
    result = engine.resolve_round(groups, current_cow_holder=None, cow_round=True)
    assert result.point_deltas == {"c": 1, "d": 1}
    assert result.herd_group_key is None


def test_cow_does_not_move_in_a_cow_round():
    groups = G(("gato", ["a", "b"]), ("zebra", ["c"]))
    result = engine.resolve_round(groups, current_cow_holder="a", cow_round=True)
    assert result.new_cow_holder == "a"
    assert not result.cow_moved


def test_sour_milk_hits_whoever_kept_the_cow_all_round():
    groups = G(("gato", ["a", "b"]), ("cão", ["c", "d"]))  # nobody alone: cow stays
    result = engine.resolve_round(groups, current_cow_holder="c", sour_milk=True)
    assert result.sour_milk_player_id == "c"


def test_no_sour_milk_when_the_cow_moves_or_the_rule_is_off():
    moved = engine.resolve_round(G(("gato", ["a", "b"]), ("x", ["c"])), "a", sour_milk=True)
    assert moved.new_cow_holder == "c" and moved.sour_milk_player_id is None
    off = engine.resolve_round(G(("gato", ["a", "b"])), "a", sour_milk=False)
    assert off.sour_milk_player_id is None
    nobody = engine.resolve_round(G(("gato", ["a", "b"])), None, sour_milk=True)
    assert nobody.sour_milk_player_id is None


@pytest.mark.parametrize(
    "mode,number,prev,roll,expected",
    [
        ("off", 4, False, 0.0, False),
        ("every4", 4, False, 0.9, True),
        ("every4", 5, False, 0.0, False),
        ("random", 1, False, 0.0, False),  # never the first round
        ("random", 3, True, 0.0, False),  # never twice in a row
        ("random", 3, False, 0.1, True),
        ("random", 3, False, 0.5, False),
    ],
)
def test_cow_round_schedule(mode, number, prev, roll, expected):
    assert engine.is_cow_round(mode, number, prev, roll) is expected


# ---------- room flow ----------

def _room(session, **settings):
    code, ann = room_service.create_room(session, "Ann")
    bob = room_service.join_room(session, code, "Bob")
    cara = room_service.join_room(session, code, "Cara")
    for pid in (ann, bob, cara):
        room_service.set_connected(session, code, pid, True)
    if settings:
        room_service.update_settings(session, code, ann, settings)
    room_service.start_game(session, code, ann)
    return code, ann, bob, cara


def _play(session, code, host, answers):
    for pid, text in answers.items():
        room_service.submit_answer(session, code, pid, text)
    room_service.confirm_groups(session, code, host)
    return room_service.build_state(session, code)


def _score(session, pid):
    return session.get(room_service.Player, pid).score


def test_every_fourth_round_is_a_cow_round_and_scores_loners(session):
    code, ann, bob, cara = _room(session, cow_rounds="every4")
    for n in range(1, 4):
        state = room_service.build_state(session, code)
        assert state["cow_round"] is False, n
        _play(session, code, ann, {ann: "gato", bob: "gato", cara: f"z{n}"})
        room_service.next_round(session, code, ann)

    state = room_service.build_state(session, code)
    assert state["round_number"] == 4 and state["cow_round"] is True
    before = {pid: _score(session, pid) for pid in (ann, bob, cara)}
    state = _play(session, code, ann, {ann: "gato", bob: "gato", cara: "zebra"})
    assert state["result"]["cow_round"] is True
    assert state["result"]["point_deltas"] == {cara: 1}
    assert _score(session, cara) == before[cara] + 1
    assert _score(session, ann) == before[ann]


def test_sour_milk_costs_the_holder_a_point_but_never_below_zero(session):
    code, ann, bob, cara = _room(session, sour_milk=True)
    # Round 1: Cara alone -> gets the cow (no sour milk: she just received it).
    state = _play(session, code, ann, {ann: "gato", bob: "gato", cara: "zebra"})
    assert state["result"]["sour_milk_player_id"] is None
    room_service.next_round(session, code, ann)
    # Round 2: nobody alone -> cow stays with Cara. Her +1 from the herd sours away.
    state = _play(session, code, ann, {ann: "gato", bob: "gato", cara: "gato"})
    assert state["result"]["sour_milk_player_id"] == cara
    assert state["result"]["sour_milk_lost"] == 1
    assert _score(session, cara) == 0
    room_service.next_round(session, code, ann)
    # Round 3: Cara alone again (keeps the cow), no points, already on 0 ->
    # flagged but nothing to lose.
    state = _play(session, code, ann, {ann: "gato", bob: "gato", cara: "cão"})
    assert state["result"]["sour_milk_player_id"] == cara
    assert state["result"]["sour_milk_lost"] == 0
    assert _score(session, cara) == 0


def test_cow_settings_validation(session):
    code, ann = room_service.create_room(session, "Ann")
    with pytest.raises(room_service.GameError):
        room_service.update_settings(session, code, ann, {"cow_rounds": "always"})
    with pytest.raises(room_service.GameError):
        room_service.update_settings(session, code, ann, {"sour_milk": "yes"})
    room_service.update_settings(session, code, ann, {"cow_rounds": "random", "sour_milk": True})
    state = room_service.build_state(session, code)
    assert state["cow_rounds"] == "random" and state["sour_milk"] is True


def test_recap_marks_cow_rounds(session):
    code, ann, bob, cara = _room(session, cow_rounds="every4", win_target=5)
    rounds = [
        {ann: "gato", bob: "gato", cara: "a"},
        {ann: "gato", bob: "b", cara: "gato"},
        {ann: "gato", bob: "c", cara: "gato"},
        {ann: "d", bob: "gato", cara: "gato"},  # cow round: Ann alone scores
        {ann: "gato", bob: "gato", cara: "e"},
    ]
    for i, answers in enumerate(rounds):
        state = _play(session, code, ann, answers)
        if state["phase"] == "game_over":
            break
        room_service.next_round(session, code, ann)
    assert state["phase"] == "game_over"
    r4 = state["recap"]["rounds"][3]
    assert r4["cow_round"] is True
    assert r4["solo"] == [{"label": "d", "player_id": ann}]
    assert r4["tied_labels"] == []
    assert session.get(Round, room_service.get_room(session, code).current_round_id).number == 5
