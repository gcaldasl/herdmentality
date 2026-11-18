"""The deck: no repeats within a room (across rematches) until it's exhausted."""

from sqlmodel import select

from app.game import room_service
from app.game.questions import pick_question
from app.models import Question, Round


def _deck_size(session) -> int:
    return len(session.exec(select(Question)).all())


def test_pick_question_never_repeats_until_the_deck_is_exhausted(session):
    used: list[str] = []
    seen: list[str] = []
    for _ in range(_deck_size(session)):
        question, used = pick_question(session, used)
        seen.append(question.id)
    assert len(seen) == len(set(seen)) == _deck_size(session)


def test_exhausted_deck_starts_a_new_cycle_without_back_to_back_repeat(session):
    all_ids = [q.id for q in session.exec(select(Question)).all()]
    last = all_ids[-1]
    for _ in range(20):  # random choice: check it repeatedly
        question, used = pick_question(session, [*all_ids[:-1], last])
        assert question.id != last
        assert used == [question.id]


def test_rematch_does_not_replay_questions_from_earlier_games(session):
    code, ann = room_service.create_room(session, "Ann")
    bob = room_service.join_room(session, code, "Bob")
    for pid in (ann, bob):
        room_service.set_connected(session, code, pid, True)

    def play_game(rounds: int) -> list[str]:
        room_service.start_game(session, code, ann)
        ids = []
        for i in range(rounds):
            room = room_service.get_room(session, code)
            ids.append(session.get(Round, room.current_round_id).question_id)
            room_service.submit_answer(session, code, ann, "gato")
            room_service.submit_answer(session, code, bob, "gato")
            room_service.confirm_groups(session, code, ann)
            if i < rounds - 1:
                room_service.next_round(session, code, ann)
        room_service.restart(session, code, ann)
        return ids

    first = play_game(3)
    second = play_game(3)
    assert not set(first) & set(second)
    assert len(room_service.get_room(session, code).used_question_ids) == 6
