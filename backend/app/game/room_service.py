"""All database-backed room operations and state-view building.

Every mutating function commits and returns; the caller (the WebSocket layer)
is responsible for broadcasting the fresh state afterwards.
"""

from __future__ import annotations

import random
import string
import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.config import settings
from app.game import engine
from app.game.normalize import auto_group, normalize_answer
from app.game.questions import category_counts, pick_question
from app.game.recap import RecapRound, build_recap
from app.models import (
    COW_ROUND_MODES,
    CUSTOM_QUESTION_ID,
    QUESTION_MODES,
    TIMER_OPTIONS,
    WIN_TARGETS,
    Answer,
    Player,
    Question,
    Round,
    Room,
)


class GameError(Exception):
    """A rule violation that should be reported back to the acting client."""


# ---------- lookups ----------

def get_room(session: Session, code: str) -> Room | None:
    return session.get(Room, code.upper())


def _players(session: Session, code: str) -> list[Player]:
    rows = session.exec(select(Player).where(Player.room_code == code)).all()
    return sorted(rows, key=lambda p: p.joined_at)


def _current_round(session: Session, room: Room) -> Round | None:
    if room.current_round_id is None:
        return None
    return session.get(Round, room.current_round_id)


def _round_answers(session: Session, round_id: int) -> list[Answer]:
    return session.exec(select(Answer).where(Answer.round_id == round_id)).all()


# ---------- creation / joining ----------

def _generate_code(session: Session) -> str:
    for _ in range(50):
        code = "".join(random.choices(string.ascii_uppercase, k=4))
        if session.get(Room, code) is None:
            return code
    raise GameError("Não foi possível gerar um código de sala, tente de novo.")


def create_room(session: Session, host_name: str) -> tuple[str, str]:
    code = _generate_code(session)
    player_id = uuid.uuid4().hex
    room = Room(code=code, host_player_id=player_id, win_target=settings.win_target)
    host = Player(id=player_id, room_code=code, name=host_name.strip(), is_host=True)
    session.add(room)
    session.add(host)
    session.commit()
    return code, player_id


def join_room(session: Session, code: str, name: str) -> str:
    room = get_room(session, code)
    if room is None:
        raise GameError("Nenhum jogo encontrado com esse código.")
    if room.phase != "lobby":
        raise GameError("Esse jogo já começou.")
    players = _players(session, room.code)
    if len(players) >= settings.max_players:
        raise GameError("Esse jogo está cheio.")
    if any(p.name.lower() == name.strip().lower() for p in players):
        raise GameError("Alguém no jogo já tem esse nome.")

    player_id = uuid.uuid4().hex
    session.add(Player(id=player_id, room_code=room.code, name=name.strip()))
    session.commit()
    return player_id


# ---------- connection tracking ----------

def set_connected(
    session: Session,
    code: str,
    player_id: str,
    connected: bool,
    handoff: bool = True,
) -> None:
    """Mark a player online/offline. With `handoff=False` a departing host keeps
    the crown and a departing chooser keeps their turn for now (see
    `handoff_if_absent`), so a page refresh or a flaky phone connection doesn't
    hand their role to someone else."""
    player = session.get(Player, player_id)
    if player is None or player.room_code != code.upper():
        return
    player.connected = connected
    session.add(player)
    session.commit()

    if not connected and handoff:
        handoff_if_absent(session, code, player_id)


def handoff_if_absent(session: Session, code: str, player_id: str) -> bool:
    """If `player_id` is still offline, pass on their question turn and the host
    role. Returns True if anything changed."""
    passed = _pass_turn_if_absent(session, code, player_id)
    migrated = migrate_host_if_absent(session, code, player_id)
    revealed = False
    room = get_room(session, code)
    if room is not None and room.phase == "question":
        current = _current_round(session, room)
        if current is not None:
            revealed = _maybe_reveal(session, room, current)
    return passed or migrated or revealed


