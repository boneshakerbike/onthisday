# mr_bear/test_scoring.py — unit tests for scoring logic

from .scoring import score_picks


def test_all_perfect():
    picks = {"p1": "NOR", "p2": "PIA", "p3": "LEC", "fastest_lap": "NOR"}
    actual = {"p1": "NOR", "p2": "PIA", "p3": "LEC", "fastest_lap": "NOR"}
    classification = ["NOR", "PIA", "LEC", "SAI", "HAM"]
    assert score_picks(picks, actual, classification) == 18  # 5+5+5+3


def test_all_wrong():
    picks = {"p1": "ALO", "p2": "STR", "p3": "TSU", "fastest_lap": "ALO"}
    actual = {"p1": "NOR", "p2": "PIA", "p3": "LEC", "fastest_lap": "NOR"}
    classification = ["NOR", "PIA", "LEC", "SAI", "HAM"]
    assert score_picks(picks, actual, classification) == 0


def test_podium_lock():
    picks = {"p1": "PIA", "p2": "NOR", "p3": "LEC", "fastest_lap": None}
    actual = {"p1": "NOR", "p2": "PIA", "p3": "LEC", "fastest_lap": None}
    classification = ["NOR", "PIA", "LEC", "SAI", "HAM"]
    # p1 PIA is on podium wrong pos = 2, p2 NOR same = 2, p3 LEC perfect = 5
    assert score_picks(picks, actual, classification) == 9


def test_almost_p4p5():
    picks = {"p1": "SAI", "p2": "HAM", "p3": "ALO", "fastest_lap": None}
    actual = {"p1": "NOR", "p2": "PIA", "p3": "LEC", "fastest_lap": None}
    classification = ["NOR", "PIA", "LEC", "SAI", "HAM"]
    # SAI is P4 = 1, HAM is P5 = 1, ALO nowhere = 0
    assert score_picks(picks, actual, classification) == 2


def test_fastest_lap_only():
    picks = {"p1": "ALO", "p2": "STR", "p3": "TSU", "fastest_lap": "NOR"}
    actual = {"p1": "NOR", "p2": "PIA", "p3": "LEC", "fastest_lap": "NOR"}
    classification = ["NOR", "PIA", "LEC", "SAI", "HAM"]
    assert score_picks(picks, actual, classification) == 3


def test_no_classification_no_almost():
    picks = {"p1": "SAI", "p2": "HAM", "p3": "ALO", "fastest_lap": None}
    actual = {"p1": "NOR", "p2": "PIA", "p3": "LEC", "fastest_lap": None}
    assert score_picks(picks, actual) == 0  # no classification, no almost points


def test_qualifying_no_fl():
    picks = {"p1": "NOR", "p2": "PIA", "p3": "LEC", "fastest_lap": None}
    actual = {"p1": "NOR", "p2": "PIA", "p3": "LEC", "fastest_lap": None}
    assert score_picks(picks, actual) == 15  # 5+5+5, no FL


if __name__ == "__main__":
    test_all_perfect()
    test_all_wrong()
    test_podium_lock()
    test_almost_p4p5()
    test_fastest_lap_only()
    test_no_classification_no_almost()
    test_qualifying_no_fl()
    print("All scoring tests passed!")
