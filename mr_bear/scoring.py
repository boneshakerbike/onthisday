# mr_bear/scoring.py — scoring logic (matches the actual game)

PERFECT = 5
PODIUM_LOCK = 2
ALMOST = 1
FASTEST_LAP = 3


def score_picks(picks, actual, full_classification=None):
    """
    picks: {"p1", "p2", "p3", "fastest_lap"}
    actual: {"p1", "p2", "p3", "fastest_lap"}
    full_classification: list of driver codes in finishing order (for almost rule)
    """
    score = 0
    actual_podium = {actual["p1"], actual["p2"], actual["p3"]}
    p4p5 = set()
    if full_classification and len(full_classification) >= 5:
        p4p5 = {full_classification[3], full_classification[4]}

    for pos in ["p1", "p2", "p3"]:
        pick = picks[pos]
        if pick == actual[pos]:
            score += PERFECT
        elif pick in actual_podium:
            score += PODIUM_LOCK
        elif pick in p4p5:
            score += ALMOST

    if picks.get("fastest_lap") and actual.get("fastest_lap"):
        if picks["fastest_lap"] == actual["fastest_lap"]:
            score += FASTEST_LAP

    return score
