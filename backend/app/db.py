"""Database engine and session helpers."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

_connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)
engine = create_engine(settings.database_url, echo=False, connect_args=_connect_args)


def init_db() -> None:
    # Import models so they are registered on SQLModel.metadata before create_all.
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    add_missing_columns(engine)


def add_missing_columns(target_engine) -> None:
    """Tiny forward-only migration: `create_all` never alters existing tables, so
    columns added to a model after a database was created are ADDed here.
    Only handles nullable columns or ones with a scalar Python default."""
    inspector = inspect(target_engine)
    with target_engine.begin() as conn:
        for table in SQLModel.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" '
                ddl += column.type.compile(dialect=target_engine.dialect)
                default = column.default.arg if column.default is not None else None
                if default is not None and not callable(default):
                    if isinstance(default, bool):
                        literal = "1" if default else "0"
                    elif isinstance(default, str):
                        literal = f"'{default}'"
                    else:
                        literal = repr(default)
                    ddl += f" NOT NULL DEFAULT {literal}"
                conn.execute(text(ddl))


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
