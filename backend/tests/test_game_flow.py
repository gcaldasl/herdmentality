"""End-to-end flow over REST + WebSocket against an in-memory SQLite database."""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

import app.db as db_module
from app.db import get_session
from app.main import app


@pytest.fixture
def client(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    monkeypatch.setattr(db_module, "engine", engine)

    def get_session_override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_session_override
    with TestClient(app) as c:  # lifespan creates tables + seeds questions
        yield c
    app.dependency_overrides.clear()


def _latest_state(ws):
    state = None
    while True:
        try:
            msg = ws.receive_json()
        except Exception:
            break
        if msg["type"] == "state":
            state = msg["state"]
        if state is not None:
            return state


def test_full_round_scores_herd_and_assigns_pink_cow(client):
    created = client.post("/rooms", json={"host_name": "Ann"}).json()
    code, ann = created["code"], created["player_id"]
    bob = client.post(f"/rooms/{code}/join", json={"name": "Bob"}).json()["player_id"]
    cara = client.post(f"/rooms/{code}/join", json={"name": "Cara"}).json()["player_id"]

    with client.websocket_connect(f"/ws/{code}?player_id={ann}") as wa, \
         client.websocket_connect(f"/ws/{code}?player_id={bob}") as wb, \
         client.websocket_connect(f"/ws/{code}?player_id={cara}") as wc:
        for ws in (wa, wb, wc):
            ws.receive_json()  # drain initial state(s)

        wa.send_json({"type": "start_game"})
        for ws in (wa, wb, wc):
            _latest_state(ws)

        wa.send_json({"type": "submit_answer", "text": "Cachorro"})
        wb.send_json({"type": "submit_answer", "text": "um cachorro"})
        wc.send_json({"type": "submit_answer", "text": "Cavalo"})

        state = None
        for _ in range(12):
            msg = wc.receive_json()
            if msg["type"] == "state" and msg["state"]["phase"] == "reveal":
                state = msg["state"]
                break
        assert state is not None
        assert len(state["groups"]) == 2

        wa.send_json({"type": "confirm_groups"})
        final = None
        for _ in range(12):
            msg = wa.receive_json()
            if msg["type"] == "state" and msg["state"]["phase"] == "scoring":
                final = msg["state"]
                break
        assert final is not None
        scores = {p["name"]: p["score"] for p in final["players"]}
        assert scores == {"Ann": 1, "Bob": 1, "Cara": 0}
        assert final["pink_cow_player_id"] == cara


