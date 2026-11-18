"""Normalização de respostas e agrupamento automático.

O agrupamento automático é de propósito tolerante, mas não esperto: ele junta
correspondências óbvias ("O Cachorro!", "cachorros", "um cachorro") num mesmo
balde e deixa os casos de julgamento ("SP" vs "São Paulo") para o anfitrião
resolver na tela de revelação (a manada).
"""

from __future__ import annotations

import re
from collections import Counter

_LEADING_ARTICLE = re.compile(r"^(o|a|os|as|um|uma|uns|umas)\s+", re.IGNORECASE)
_NON_WORD_EDGES = re.compile(r"^\W+|\W+$", re.UNICODE)
_WHITESPACE = re.compile(r"\s+")

_VOWEL = {
    "a": "a", "e": "e", "o": "o", "u": "u",
    "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
    "â": "a", "ê": "e", "ô": "o",
}


def normalize_answer(text: str) -> str:
    """Reduz diferenças triviais de grafia a uma chave comparável."""
    value = text.strip().lower()
    value = _WHITESPACE.sub(" ", value)
    value = _LEADING_ARTICLE.sub("", value)
    value = _NON_WORD_EDGES.sub("", value)
    value = _depluralize(value)
    return value or text.strip().lower()


def _depluralize(value: str) -> str:
    if len(value) <= 3 or not value.endswith("s"):
        return value
    if value.endswith("ões") or value.endswith("ães"):
        return value[:-3] + "ão"
    if value.endswith("ãos"):
        return value[:-1]
    if value.endswith("ns"):
        return value[:-2] + "m"
    if value.endswith(("res", "zes", "ses")):
        return value[:-2]
    if value.endswith("is") and len(value) > 4:
        prev = value[-3]
        if prev in _VOWEL:
            return value[:-3] + _VOWEL[prev] + "l"
        return value[:-2] + "il"
    if value.endswith("ss"):
        return value
    return value[:-1]


def auto_group(answers: list[dict]) -> list[dict]:
    """Agrupa respostas pela chave normalizada.

    ``answers`` é uma lista de ``{"player_id": str, "text": str}``.
    Retorna ``[{"key", "label", "player_ids"}]`` em ordem decrescente de tamanho.
    """
    buckets: dict[str, list[dict]] = {}
    for answer in answers:
        key = normalize_answer(answer["text"])
        buckets.setdefault(key, []).append(answer)

    groups: list[dict] = []
    for key, members in buckets.items():
        label_counts = Counter(m["text"].strip() for m in members)
        label = label_counts.most_common(1)[0][0]
        groups.append(
            {
                "key": key,
                "label": label,
                "player_ids": [m["player_id"] for m in members],
            }
        )

    groups.sort(key=lambda g: (-len(g["player_ids"]), g["label"].lower()))
    return groups
