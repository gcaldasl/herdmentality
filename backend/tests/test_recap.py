"""End-of-game recap: rounds + awards."""

from app.game import room_service
from app.game.recap import RecapRound, build_recap


def _r(n, groups, herd=None, cow=None):
    return RecapRound(
        number=n,
        question=f"Q{n}?",
        groups=[{"key": k, "label": k.title(), "player_ids": ids} for k, ids in groups],
        herd_group_key=herd,
        cow_holder_after=cow,
    )


def _award(recap, award_id):
    return next((a for a in recap["awards"] if a["id"] == award_id), None)


def test_awards_count_herds_solos_and_cow_streaks():
    rounds = [
        _r(1, [("gato", ["a", "b"]), ("cão", ["c"])], herd="gato", cow="c"),
        _r(2, [("sol", ["a", "c"]), ("lua", ["b"])], herd="sol", cow="b"),
        _r(3, [("azul", ["a", "c"]), ("verde", ["b"])], herd="azul", cow="b"),
        _r(4, [("x", ["a", "b", "c"])], herd="x", cow="b"),
    ]
    recap = build_recap(rounds, ["a", "b", "c"])

    assert _award(recap, "loyal_sheep") == {"id": "loyal_sheep", "player_ids": ["a"], "value": 4}
    assert _award(recap, "lone_wolf") == {"id": "lone_wolf", "player_ids": ["b"], "value": 2}
    # b held the cow for rounds 2-4 (streak 3); c only for round 1
    assert _award(recap, "cow_keeper") == {"id": "cow_keeper", "player_ids": ["b"], "value": 3}
    assert [r["herd_label"] for r in recap["rounds"]] == ["Gato", "Sol", "Azul", "X"]


def test_ties_share_an_award_and_empty_awards_are_dropped():
    rounds = [
        _r(1, [("gato", ["a", "b"]), ("cão", ["c", "d"])], herd=None),
    ]
    recap = build_recap(rounds, ["a", "b", "c", "d"])
    assert recap["awards"] == []  # no herd, nobody alone, no cow
    assert recap["rounds"][0]["herd_label"] is None
    assert recap["rounds"][0]["tied_labels"] == ["Gato", "Cão"]


def test_cow_streak_resets_when_the_cow_moves_away_and_back():
    rounds = [
        _r(1, [("a", ["a"]), ("b", ["b", "c"])], herd="b", cow="a"),
        _r(2, [("x", ["b"]), ("y", ["a", "c"])], herd="y", cow="b"),
        _r(3, [("p", ["a"]), ("q", ["b", "c"])], herd="q", cow="a"),
    ]
    recap = build_recap(rounds, ["a", "b", "c"])
    assert _award(recap, "cow_keeper") == {"id": "cow_keeper", "player_ids": ["a", "b"], "value": 1}


def test_game_over_state_carries_the_recap(session):
    code, ann = room_service.create_room(session, "Ann")
    bob = room_service.join_room(session, code, "Bob")
    cara = room_service.join_room(session, code, "Cara")
    for pid in (ann, bob, cara):
        room_service.set_connected(session, code, pid, True)
    room_service.update_settings(session, code, ann, {"win_target": 5})
    room_service.start_game(session, code, ann)

    # Round 1: Ann+Cara herd, Bob alone. Rounds 2-5: Ann+Bob herd, Cara alone.
    # Ann reaches 5 alone (Bob ends on 4), so there's no sudden-death tie.
    for n in range(5):
        room_service.submit_answer(session, code, ann, "gato")
        room_service.submit_answer(session, code, bob, "zebra" if n == 0 else "gato")
        room_service.submit_answer(session, code, cara, "gato" if n == 0 else f"zebra{n}")
        room_service.confirm_groups(session, code, ann)
        state = room_service.build_state(session, code)
        if state["phase"] == "scoring":
            assert state["recap"] is None
            room_service.next_round(session, code, ann)

    state = room_service.build_state(session, code)
    assert state["phase"] == "game_over"
    recap = state["recap"]
    assert [r["number"] for r in recap["rounds"]] == [1, 2, 3, 4, 5]
    assert all(r["herd_label"] == "gato" for r in recap["rounds"])
    assert all(r["question"] for r in recap["rounds"])
    assert _award(recap, "loyal_sheep") == {"id": "loyal_sheep", "player_ids": [ann], "value": 5}
    assert _award(recap, "lone_wolf") == {"id": "lone_wolf", "player_ids": [cara], "value": 4}
    assert _award(recap, "cow_keeper") == {"id": "cow_keeper", "player_ids": [cara], "value": 4}
    assert state["winner_player_id"] == ann
