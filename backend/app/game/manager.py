"""In-memory registry of live WebSocket connections per room.

Game state lives in the database; only the sockets themselves are held here.
"""

from __future__ import annotations

import asyncio

from fastapi import WebSocket
from sqlmodel import Session

from app import db
from app.game import room_service


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[str, dict[str, WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, code: str, player_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            room = self._rooms.setdefault(code, {})
            stale = room.get(player_id)
            room[player_id] = websocket
        # A second tab / a reconnect for the same player supersedes the old
        # socket. Close it so its handler unwinds without unregistering us.
        if stale is not None and stale is not websocket:
            try:
                await stale.close()
            except Exception:
                pass

    async def disconnect(
        self, code: str, player_id: str, websocket: WebSocket | None = None
    ) -> bool:
        """Remove a socket. Returns True only if it was still the active one.

        Passing ``websocket`` guards against a newer connection for the same
        player being torn down when an older one closes.
        """
        async with self._lock:
            room = self._rooms.get(code)
            if room is None:
                return False
            current = room.get(player_id)
            if current is None or (websocket is not None and current is not websocket):
                return False
            room.pop(player_id, None)
            if not room:
                self._rooms.pop(code, None)
            return True

    async def send_personal(self, websocket: WebSocket, message: dict) -> None:
        await websocket.send_json(message)

    async def broadcast_state(self, code: str) -> None:
        with Session(db.engine) as session:
            state = room_service.build_state(session, code)
        if state is None:
            return
        await self._broadcast(code, {"type": "state", "state": state})

    async def _broadcast(self, code: str, message: dict) -> None:
        async with self._lock:
            targets = list(self._rooms.get(code, {}).items())
        for player_id, websocket in targets:
            try:
                await websocket.send_json(message)
            except Exception:
                await self.disconnect(code, player_id, websocket)


manager = ConnectionManager()
