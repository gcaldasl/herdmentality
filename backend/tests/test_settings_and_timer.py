"""Lobby settings (target, timer, categories), round deadlines, sudden death."""

from datetime import datetime, timezone

import pytest
from sqlmodel import select

from app.game import engine, room_service
from app.game.questions import pick_question
from app.models import Question, Round


def _room(session, players=("Ann", "Bob", "Cara")):
    code, host = room_service.create_room(session, players[0])
    ids = [host] + [room_service.join_room(session, code, n) for n in players[1:]]
    for pid in ids:
        room_service.set_connected(session, code, pid, True)
    return code, ids


def _current(session, code) -> Round:
    return session.get(Round, room_service.get_room(session, code).current_round_id)


# ---------- sudden death ----------

def test_tied_leaders_at_target_means_no_winner_yet():
    scores = {"a": 8, "b": 8, "c": 5}
    assert engine.check_winner(scores, cow_holder=None, win_target=8) is None
    assert engine.tied_leaders(scores, cow_holder=None, win_target=8) == ["a", "b"]


def test_a_clear_leader_still_wins_over_others_at_target():
    scores = {"a": 9, "b": 8}
    assert engine.check_winner(scores, cow_holder=None, win_target=8) == "a"
    assert engine.tied_leaders(scores, cow_holder=None, win_target=8) == []


def test_cow_holder_does_not_count_towards_a_tie():
    scores = {"a": 8, "b": 8}
    assert engine.check_winner(scores, cow_holder="a", win_target=8) == "b"
    assert engine.tied_leaders(scores, cow_holder="a", win_target=8) == []


def test_tie_keeps_the_game_going_and_is_reported(session):
    code, (ann, bob, cara) = _room(session)
    room_service.update_settings(session, code, ann, {"win_target": 5})
    room_service.start_game(session, code, ann)
    for pid in (ann, bob):
        p = session.get(room_service.Player, pid)
        p.score = 4
        session.add(p)
    session.commit()
    # Ann and Bob both reach 5 in the same round; Cara answers alone (takes the cow).
    room_service.submit_answer(session, code, ann, "gato")
    room_service.submit_answer(session, code, bob, "gato")
    room_service.submit_answer(session, code, cara, "zebra")
    room_service.confirm_groups(session, code, ann)

    state = room_service.build_state(session, code)
    assert state["phase"] == "scoring"
    assert state["winner_player_id"] is None
    assert sorted(state["tied_player_ids"]) == sorted([ann, bob])


# ---------- settings ----------

def test_room_uses_its_own_win_target(session):
    code, (ann, bob, cara) = _room(session)
    assert room_service.build_state(session, code)["win_target"] == 8
    room_service.update_settings(session, code, ann, {"win_target": 12})
    assert room_service.build_state(session, code)["win_target"] == 12


@pytest.mark.parametrize(
    "changes",
    [
        {"win_target": 7},
        {"timer_seconds": 10},
        {"categories": ["nope"]},
        {"categories": []},
        {"question_mode": "chaos"},
    ],
)
def test_invalid_settings_are_rejected(session, changes):
    code, (ann, *_rest) = _room(session)
    with pytest.raises(room_service.GameError):
        room_service.update_settings(session, code, ann, changes)


def test_only_host_in_lobby_can_change_settings(session):
    code, (ann, bob, cara) = _room(session)
    with pytest.raises(room_service.GameError):
        room_service.update_settings(session, code, bob, {"win_target": 5})
    room_service.start_game(session, code, ann)
    with pytest.raises(room_service.GameError):
        room_service.update_settings(session, code, ann, {"win_target": 5})


def test_selecting_every_category_is_stored_as_all(session):
    code, (ann, *_rest) = _room(session)
    every = [c["id"] for c in room_service.build_state(session, code)["categories_available"]]
    room_service.update_settings(session, code, ann, {"categories": every})
    assert room_service.build_state(session, code)["categories"] == []


def test_deck_only_draws_selected_categories(session):
    code, (ann, bob, cara) = _room(session)
    room_service.update_settings(session, code, ann, {"categories": ["estimate"]})
    room_service.start_game(session, code, ann)
    q = session.get(Question, _current(session, code).question_id)
    assert q.category == "estimate"


def test_category_cycle_keeps_other_categories_used(session):
    herd = [q.id for q in session.exec(select(Question).where(Question.category == "herd")).all()]
    other = session.exec(select(Question).where(Question.category == "opinion")).first().id
    question, used = pick_question(session, [other, *herd], ["herd"])
    assert question.category == "herd"
    assert other in used  # the other category's history survives the herd reshuffle


# ---------- timer ----------

def test_timer_sets_a_deadline_and_expiry_reveals_with_who_answered(session):
    code, (ann, bob, cara) = _room(session)
    room_service.update_settings(session, code, ann, {"timer_seconds": 30})
    room_service.start_game(session, code, ann)

    current = _current(session, code)
    state = room_service.build_state(session, code)
    assert state["deadline"] is not None
    seconds = (
        datetime.fromisoformat(state["deadline"]) - datetime.now(timezone.utc)
    ).total_seconds()
    assert 25 < seconds <= 30
    assert room_service.pending_deadline(session, code)[0] == current.id

    room_service.submit_answer(session, code, ann, "gato")
    room_service.submit_answer(session, code, bob, "gato")
    assert room_service.expire_round(session, code, current.id) is True

    state = room_service.build_state(session, code)
    assert state["phase"] == "reveal"
    assert state["deadline"] is None
    in_groups = {pid for g in state["groups"] for pid in g["player_ids"]}
    assert in_groups == {ann, bob}  # Cara never answered: left out entirely


def test_stale_expiry_is_ignored(session):
    code, (ann, bob, cara) = _room(session)
    room_service.update_settings(session, code, ann, {"timer_seconds": 30})
    room_service.start_game(session, code, ann)
    round_id = _current(session, code).id
    for pid in (ann, bob, cara):
        room_service.submit_answer(session, code, pid, "gato")  # everyone answered in time
    assert room_service.expire_round(session, code, round_id) is False


def test_no_timer_means_no_deadline(session):
    code, (ann, *_rest) = _room(session)
    room_service.start_game(session, code, ann)
    assert room_service.build_state(session, code)["deadline"] is None
    assert room_service.pending_deadline(session, code) is None


def test_player_dropping_mid_question_no_longer_stalls_the_round(session):
    code, (ann, bob, cara) = _room(session)
    room_service.start_game(session, code, ann)
    room_service.submit_answer(session, code, ann, "gato")
    room_service.submit_answer(session, code, bob, "gato")
    room_service.set_connected(session, code, cara, False, handoff=False)
    assert room_service.build_state(session, code)["phase"] == "question"
    assert room_service.handoff_if_absent(session, code, cara) is True
    assert room_service.build_state(session, code)["phase"] == "reveal"
