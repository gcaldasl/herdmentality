"""questions.json <-> question table sync."""

import pytest
from sqlmodel import select

from app.game import questions, room_service
from app.game.questions import seed_questions
from app.models import Question, Round


def _use_json(monkeypatch, items):
    monkeypatch.setattr(questions, "load_seed_questions", lambda: items)


def _rows(session):
    return {q.id: (q.text, q.category) for q in session.exec(select(Question)).all()}


def test_numeric_ids_can_be_seeded_repeatedly(session, monkeypatch):
    # Regression: int ids were stored as text "1", so a restart failed to match
    # them and re-inserted -> UNIQUE constraint failed: question.id
    _use_json(monkeypatch, [{"id": 1, "text": "A?", "category": "x"}, {"id": 2, "text": "B?"}])
    seed_questions(session)
    seed_questions(session)
    assert _rows(session) == {"1": ("A?", "x"), "2": ("B?", "general")}


def test_seed_updates_changed_text_and_removes_dropped_questions(session, monkeypatch):
    _use_json(monkeypatch, [{"id": "q1", "text": "Old?"}, {"id": "q2", "text": "Gone?"}])
    seed_questions(session)
    _use_json(monkeypatch, [{"id": "q1", "text": "New?"}, {"id": 3, "text": "Added?"}])
    seed_questions(session)
    assert _rows(session) == {"q1": ("New?", "general"), "3": ("Added?", "general")}


def test_duplicate_ids_in_the_json_are_reported(session, monkeypatch):
    _use_json(monkeypatch, [{"id": 1, "text": "A?"}, {"id": "1", "text": "B?"}])
    with pytest.raises(ValueError, match="duplicate id"):
        seed_questions(session)


def test_live_round_keeps_its_question_when_the_deck_changes(session, monkeypatch):
    code, ann = room_service.create_room(session, "Ann")
    bob = room_service.join_room(session, code, "Bob")
    for pid in (ann, bob):
        room_service.set_connected(session, code, pid, True)
    room_service.start_game(session, code, ann)
    shown = room_service.build_state(session, code)["question"]
    assert shown

    _use_json(monkeypatch, [{"id": "brand-new", "text": "Totally different?"}])
    seed_questions(session)  # the live round's question is deleted from the deck

    state = room_service.build_state(session, code)
    assert state["question"] == shown
    assert state["question_is_custom"] is False
    round_ = session.get(Round, room_service.get_room(session, code).current_round_id)
    assert round_.question_text == shown
