"""Everyone answered -> a short window to change answers -> staged reveal."""

from datetime import datetime, timezone

import pytest

from app.config import settings
from app.game import room_service
from app.models import Round


@pytest.fixture
def last_chance(monkeypatch):
    monkeypatch.setattr(settings, "last_chance_seconds", 3)


def _room(session, timer=0):
    code, ann = room_service.create_room(session, "Ann")
    bob = room_service.join_room(session, code, "Bob")
    for pid in (ann, bob):
        room_service.set_connected(session, code, pid, True)
    if timer:
        room_service.update_settings(session, code, ann, {"timer_seconds": timer})
    room_service.start_game(session, code, ann)
    return code, ann, bob


def _secs_left(state) -> float:
    deadline = datetime.fromisoformat(state["deadline"])
    return (deadline - datetime.now(timezone.utc)).total_seconds()


def _round(session, code) -> Round:
    return session.get(Round, room_service.get_room(session, code).current_round_id)


def test_all_answered_opens_a_short_editable_window(session, last_chance):
    code, ann, bob = _room(session)
    room_service.submit_answer(session, code, ann, "gato")
    assert room_service.build_state(session, code)["closing"] is False

    room_service.submit_answer(session, code, bob, "cão")
    state = room_service.build_state(session, code)
    assert state["phase"] == "question"
    assert state["closing"] is True
    assert 2 < _secs_left(state) <= 3

    # still editable during the window
    room_service.submit_answer(session, code, bob, "gato")
    round_id = _round(session, code).id
    assert room_service.expire_round(session, code, round_id) is True
    state = room_service.build_state(session, code)
    assert state["phase"] == "reveal"
    assert [g["player_ids"] for g in state["groups"]] == [[ann, bob]]


def test_edits_during_the_window_do_not_extend_it(session, last_chance):
    code, ann, bob = _room(session)
    room_service.submit_answer(session, code, ann, "gato")
    room_service.submit_answer(session, code, bob, "cão")
    first = _round(session, code).deadline
    room_service.submit_answer(session, code, bob, "gato")
    assert _round(session, code).deadline == first


def test_window_cuts_a_longer_timer_short(session, last_chance):
    code, ann, bob = _room(session, timer=60)
    assert _secs_left(room_service.build_state(session, code)) > 50
    room_service.submit_answer(session, code, ann, "gato")
    room_service.submit_answer(session, code, bob, "gato")
    assert _secs_left(room_service.build_state(session, code)) <= 3


def test_reveal_is_timestamped_for_the_staged_animation(session):
    code, ann, bob = _room(session)
    assert room_service.build_state(session, code)["revealed_at"] is None
    room_service.submit_answer(session, code, ann, "gato")
    room_service.submit_answer(session, code, bob, "gato")  # instant reveal (fixture)
    state = room_service.build_state(session, code)
    assert state["phase"] == "reveal"
    age = datetime.now(timezone.utc) - datetime.fromisoformat(state["revealed_at"])
    assert 0 <= age.total_seconds() < 5
