from app.game.normalize import auto_group, normalize_answer


def test_normalize_collapses_case_punctuation_and_articles():
    assert (
        normalize_answer("O Cachorro!")
        == normalize_answer("um cachorro")
        == "cachorro"
    )


def test_normalize_naive_depluralize():
    assert normalize_answer("cachorros") == "cachorro"
    assert normalize_answer("cães") == "cão"
    assert normalize_answer("homens") == "homem"
    assert normalize_answer("animais") == "animal"
    assert normalize_answer("flores") == "flor"


def test_normalize_keeps_double_s_words():
    assert normalize_answer("arroz") == "arroz"
    assert normalize_answer("compasso") == "compasso"


def test_normalize_keeps_accented_letters():
    assert normalize_answer("Ótimo") == "ótimo"


def test_auto_group_buckets_matching_answers():
    answers = [
        {"player_id": "a", "text": "O Cachorro!"},
        {"player_id": "b", "text": "cachorros"},
        {"player_id": "c", "text": "um cachorro"},
        {"player_id": "d", "text": "Gato"},
    ]
    groups = auto_group(answers)
    assert groups[0]["player_ids"] == ["a", "b", "c"]
    assert groups[0]["label"] in {"O Cachorro!", "cachorros", "um cachorro"}
    assert groups[1]["player_ids"] == ["d"]


def test_auto_group_orders_by_descending_size():
    answers = [
        {"player_id": "a", "text": "vermelho"},
        {"player_id": "b", "text": "azul"},
        {"player_id": "c", "text": "azul"},
    ]
    groups = auto_group(answers)
    assert [len(g["player_ids"]) for g in groups] == [2, 1]
