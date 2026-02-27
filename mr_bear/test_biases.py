# mr_bear/test_biases.py — unit tests for bias logic

from .biases import apply_biases


def test_ver_removed():
    ranking = ["VER", "NOR", "PIA", "LEC"]
    names = {"VER": "Max Verstappen", "NOR": "Lando Norris", "PIA": "Oscar Piastri", "LEC": "Charles Leclerc"}
    result = apply_biases(ranking, names, 2025)
    assert "VER" not in result
    assert result[0] == "NOR"


def test_bear_boost():
    ranking = ["NOR", "PIA", "LEC", "SAI", "HAM", "RUS", "BEA"]
    names = {"BEA": "Oliver Bearman", "NOR": "Lando Norris", "PIA": "Oscar Piastri",
             "LEC": "Charles Leclerc", "SAI": "Carlos Sainz", "HAM": "Lewis Hamilton",
             "RUS": "George Russell"}
    result = apply_biases(ranking, names, 2025)
    # BEA at index 6, bear boost -3 -> index 3, then rookie boost -2 -> index 1
    assert result.index("BEA") == 1


def test_bearman_gets_double_boost():
    # BEA starts at index 5, bear boost -3 -> 2, rookie boost -2 -> 0
    ranking = ["NOR", "PIA", "LEC", "SAI", "HAM", "BEA"]
    names = {"BEA": "Oliver Bearman", "NOR": "Lando Norris", "PIA": "Oscar Piastri",
             "LEC": "Charles Leclerc", "SAI": "Carlos Sainz", "HAM": "Lewis Hamilton"}
    result = apply_biases(ranking, names, 2025)
    assert result[0] == "BEA"


def test_rookie_boost_no_bear():
    ranking = ["NOR", "PIA", "LEC", "SAI", "ANT"]
    names = {"ANT": "Kimi Antonelli", "NOR": "Lando Norris", "PIA": "Oscar Piastri",
             "LEC": "Charles Leclerc", "SAI": "Carlos Sainz"}
    result = apply_biases(ranking, names, 2025)
    # ANT at index 4, rookie boost -2 -> index 2
    assert result.index("ANT") == 2


def test_no_rookies_2026():
    ranking = ["NOR", "PIA", "BEA"]
    names = {"BEA": "Oliver Bearman", "NOR": "Lando Norris", "PIA": "Oscar Piastri"}
    result = apply_biases(ranking, names, 2026)
    # bear boost only (no rookie in 2026 list), BEA at 2 -> 0
    assert result[0] == "BEA"


if __name__ == "__main__":
    test_ver_removed()
    test_bear_boost()
    test_bearman_gets_double_boost()
    test_rookie_boost_no_bear()
    test_no_rookies_2026()
    print("All bias tests passed!")
