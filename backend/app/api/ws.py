"""The gameplay WebSocket: /ws/{code}?player_id=...

Clients send {"type": ..., ...} messages; the server replies to everyone in the
room with a full {"type": "state", "state": {...}} snapshot after every change,
and sends {"type": "error", "message": ...} to the acting client on a rule break.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import Session

from app import db
from app.game import room_service
from app.game.manager import manager

router = APIRouter()

# How long a disconnected player keeps the host role / their question turn
# before it passes to someone else.
HOST_GRACE_SECONDS = 10.0
_background: set[asyncio.Task] = set()


# Round deadlines: room code -> (round id, deadline) whose expiry task is
# scheduled. A new, earlier deadline (the last-chance window cutting a timer
# short) gets its own task; the stale later one finds the round moved on.
_timers: dict[str, tuple[int, datetime]] = {}


def _spawn(coro) -> None:
    task = asyncio.create_task(coro)
    _background.add(task)
    task.add_done_callback(_background.discard)


def _ensure_timer(code: str) -> None:
    """If the room is answering against a clock, make sure exactly one task
    will close the round at its deadline. Idempotent; called after every change
    (and on connect, so timers survive a server restart)."""
    with Session(db.engine) as session:
        pending = room_service.pending_deadline(session, code)
    if pending is None:
        return
    round_id, deadline = pending
    if _timers.get(code) == (round_id, deadline):
        return
    _timers[code] = (round_id, deadline)
    _spawn(_expire_at(code, round_id, deadline))


async def _expire_at(code: str, round_id: int, deadline: datetime) -> None:
    delay = (deadline - datetime.now(timezone.utc)).total_seconds()
    # A little slack so a last-second answer that's already in flight lands first.
    await asyncio.sleep(max(0.0, delay) + 0.5)
    with Session(db.engine) as session:
        expired = room_service.expire_round(session, code, round_id)
    if _timers.get(code) == (round_id, deadline):
        _timers.pop(code, None)
    if expired:
        await manager.broadcast_state(code)


async def _handoff_later(code: str, player_id: str) -> None:
    await asyncio.sleep(HOST_GRACE_SECONDS)
    with Session(db.engine) as session:
        changed = room_service.handoff_if_absent(session, code, player_id)
    if changed:
        await manager.broadcast_state(code)
        _ensure_timer(code)  # a departure may have started the last-chance window


def _with_session(fn, *args) -> None:
    with Session(db.engine) as session:
        fn(session, *args)


@router.websocket("/ws/{code}")
async def game_socket(websocket: WebSocket, code: str, player_id: str = "") -> None:
    code = code.upper()

    with Session(db.engine) as session:
        room = room_service.get_room(session, code)
        player = session.get(room_service.Player, player_id) if player_id else None
        valid = room is not None and player is not None and player.room_code == code

    if not valid:
        await websocket.close(code=4004)
        return

    await manager.connect(code, player_id, websocket)
    _with_session(room_service.set_connected, code, player_id, True)
    await manager.broadcast_state(code)
    _ensure_timer(code)

    handlers = {
        "start_game": lambda s, m: room_service.start_game(s, code, player_id),
        "set_question_mode": lambda s, m: room_service.set_question_mode(
            s, code, player_id, str(m.get("mode", ""))
        ),
        "update_settings": lambda s, m: room_service.update_settings(
            s, code, player_id, dict(m.get("settings") or {})
        ),
        "write_question": lambda s, m: room_service.write_question(
            s, code, player_id, str(m.get("text", ""))
        ),
        "draw_question": lambda s, m: room_service.draw_question(s, code, player_id),
        "submit_answer": lambda s, m: room_service.submit_answer(
            s, code, player_id, str(m.get("text", ""))
        ),
        "regroup": lambda s, m: room_service.regroup(
            s, code, player_id, list(m.get("groups", []))
        ),
        "confirm_groups": lambda s, m: room_service.confirm_groups(s, code, player_id),
        "next_round": lambda s, m: room_service.next_round(s, code, player_id),
        "restart": lambda s, m: room_service.restart(s, code, player_id),
    }

    try:
        while True:
            message = await websocket.receive_json()
            handler = handlers.get(message.get("type"))
            if handler is None:
                await manager.send_personal(
                    websocket, {"type": "error", "message": "Ação desconhecida."}
                )
                continue
            try:
                with Session(db.engine) as session:
                    handler(session, message)
            except room_service.GameError as exc:
                await manager.send_personal(
                    websocket, {"type": "error", "message": str(exc)}
                )
                continue
            await manager.broadcast_state(code)
            _ensure_timer(code)
    except WebSocketDisconnect:
        pass
    finally:
        # Only mark the player offline if this socket was still the live one -
        # a newer tab / reconnect may have already replaced it.
        if await manager.disconnect(code, player_id, websocket):
            _with_session(room_service.set_connected, code, player_id, False, False)
            await manager.broadcast_state(code)
            _spawn(_handoff_later(code, player_id))
