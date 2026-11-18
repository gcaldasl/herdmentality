"""Drive multiple rounds through room_service to exercise the Pink Cow win gate."""

from sqlmodel import select

from app.game import room_service
from app.models import Answer, Player, Round


def _answer_all(session, code, mapping):
    """mapping: {player_id: text}. Submits for every player, triggering reveal."""
    for player_id, text in mapping.items():
        room_service.submit_answer(session, code, player_id, text)


def _current_round(session, code) -> Round:
    room = room_service.get_room(session, code)
    return session.get(Round, room.current_round_id)


def _set_score(session, player_id, score):
    p = session.get(room_service.Player, player_id)
    p.score = score
    session.add(p)
    session.commit()


def test_cow_holder_at_target_does_not_win_until_cow_passed(session):
    code, host = room_service.create_room(session, "Ann")
    bob = room_service.join_room(session, code, "Bob")
    cara = room_service.join_room(session, code, "Cara")
    for pid in (host, bob, cara):
        room_service.set_connected(session, code, pid, True)

    room_service.start_game(session, code, host)

    # Round where Ann is the lone answer -> Ann takes the cow.
    _answer_all(session, code, {host: "zebra", bob: "cachorro", cara: "cachorro"})
    room_service.confirm_groups(session, code, host)
    assert room_service.get_room(session, code).pink_cow_player_id == host

    # Park Ann on the win target while she still holds the cow.
    _set_score(session, host, 8)

    # Next round: Ann matches the herd (would be +1 and a win, but she has the cow).
    room_service.next_round(session, code, host)
    _answer_all(session, code, {host: "gato", bob: "gato", cara: "gato"})
    room_service.confirm_groups(session, code, host)

    room = room_service.get_room(session, code)
    assert room.phase == "scoring"  # no winner yet
    assert room.pink_cow_player_id == host  # nobody was alone, cow stays

    # Next round: Bob is the lone voice -> cow moves to Bob, Ann can now win.
    room_service.next_round(session, code, host)
    _answer_all(session, code, {host: "sol", bob: "lua", cara: "sol"})
    room_service.confirm_groups(session, code, host)

    room = room_service.get_room(session, code)
    assert room.pink_cow_player_id == bob
    assert room.phase == "game_over"

    state = room_service.build_state(session, code)
    assert state["winner_player_id"] == host


def test_restart_resets_scores_and_cow(session):
    code, host = room_service.create_room(session, "Ann")
    bob = room_service.join_room(session, code, "Bob")
    for pid in (host, bob):
        room_service.set_connected(session, code, pid, True)

    room_service.start_game(session, code, host)
    _answer_all(session, code, {host: "x", bob: "y"})
    room_service.confirm_groups(session, code, host)
    room_service.restart(session, code, host)

    room = room_service.get_room(session, code)
    assert room.phase == "lobby"
    assert room.pink_cow_player_id is None
    players = session.exec(select(Player).where(Player.room_code == code)).all()
    assert all(p.score == 0 for p in players)
    assert session.exec(select(Answer)).all() == []
