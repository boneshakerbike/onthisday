# mr_bear/biases.py — Mr Bear's personality biases

from .config import VERSTAPPEN_CODE, BEAR_BOOST, ROOKIE_BOOST, ROOKIES


def apply_biases(ranking, driver_names, season):
    """
    ranking: list of driver codes, fastest first
    driver_names: dict {code: full_name}
    season: int

    1. Remove VER
    2. Promote bear-name drivers by BEAR_BOOST
    3. Promote rookies by ROOKIE_BOOST
    """
    result = [c for c in ranking if c != VERSTAPPEN_CODE]

    # bear name boost
    for i, code in enumerate(result):
        name = driver_names.get(code, "")
        if "bear" in name.lower():
            new_pos = max(0, i - BEAR_BOOST)
            if new_pos != i:
                result.pop(i)
                result.insert(new_pos, code)

    # rookie boost
    rookies = set(ROOKIES.get(season, []))
    for i, code in enumerate(result):
        if code in rookies:
            new_pos = max(0, i - ROOKIE_BOOST)
            if new_pos != i:
                result.pop(i)
                result.insert(new_pos, code)

    return result