def _pass_turn_if_absent(session: Session, code: str, player_id: str) -> bool:
    room = get_room(session, code)
    player = session.get(Player, player_id)
    if room is None or player is None or player.connected:
        return False
    if room.phase != "choosing" or room.chooser_player_id != player_id:
        return False
    successor = _next_chooser(session, room)
    if successor is None or successor == player_id:
        return False
    room.chooser_player_id = successor
    session.add(room)
    session.commit()
    return True


def migrate_host_if_absent(session: Session, code: str, player_id: str) -> bool:
    """Pass the host role on if `player_id` is the host and is still offline.
    Returns True if the host changed."""
    player = session.get(Player, player_id)
    room = get_room(session, code)
    if player is None or room is None or player.connected:
        return False
    if room.host_player_id != player_id:
        return False
    heir = next(
        (p for p in _players(session, room.code) if p.connected and p.id != player_id),
        None,
    )
    if heir is None:
        return False
    player.is_host = False
    heir.is_host = True
    room.host_player_id = heir.id
    session.add_all([player, heir, room])
    session.commit()
    return True


# ---------- round lifecycle ----------

def _require_host(room: Room, player_id: str) -> None:
    if room.host_player_id != player_id:
        raise GameError("Só o anfitrião pode fazer isso.")


MIN_QUESTION_LEN = 5
MAX_QUESTION_LEN = 140


def _next_chooser(session: Session, room: Room) -> str | None:
    players = _players(session, room.code)
    return engine.next_chooser(
        [p.id for p in players],
        {p.id for p in players if p.connected},
        room.chooser_player_id,
    )


def _advance(session: Session, room: Room, first: bool = False) -> None:
    """Move on to the next round: straight to a deck question, or - in players
    mode - to the "choosing" phase for the next player in the rotation."""
    if room.question_mode != "players":
        _begin_round(session, room)
        return
    if first:
        # The host opens the game; otherwise the rotation starts from the top.
        host = session.get(Player, room.host_player_id) if room.host_player_id else None
        room.chooser_player_id = None
        room.chooser_player_id = host.id if host and host.connected else _next_chooser(session, room)
    else:
        room.chooser_player_id = _next_chooser(session, room)
    room.phase = "choosing"
    session.add(room)
    session.commit()


def _begin_round(
    session: Session,
    room: Room,
    custom_text: str | None = None,
    author_id: str | None = None,
) -> None:
    if custom_text is None:
        picked = pick_question(session, room.used_question_ids, room.categories)
        if picked is None:
            raise GameError("Não há perguntas disponíveis.")
        question, used_ids = picked
        question_id = question.id
        text = question.text  # snapshot: the deck may change under a live round
    else:
        question_id = CUSTOM_QUESTION_ID
        text = custom_text
    prev = _current_round(session, room)
    number = (prev.number + 1) if prev else 1
    cow_round = engine.is_cow_round(
        room.cow_rounds, number, bool(prev and prev.is_cow_round), random.random()
    )
    new_round = Round(
        room_code=room.code,
        question_id=question_id,
        question_text=text,
        author_id=author_id,
        number=number,
        is_cow_round=cow_round,
        deadline=_utcnow() + timedelta(seconds=room.timer_seconds)
        if room.timer_seconds
        else None,
    )
    session.add(new_round)
    session.commit()
    session.refresh(new_round)

    room.current_round_id = new_round.id
    if custom_text is None:
        room.used_question_ids = used_ids
    room.phase = "question"
    session.add(room)
    session.commit()


def set_question_mode(session: Session, code: str, player_id: str, mode: str) -> None:
    update_settings(session, code, player_id, {"question_mode": mode})


