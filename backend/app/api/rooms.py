"""REST endpoints for creating and joining rooms. Gameplay runs over the WebSocket."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db import get_session
from app.game import room_service
from app.schemas import (
    CreateRoomBody,
    CreateRoomResponse,
    JoinRoomBody,
    JoinRoomResponse,
)

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=CreateRoomResponse)
def create_room(body: CreateRoomBody, session: Session = Depends(get_session)):
    code, player_id = room_service.create_room(session, body.host_name)
    return CreateRoomResponse(code=code, player_id=player_id)


@router.post("/{code}/join", response_model=JoinRoomResponse)
def join_room(
    code: str, body: JoinRoomBody, session: Session = Depends(get_session)
):
    try:
        player_id = room_service.join_room(session, code, body.name)
    except room_service.GameError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return JoinRoomResponse(code=code.upper(), player_id=player_id)
