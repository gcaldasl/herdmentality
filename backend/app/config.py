"""Application settings, read from the environment with sensible local defaults."""

from __future__ import annotations

import os
from functools import lru_cache

try:
    from dotenv import load_dotenv

    load_dotenv()
except ModuleNotFoundError:  # pragma: no cover
    pass


class Settings:
    def __init__(self) -> None:
        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./herd.db")
        self.cors_origins: list[str] = [
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
            if origin.strip()
        ]
        self.win_target: int = int(os.getenv("WIN_TARGET", "8"))
        self.min_players: int = int(os.getenv("MIN_PLAYERS", "2"))
        self.max_players: int = int(os.getenv("MAX_PLAYERS", "6"))
        # Once everyone has answered, answers stay editable this long before
        # the reveal ("última chance"). 0 reveals immediately.
        self.last_chance_seconds: float = float(os.getenv("LAST_CHANCE_SECONDS", "3"))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