def update_settings(session: Session, code: str, player_id: str, changes: dict) -> None:
    """Host-only lobby settings. Only the keys present in `changes` are touched."""
    room = get_room(session, code)
    if room is None:
        raise GameError("Jogo não encontrado.")
    _require_host(room, player_id)
    if room.phase != "lobby":
        raise GameError("Só dá para mudar isso antes do jogo começar.")

    if "question_mode" in changes:
        if changes["question_mode"] not in QUESTION_MODES:
            raise GameError("Modo de perguntas inválido.")
        room.question_mode = changes["question_mode"]
    if "win_target" in changes:
        if changes["win_target"] not in WIN_TARGETS:
            raise GameError("Pontuação para vencer inválida.")
        room.win_target = changes["win_target"]
    if "timer_seconds" in changes:
        if changes["timer_seconds"] not in TIMER_OPTIONS:
            raise GameError("Tempo por rodada inválido.")
        room.timer_seconds = changes["timer_seconds"]
    if "cow_rounds" in changes:
        if changes["cow_rounds"] not in COW_ROUND_MODES:
            raise GameError("Opção de Rodada da Vaca inválida.")
        room.cow_rounds = changes["cow_rounds"]
    if "sour_milk" in changes:
        if not isinstance(changes["sour_milk"], bool):
            raise GameError("Opção de Leite azedo inválida.")
        room.sour_milk = changes["sour_milk"]
    if "categories" in changes:
        wanted = changes["categories"]
        known = set(category_counts(session))
        if not isinstance(wanted, list) or not set(wanted) <= known:
            raise GameError("Categoria inválida.")
        if not wanted:
            raise GameError("Escolha pelo menos uma categoria.")
        # Stored empty when everything is selected: "all", even if the deck grows.
        room.categories = [] if set(wanted) == known else sorted(set(wanted))

    session.add(room)
    session.commit()


def _require_choosing(session: Session, code: str) -> Room:
    room = get_room(session, code)
    if room is None:
        raise GameError("Jogo não encontrado.")
    if room.phase != "choosing":
        raise GameError("Não é hora de escolher a pergunta.")
    return room


def write_question(session: Session, code: str, player_id: str, text: str) -> None:
    room = _require_choosing(session, code)
    if room.chooser_player_id != player_id:
        raise GameError("Não é a sua vez de escrever a pergunta.")
    clean = " ".join(text.split())
    if len(clean) < MIN_QUESTION_LEN:
        raise GameError("A pergunta está curta demais.")
    if len(clean) > MAX_QUESTION_LEN:
        raise GameError(f"A pergunta pode ter no máximo {MAX_QUESTION_LEN} caracteres.")
    _begin_round(session, room, custom_text=clean, author_id=player_id)


def draw_question(session: Session, code: str, player_id: str) -> None:
    """The chooser draws from the deck instead of writing. The host may do it on
    their behalf, so an AFK chooser can't stall the game."""
    room = _require_choosing(session, code)
    if player_id not in (room.chooser_player_id, room.host_player_id):
        raise GameError("Não é a sua vez de escolher a pergunta.")
    _begin_round(session, room, author_id=room.chooser_player_id)


def start_game(session: Session, code: str, player_id: str) -> None:
    room = get_room(session, code)
    if room is None:
        raise GameError("Jogo não encontrado.")
    _require_host(room, player_id)
    if room.phase != "lobby":
        raise GameError("O jogo já está em andamento.")
    if len(_players(session, room.code)) < settings.min_players:
        raise GameError(
            f"Precisa de pelo menos {settings.min_players} jogadores para começar."
        )
    _advance(session, room, first=True)


def submit_answer(session: Session, code: str, player_id: str, text: str) -> None:
    room = get_room(session, code)
    if room is None:
        raise GameError("Jogo não encontrado.")
    if room.phase != "question":
        raise GameError("Não é hora de responder agora.")
    current = _current_round(session, room)
    if current is None:
        raise GameError("Nenhuma rodada ativa.")

    clean = text.strip()
    if not clean:
        raise GameError("A resposta não pode ficar vazia.")

    existing = session.exec(
        select(Answer).where(
            Answer.round_id == current.id, Answer.player_id == player_id
        )
    ).first()
    if existing is not None:
        existing.text = clean
        existing.normalized = normalize_answer(clean)
        session.add(existing)
    else:
        session.add(
            Answer(
                round_id=current.id,
                player_id=player_id,
                text=clean,
                normalized=normalize_answer(clean),
            )
        )
    session.commit()

    _maybe_reveal(session, room, current)


