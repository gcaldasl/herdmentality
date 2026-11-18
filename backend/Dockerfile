# FastAPI + uvicorn, single worker (the ConnectionManager keeps live sockets in memory).
FROM python:3.14-slim AS base

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Dependency layer - cached until the lockfile changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY app ./app

# SQLite lives on a mounted volume so games survive a restart.
ENV DATABASE_URL="sqlite:////data/herd.db"
RUN mkdir -p /data

# /app/.venv/bin is on PATH, so this is the project's uvicorn.
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
