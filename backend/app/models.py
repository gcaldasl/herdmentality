"""SQLModel tables backing the game state."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column
from sqlalchemy.types import JSON
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Phases: lobby -> [choosing] -> question -> reveal -> scoring -> ([choosing] | game_over)
# "choosing" only happens in the "players" question mode, where a rotating
# player writes the round's question (or draws one from the deck).
PHASES = ("lobby", "choosing", "question", "reveal", "scoring", "game_over")
QUESTION_MODES = ("deck", "players")
WIN_TARGETS = (5, 8, 12)
TIMER_OPTIONS = (0, 30, 45, 60)  # seconds per answer round; 0 = no timer
COW_ROUND_MODES = ("off", "every4", "random")
CUSTOM_QUESTION_ID = "custom"


class Question(SQLModel, table=True):
    id: str = Field(primary_key=True)
    text: str
    category: str = "general"


class Room(SQLModel, table=True):
    code: str = Field(primary_key=True)
    phase: str = "lobby"
    host_player_id: str | None = None
    current_round_id: int | None = None
    pink_cow_player_id: str | None = None
    used_question_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    question_mode: str = "deck"
    # Whose turn it is to pick the question (players mode); kept after the
    # round starts so the rotation knows who went last.
    chooser_player_id: str | None = None
    # Lobby settings (host). create_room seeds win_target from the env default.
    win_target: int = 8
    timer_seconds: int = 0
    # Deck categories to draw from; None / empty = all of them.
    categories: list[str] | None = Field(default=None, sa_column=Column(JSON))
    # Pink Cow variants (see engine.resolve_round).
    cow_rounds: str = "off"
    sour_milk: bool = False
    created_at: datetime = Field(default_factory=_utcnow)


class Player(SQLModel, table=True):
    id: str = Field(primary_key=True)
    room_code: str = Field(index=True, foreign_key="room.code")
    name: str
    score: int = 0
    connected: bool = True
    is_host: bool = False
    joined_at: datetime = Field(default_factory=_utcnow)


class Round(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    room_code: str = Field(index=True, foreign_key="room.code")
    # A deck Question id, or CUSTOM_QUESTION_ID when a player wrote it.
    question_id: str
    # The question as shown: player-written text, or a snapshot of the deck
    # question taken when the round started (None only on pre-snapshot rounds).
    question_text: str | None = None
    author_id: str | None = None  # the player who wrote or drew it (players mode)
    # When answering closes, stored as UTC: the round timer, or the short
    # "last chance" window once everyone has answered (whichever is sooner).
    deadline: datetime | None = None
    # When the answers were revealed; clients time the staged reveal from it.
    revealed_at: datetime | None = None
    # Cow Round: lone answers score instead of the herd.
    is_cow_round: bool = False
    number: int
    resolved: bool = False
    herd_group_key: str | None = None
    # list[{key, label, player_ids}] - auto-grouped, then editable by the host
    groups: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    # populated once the round is resolved, for the results screen
    result: dict | None = Field(default=None, sa_column=Column(JSON))


class Answer(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    round_id: int = Field(index=True, foreign_key="round.id")
    player_id: str
    text: str
    normalized: str