def _everyone_answered(session: Session, room: Room, current: Round) -> bool:
    connected_ids = {p.id for p in _players(session, room.code) if p.connected}
    answered_ids = {a.player_id for a in _round_answers(session, current.id)}
    return bool(connected_ids) and connected_ids.issubset(answered_ids)


def _maybe_reveal(session: Session, room: Room, current: Round) -> bool:
    """Once everyone has answered, start the "last chance" window (answers stay
    editable; the WS layer reveals when it ends) - or reveal right away when the
    window is 0. Returns True if anything changed."""
    if not _everyone_answered(session, room, current):
        return False
    grace = settings.last_chance_seconds
    if grace <= 0:
        _reveal(session, room, current)
        return True
    closes = _utcnow() + timedelta(seconds=grace)
    deadline = _as_utc(current.deadline)
    if deadline is not None and deadline <= closes:
        return False  # already closing at least that soon
    current.deadline = closes
    session.add(current)
    session.commit()
    return True


def _reveal(session: Session, room: Room, current: Round) -> None:
    answers = _round_answers(session, current.id)
    current.groups = auto_group([{"player_id": a.player_id, "text": a.text} for a in answers])
    current.revealed_at = _utcnow()
    room.phase = "reveal"
    session.add_all([current, room])
    session.commit()


def expire_round(session: Session, code: str, round_id: int) -> bool:
    """The round's deadline passed (timer or last-chance window): reveal with
    whoever answered. Players who didn't answer are simply left out (no points,
    can't take the cow). Returns True if it revealed; False if the round
    already moved on."""
    room = get_room(session, code)
    if room is None or room.phase != "question" or room.current_round_id != round_id:
        return False
    current = _current_round(session, room)
    if current is None:
        return False
    _reveal(session, room, current)
    return True


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    # SQLite hands datetimes back naive; they were stored as UTC.
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def pending_deadline(session: Session, code: str) -> tuple[int, datetime] | None:
    """(round id, deadline) if the room is answering against a clock."""
    room = get_room(session, code)
    if room is None or room.phase != "question":
        return None
    current = _current_round(session, room)
    if current is None or current.deadline is None:
        return None
    return current.id, _as_utc(current.deadline)


def regroup(session: Session, code: str, player_id: str, groups: list[dict]) -> None:
    room = get_room(session, code)
    if room is None:
        raise GameError("Jogo não encontrado.")
    _require_host(room, player_id)
    if room.phase != "reveal":
        raise GameError("As respostas só podem ser reagrupadas na tela de revelação.")
    current = _current_round(session, room)
    if current is None:
        raise GameError("Nenhuma rodada ativa.")

    valid_ids = {a.player_id for a in _round_answers(session, current.id)}
    cleaned: list[dict] = []
    seen: set[str] = set()
    for index, group in enumerate(groups):
        member_ids = [
            pid for pid in group.get("player_ids", []) if pid in valid_ids and pid not in seen
        ]
        seen.update(member_ids)
        if not member_ids:
            continue
        cleaned.append(
            {
                "key": group.get("key") or f"g{index}",
                "label": (group.get("label") or "").strip() or "(sem nome)",
                "player_ids": member_ids,
            }
        )
    # Anyone the host dropped stays in a singleton bucket of their own.
    for pid in valid_ids - seen:
        answer = next(a for a in _round_answers(session, current.id) if a.player_id == pid)
        cleaned.append({"key": f"solo-{pid[:6]}", "label": answer.text, "player_ids": [pid]})

    current.groups = cleaned
    session.add(current)
    session.commit()


