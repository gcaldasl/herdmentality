from app.game import engine


def g(key, *player_ids):
    return {"key": key, "label": key, "player_ids": list(player_ids)}


def test_herd_scores_one_point_each():
    groups = [g("dog", "a", "b", "c"), g("cat", "d")]
    result = engine.resolve_round(groups, current_cow_holder=None)
    assert result.herd_group_key == "dog"
    assert result.point_deltas == {"a": 1, "b": 1, "c": 1}


def test_tie_for_largest_means_no_herd():
    groups = [g("dog", "a", "b"), g("cat", "c", "d")]
    result = engine.resolve_round(groups, current_cow_holder=None)
    assert result.herd_group_key is None
    assert result.point_deltas == {}


def test_lone_answer_takes_the_pink_cow():
    groups = [g("dog", "a", "b", "c"), g("horse", "d")]
    result = engine.resolve_round(groups, current_cow_holder=None)
    assert result.new_cow_holder == "d"
    assert result.cow_moved is True


def test_pink_cow_passes_from_previous_holder():
    groups = [g("dog", "a", "b", "c"), g("ostrich", "d")]
    result = engine.resolve_round(groups, current_cow_holder="a")
    assert result.new_cow_holder == "d"
    assert result.cow_moved is True


def test_pink_cow_does_not_move_when_two_players_are_alone():
    groups = [g("dog", "a", "b"), g("cat", "c"), g("fish", "d")]
    result = engine.resolve_round(groups, current_cow_holder="a")
    assert result.new_cow_holder == "a"
    assert result.cow_moved is False


def test_pink_cow_stays_when_holder_is_the_lone_one_again():
    groups = [g("dog", "a", "b", "c"), g("emu", "d")]
    result = engine.resolve_round(groups, current_cow_holder="d")
    assert result.new_cow_holder == "d"
    assert result.cow_moved is False


def test_holder_of_pink_cow_cannot_win():
    scores = {"a": 9, "b": 4}
    assert engine.check_winner(scores, cow_holder="a", win_target=8) is None


def test_winner_is_highest_eligible_scorer_at_target():
    scores = {"a": 9, "b": 8, "c": 2}
    assert engine.check_winner(scores, cow_holder="a", win_target=8) == "b"


def test_no_winner_below_target():
    scores = {"a": 7, "b": 6}
    assert engine.check_winner(scores, cow_holder=None, win_target=8) is None
