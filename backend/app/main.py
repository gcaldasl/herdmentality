"""Herd Mentality API: REST for lobby management, WebSocket for gameplay."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app import db
from app.api import rooms, ws
from app.config import settings
from app.game.questions import seed_questions


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    with Session(db.engine) as session:
        seed_questions(session)
    yield


app = FastAPI(title="Efeito Manada", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router)
app.include_router(ws.router)


@app.get("/health")
def health():
    return {"status": "ok"}
