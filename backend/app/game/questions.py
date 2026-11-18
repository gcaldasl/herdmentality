"""Question bank: seeding from JSON and picking one the room hasn't used."""

from __future__ import annotations

import json
import random
from pathlib import Path

from sqlmodel import Session, select

from app.models import Question

_DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "questions.json"


def load_seed_questions() -> list[dict]:
    return json.loads(_DATA_FILE.read_text(encoding="utf-8"))


def seed_questions(session: Session) -> None:
    """Make the question table mirror questions.json: add new ids, update changed
    text/category, and delete questions that are no longer in the file.

    Ids are compared as strings: the column is text, so a JSON `1` and a stored
    "1" are the same question. Live rounds keep a copy of their question text
    (`Round.question_text`), so deleting or editing one mid-game is safe."""
    existing = {q.id: q for q in session.exec(select(Question)).all()}
    seen: set[str] = set()
    for item in load_seed_questions():
        qid = str(item["id"])
        if qid in seen:
            raise ValueError(f"questions.json: duplicate id {qid!r}")
        seen.add(qid)
        category = item.get("category", "general")
        current = existing.get(qid)
        if current is None:
            session.add(Question(id=qid, text=item["text"], category=category))
        elif current.text != item["text"] or current.category != category:
            current.text = item["text"]
            current.category = category
            session.add(current)
    for qid, stale in existing.items():
        if qid not in seen:
            session.delete(stale)
    session.commit()


def category_counts(session: Session) -> dict[str, int]:
    counts: dict[str, int] = {}
    for q in session.exec(select(Question)).all():
        counts[q.category] = counts.get(q.category, 0) + 1
    return counts


def pick_question(
    session: Session, used_ids: list[str], categories: list[str] | None = None
) -> tuple[Question, list[str]] | None:
    """A random question this room hasn't seen, plus the room's updated used list.

    Only draws from `categories` (all when empty). Once every question in that
    pool has been used, a new cycle starts for the pool, avoiding the question
    that was just played so it can't repeat back to back.
    """
    all_questions = session.exec(select(Question)).all()
    if not all_questions:
        return None
    wanted = set(categories or [])
    pool = [q for q in all_questions if q.category in wanted] if wanted else []
    pool = pool or all_questions

    used = set(used_ids)
    unused = [q for q in pool if q.id not in used]
    if unused:
        question = random.choice(unused)
        return question, [*used_ids, question.id]

    last = used_ids[-1] if used_ids else None
    candidates = [q for q in pool if q.id != last] or pool
    question = random.choice(candidates)
    pool_ids = {q.id for q in pool}
    return question, [*(i for i in used_ids if i not in pool_ids), question.id]