def confirm_groups(session: Session, code: str, player_id: str) -> None:
    room = get_room(session, code)
    if room is None:
        raise GameError("Jogo não encontrado.")
    _require_host(room, player_id)
    if room.phase != "reveal":
        raise GameError("Nada para confirmar agora.")
    current = _current_round(session, room)
    if current is None:
        raise GameError("Nenhuma rodada ativa.")

    result = engine.resolve_round(
        current.groups,
        room.pink_cow_player_id,
        cow_round=current.is_cow_round,
        sour_milk=room.sour_milk,
    )

    players = _players(session, room.code)
    for player in players:
        delta = result.point_deltas.get(player.id, 0)
        if delta:
            player.score += delta
            session.add(player)

    # Sour milk never takes a score below zero; record what was actually lost.
    sour_lost = 0
    if result.sour_milk_player_id is not None:
        holder = next((p for p in players if p.id == result.sour_milk_player_id), None)
        if holder is not None and holder.score > 0:
            holder.score -= 1
            sour_lost = 1
            session.add(holder)

    room.pink_cow_player_id = result.new_cow_holder
    current.resolved = True
    current.herd_group_key = result.herd_group_key
    current.result = {
        "herd_group_key": result.herd_group_key,
        "point_deltas": result.point_deltas,
        "previous_cow_holder": result.previous_cow_holder,
        "new_cow_holder": result.new_cow_holder,
        "cow_moved": result.cow_moved,
        "cow_round": result.cow_round,
        "sour_milk_player_id": result.sour_milk_player_id,
        "sour_milk_lost": sour_lost,
    }
    session.add_all([room, current])
    session.commit()

    scores = {p.id: p.score for p in players}
    winner = engine.check_winner(scores, room.pink_cow_player_id, room.win_target)
    room.phase = "game_over" if winner else "scoring"
    session.add(room)
    session.commit()


def next_round(session: Session, code: str, player_id: str) -> None:
    room = get_room(session, code)
    if room is None:
        raise GameError("Jogo não encontrado.")
    _require_host(room, player_id)
    if room.phase != "scoring":
        raise GameError("Termine de pontuar a rodada atual primeiro.")
    _advance(session, room)


def restart(session: Session, code: str, player_id: str) -> None:
    room = get_room(session, code)
    if room is None:
        raise GameError("Jogo não encontrado.")
    _require_host(room, player_id)

    round_ids = [
        r.id for r in session.exec(select(Round).where(Round.room_code == room.code)).all()
    ]
    for answer in session.exec(
        select(Answer).where(Answer.round_id.in_(round_ids))  # type: ignore[union-attr]
    ).all():
        session.delete(answer)
    for r in session.exec(select(Round).where(Round.room_code == room.code)).all():
        session.delete(r)
    for player in _players(session, room.code):
        player.score = 0
        session.add(player)

    room.phase = "lobby"
    room.current_round_id = None
    room.pink_cow_player_id = None
    room.chooser_player_id = None
    # used_question_ids is kept on purpose: a rematch in the same room shouldn't
    # replay questions from earlier games until the whole deck has been seen.
    session.add(room)
    session.commit()


# ---------- state view ----------

def _game_recap(session: Session, room: Room, players: list[Player]) -> dict:
    """Recap of the finished game. Rounds are wiped on restart, so every round
    in the room belongs to this game."""
    rounds = session.exec(
        select(Round).where(Round.room_code == room.code, Round.resolved == True)  # noqa: E712
    ).all()
    recap_rounds = []
    for r in sorted(rounds, key=lambda r: r.number):
        text = r.question_text
        if text is None:
            q = session.get(Question, r.question_id)
            text = q.text if q else "?"
        recap_rounds.append(
            RecapRound(
                number=r.number,
                question=text,
                groups=r.groups,
                herd_group_key=r.herd_group_key,
                cow_holder_after=(r.result or {}).get("new_cow_holder"),
                cow_round=r.is_cow_round,
            )
        )
    return build_recap(recap_rounds, [p.id for p in players])


