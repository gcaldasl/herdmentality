import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.config import settings
from app.game.questions import seed_questions


@pytest.fixture(autouse=True)
def instant_reveal(monkeypatch):
    """Most tests want the reveal the moment everyone has answered; the
    last-chance window has its own tests (test_last_chance.py)."""
    monkeypatch.setattr(settings, "last_chance_seconds", 0)


@pytest.fixture
def session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        seed_questions(s)
        yield s
