# mr_bear/picks.py — pick generation

from .data import get_practice_ranking, get_full_classification, is_sprint_weekend
from .biases import apply_biases


def generate_picks(year, round_num, session_type):
    """
    session_type: 'qualifying' | 'race' | 'sprint_qualifying' | 'sprint'
    Returns dict: {"p1", "p2", "p3", "fastest_lap"}
    """
    ranking_data = get_practice_ranking(year, round_num, session_type)
    codes = [r[0] for r in ranking_data]
    names = {r[0]: r[1] for r in ranking_data}

    biased = apply_biases(codes, names, year)

    picks = {
        "p1": biased[0],
        "p2": biased[1],
        "p3": biased[2],
        "fastest_lap": None,
    }

    if session_type == "race":
        # fastest lap: pick the fastest qualifier among biased top 10
        quali_data = get_practice_ranking(year, round_num, "qualifying")
        quali_codes = [r[0] for r in quali_data]
        quali_names = {r[0]: r[1] for r in quali_data}
        quali_biased = apply_biases(quali_codes, quali_names, year)

        top10_race = set(biased[:10])
        for code in quali_biased:
            if code in top10_race:
                picks["fastest_lap"] = code
                break

    return picks


def generate_picks_no_bias(year, round_num, session_type):
    """Same as generate_picks but without personality biases."""
    ranking_data = get_practice_ranking(year, round_num, session_type)
    codes = [r[0] for r in ranking_data]

    picks = {
        "p1": codes[0],
        "p2": codes[1],
        "p3": codes[2],
        "fastest_lap": None,
    }

    if session_type == "race":
        quali_data = get_practice_ranking(year, round_num, "qualifying")
        quali_codes = [r[0] for r in quali_data]
        top10_race = set(codes[:10])
        for code in quali_codes:
            if code in top10_race:
                picks["fastest_lap"] = code
                break

    return picks