def build_state(session: Session, code: str) -> dict | None:
    room = get_room(session, code)
    if room is None:
        return None

    players = _players(session, room.code)
    current = _current_round(session, room)

    answers = _round_answers(session, current.id) if current else []
    answers_by_player = {a.player_id: a for a in answers}
    answered_ids = list(answers_by_player.keys())
    name_by_id = {p.id: p.name for p in players}

    question_text: str | None = None
    if current is not None and room.phase not in ("lobby", "choosing"):
        if current.question_text is not None:
            question_text = current.question_text
        else:
            q = session.get(Question, current.question_id)
            question_text = q.text if q else None

    groups_view: list[dict] = []
    show_groups = room.phase in ("reveal", "scoring", "game_over") and current is not None
    if show_groups:
        for group in current.groups:
            groups_view.append(
                {
                    "key": group["key"],
                    "label": group["label"],
                    "player_ids": group["player_ids"],
                    "answers": [
                        {
                            "player_id": pid,
                            "name": name_by_id.get(pid, "?"),
                            "text": answers_by_player[pid].text
                            if pid in answers_by_player
                            else "",
                        }
                        for pid in group["player_ids"]
                    ],
                }
            )

    result_view = None
    winner_id = None
    if current is not None and current.result and room.phase in ("scoring", "game_over"):
        result_view = current.result
        if room.phase == "game_over":
            scores = {p.id: p.score for p in players}
            winner_id = engine.check_winner(
                scores, room.pink_cow_player_id, room.win_target
            )

    return {
        "code": room.code,
        "phase": room.phase,
        "players": [
            {
                "id": p.id,
                "name": p.name,
                "score": p.score,
                "connected": p.connected,
                "is_host": p.is_host,
                "has_answered": p.id in answered_ids,
            }
            for p in players
        ],
        "host_player_id": room.host_player_id,
        "pink_cow_player_id": room.pink_cow_player_id,
        "win_target": room.win_target,
        "timer_seconds": room.timer_seconds,
        "cow_rounds": room.cow_rounds,
        "sour_milk": room.sour_milk,
        "cow_round": bool(current and current.is_cow_round)
        and room.phase in ("question", "reveal", "scoring", "game_over"),
        "deadline": _as_utc(current.deadline).isoformat()
        if current is not None and current.deadline is not None and room.phase == "question"
        else None,
        "server_now": _utcnow().isoformat(),
        # Everyone answered; answers stay editable until `deadline`.
        "closing": room.phase == "question"
        and current is not None
        and current.deadline is not None
        and _everyone_answered(session, room, current),
        "revealed_at": _as_utc(current.revealed_at).isoformat()
        if current is not None and current.revealed_at is not None and room.phase == "reveal"
        else None,
        "categories": room.categories or [],
        "categories_available": [
            {"id": cid, "count": count} for cid, count in sorted(category_counts(session).items())
        ],
        "tied_player_ids": engine.tied_leaders(
            {p.id: p.score for p in players}, room.pink_cow_player_id, room.win_target
        )
        if room.phase in ("scoring", "choosing", "question", "reveal")
        else [],
        "round_number": current.number if current else 0,
        "question": question_text,
        "question_mode": room.question_mode,
        "chooser_player_id": room.chooser_player_id if room.question_mode == "players" else None,
        "question_author_id": current.author_id
        if current is not None and room.phase not in ("lobby", "choosing")
        else None,
        "question_is_custom": current is not None and current.question_id == CUSTOM_QUESTION_ID,
        "answered_player_ids": answered_ids,
        "groups": groups_view,
        "result": result_view,
        "winner_player_id": winner_id,
        "recap": _game_recap(session, room, players) if room.phase == "game_over" else None,
    }
