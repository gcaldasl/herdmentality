"""Players mode: a rotating chooser writes (or draws) each round's question."""

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlmodel import SQLModel

from app.db import add_missing_columns
from app.game import engine, room_service
from app.models import Round


# ---------- pure rotation ----------

def test_next_chooser_rotates_in_order_and_wraps():
    order = ["a", "b", "c"]
    everyone = set(order)
    assert engine.next_chooser(order, everyone, None) == "a"
    assert engine.next_chooser(order, everyone, "a") == "b"
    assert engine.next_chooser(order, everyone, "c") == "a"


def test_next_chooser_skips_disconnected_players():
    assert engine.next_chooser(["a", "b", "c"], {"a", "c"}, "a") == "c"
    assert engine.next_chooser(["a", "b", "c"], {"b"}, "b") == "b"
    assert engine.next_chooser(["a", "b"], set(), "a") is None


# ---------- room flow ----------

def _room(session, mode="players"):
    code, ann = room_service.create_room(session, "Ann")
    bob = room_service.join_room(session, code, "Bob")
    cara = room_service.join_room(session, code, "Cara")
    for pid in (ann, bob, cara):
        room_service.set_connected(session, code, pid, True)
    room_service.set_question_mode(session, code, ann, mode)
    return code, ann, bob, cara


def _state(session, code):
    return room_service.build_state(session, code)


def _play_round(session, code, host, ids):
    for pid in ids:
        room_service.submit_answer(session, code, pid, "gato")
    room_service.confirm_groups(session, code, host)


def test_deck_mode_is_default_and_unchanged(session):
    code, ann = room_service.create_room(session, "Ann")
    bob = room_service.join_room(session, code, "Bob")
    room_service.start_game(session, code, ann)
    state = _state(session, code)
    assert state["question_mode"] == "deck"
    assert state["phase"] == "question"
    assert state["chooser_player_id"] is None
    assert state["question"]


def test_host_chooses_first_and_written_question_is_used(session):
    code, ann, bob, cara = _room(session)
    room_service.start_game(session, code, ann)

    state = _state(session, code)
    assert state["phase"] == "choosing"
    assert state["chooser_player_id"] == ann
    assert state["question"] is None

    room_service.write_question(session, code, ann, "  Diga um   bicho fofo.  ")
    state = _state(session, code)
    assert state["phase"] == "question"
    assert state["question"] == "Diga um bicho fofo."
    assert state["question_author_id"] == ann
    assert state["question_is_custom"] is True
    assert state["round_number"] == 1


def test_turn_rotates_each_round(session):
    code, ann, bob, cara = _room(session)
    room_service.start_game(session, code, ann)
    room_service.write_question(session, code, ann, "Diga uma cor.")
    _play_round(session, code, ann, (ann, bob, cara))
    room_service.next_round(session, code, ann)

    state = _state(session, code)
    assert state["phase"] == "choosing"
    assert state["chooser_player_id"] == bob

    room_service.draw_question(session, code, bob)
    state = _state(session, code)
    assert state["phase"] == "question"
    assert state["question"] and state["question"] != "Diga uma cor."
    assert state["question_author_id"] == bob
    assert state["question_is_custom"] is False
    assert state["round_number"] == 2


def test_only_the_chooser_can_write(session):
    code, ann, bob, cara = _room(session)
    room_service.start_game(session, code, ann)
    with pytest.raises(room_service.GameError):
        room_service.write_question(session, code, bob, "Diga uma fruta.")
    with pytest.raises(room_service.GameError):
        room_service.draw_question(session, code, bob)


def test_host_can_draw_for_an_absent_chooser(session):
    code, ann, bob, cara = _room(session)
    room_service.start_game(session, code, ann)
    room_service.write_question(session, code, ann, "Diga uma cor.")
    _play_round(session, code, ann, (ann, bob, cara))
    room_service.next_round(session, code, ann)  # Bob's turn

    room_service.draw_question(session, code, ann)
    state = _state(session, code)
    assert state["phase"] == "question"
    assert state["question_author_id"] == bob


def test_chooser_disconnecting_passes_the_turn(session):
    code, ann, bob, cara = _room(session)
    room_service.start_game(session, code, ann)
    room_service.write_question(session, code, ann, "Diga uma cor.")
    _play_round(session, code, ann, (ann, bob, cara))
    room_service.next_round(session, code, ann)  # Bob's turn

    room_service.set_connected(session, code, bob, False, handoff=False)
    assert _state(session, code)["chooser_player_id"] == bob  # grace period: still Bob

    assert room_service.handoff_if_absent(session, code, bob) is True
    assert _state(session, code)["chooser_player_id"] == cara


def test_chooser_back_within_grace_keeps_the_turn(session):
    code, ann, bob, cara = _room(session)
    room_service.start_game(session, code, ann)
    room_service.set_connected(session, code, ann, False, handoff=False)
    room_service.set_connected(session, code, ann, True)
    assert room_service.handoff_if_absent(session, code, ann) is False
    assert _state(session, code)["chooser_player_id"] == ann


@pytest.mark.parametrize("bad", ["", "   ", "oi", "x" * 141])
def test_question_length_is_validated(session, bad):
    code, ann, bob, cara = _room(session)
    room_service.start_game(session, code, ann)
    with pytest.raises(room_service.GameError):
        room_service.write_question(session, code, ann, bad)


def test_mode_can_only_change_in_lobby_by_host(session):
    code, ann, bob, cara = _room(session, mode="deck")
    with pytest.raises(room_service.GameError):
        room_service.set_question_mode(session, code, bob, "players")
    with pytest.raises(room_service.GameError):
        room_service.set_question_mode(session, code, ann, "chaos")
    room_service.start_game(session, code, ann)
    with pytest.raises(room_service.GameError):
        room_service.set_question_mode(session, code, ann, "players")


def test_custom_questions_do_not_consume_the_deck(session):
    code, ann, bob, cara = _room(session)
    room_service.start_game(session, code, ann)
    room_service.write_question(session, code, ann, "Diga uma cor.")
    assert room_service.get_room(session, code).used_question_ids == []
    current = session.get(Round, room_service.get_room(session, code).current_round_id)
    assert current.question_text == "Diga uma cor."


def test_restart_resets_the_rotation(session):
    code, ann, bob, cara = _room(session)
    room_service.start_game(session, code, ann)
    room_service.write_question(session, code, ann, "Diga uma cor.")
    room_service.restart(session, code, ann)
    assert room_service.get_room(session, code).chooser_player_id is None
    assert room_service.get_room(session, code).question_mode == "players"


# ---------- migration ----------

def test_add_missing_columns_upgrades_an_old_database():
    old = create_engine("sqlite://")
    with old.begin() as conn:
        conn.execute(text("CREATE TABLE room (code VARCHAR PRIMARY KEY, phase VARCHAR NOT NULL)"))
        conn.execute(text("INSERT INTO room (code, phase) VALUES ('ABCD', 'lobby')"))
    SQLModel.metadata.create_all(old)  # creates the other tables, leaves `room` alone
    add_missing_columns(old)

    columns = {c["name"] for c in inspect(old).get_columns("room")}
    assert {"question_mode", "chooser_player_id", "used_question_ids"} <= columns
    with old.connect() as conn:
        assert conn.execute(text("SELECT question_mode FROM room")).scalar() == "deck"
    add_missing_columns(old)  # idempotent
