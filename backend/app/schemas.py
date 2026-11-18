"""Request/response bodies for REST and the shapes broadcast over the WebSocket."""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---- REST ----

class CreateRoomBody(BaseModel):
    host_name: str = Field(min_length=1, max_length=24)


class CreateRoomResponse(BaseModel):
    code: str
    player_id: str


class JoinRoomBody(BaseModel):
    name: str = Field(min_length=1, max_length=24)


class JoinRoomResponse(BaseModel):
    code: str
    player_id: str


# ---- WebSocket: client -> server ----
# Messages are {"type": ..., ...payload}. Parsed loosely in api/ws.py; these
# classes document the contract.

class SubmitAnswerMsg(BaseModel):
    text: str = Field(min_length=1, max_length=80)


class UpdateSettingsMsg(BaseModel):
    # host, lobby only; any subset of these keys
    settings: dict  # {question_mode, win_target: 5|8|12, timer_seconds: 0|30|45|60, categories: [..]}


class SetQuestionModeMsg(BaseModel):
    mode: str  # "deck" | "players" (host, lobby only)


class WriteQuestionMsg(BaseModel):
    # players mode, "choosing" phase, current chooser only
    text: str = Field(min_length=5, max_length=140)


# {"type": "draw_question"} - chooser (or host) draws from the deck instead.


class RegroupMsg(BaseModel):
    # Full replacement of the round's groups, as edited by the host.
    groups: list[dict]


# ---- WebSocket: server -> client ----

class PlayerView(BaseModel):
    id: str
    name: str
    score: int
    connected: bool
    is_host: bool
    has_answered: bool = False


class GroupView(BaseModel):
    key: str
    label: str
    player_ids: list[str]
    answers: list[dict]  # [{player_id, name, text}]


class RoundResultView(BaseModel):
    herd_group_key: str | None
    point_deltas: dict[str, int]
    previous_cow_holder: str | None
    new_cow_holder: str | None
    cow_moved: bool


class GameStateView(BaseModel):
    code: str
    phase: str
    players: list[PlayerView]
    host_player_id: str | None
    pink_cow_player_id: str | None
    win_target: int
    timer_seconds: int  # 0 = no timer
    deadline: str | None  # ISO UTC; set while answering in a timed room
    server_now: str  # ISO UTC; lets clients correct for clock skew
    closing: bool  # everyone answered; still editable until `deadline`
    revealed_at: str | None  # ISO UTC; staged-reveal timeline starts here
    categories: list[str]  # selected deck categories; empty = all
    categories_available: list[dict]  # [{id, count}]
    tied_player_ids: list[str]  # sudden-death tie at/above the target
    cow_rounds: str  # "off" | "every4" | "random"
    sour_milk: bool
    cow_round: bool  # this round is a Cow Round (lone answers score)
    # game_over only: {rounds: [{number, question, herd_label, herd_player_ids,
    # tied_labels, cow_holder_after}], awards: [{id, player_ids, value}]}
    recap: dict | None
    round_number: int
    question: str | None
    question_mode: str  # "deck" | "players"
    chooser_player_id: str | None  # whose turn it is / was to pick (players mode)
    question_author_id: str | None  # who wrote or drew this round's question
    question_is_custom: bool  # written by a player rather than drawn from the deck
    answered_player_ids: list[str]
    groups: list[GroupView]
    result: RoundResultView | None
    winner_player_id: str | None
