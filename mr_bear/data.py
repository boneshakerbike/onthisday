# mr_bear/data.py — FastF1 data fetching

import fastf1


def is_sprint_weekend(year, round_num):
    event = fastf1.get_event(year, round_num)
    return "Sprint" in str(event.get("EventFormat", ""))


def get_driver_name_map(session):
    results = session.results
    return {row["Abbreviation"]: row["FullName"] for _, row in results.iterrows()}


def get_practice_ranking(year, round_num, target):
    """
    target: 'qualifying', 'race', 'sprint_qualifying', 'sprint'

    Returns: list of (driver_code, full_name, lap_time_seconds)
    sorted fastest first.
    """
    sprint = is_sprint_weekend(year, round_num)

    if target == "qualifying":
        session_name = "FP1" if sprint else "FP3"
        return _best_laps(year, round_num, session_name)

    elif target == "sprint_qualifying":
        return _best_laps(year, round_num, "FP1")

    elif target == "race":
        return _grid_order(year, round_num, "Qualifying")

    elif target == "sprint":
        return _grid_order(year, round_num, "Sprint Qualifying")

    raise ValueError(f"Unknown target: {target}")


def get_full_classification(year, round_num, session_name):
    session = fastf1.get_session(year, round_num, session_name)
    session.load()
    results = session.results.sort_values("Position")
    return [row["Abbreviation"] for _, row in results.iterrows()
            if row["Position"] == row["Position"]]  # exclude NaN


def _best_laps(year, round_num, session_name):
    session = fastf1.get_session(year, round_num, session_name)
    session.load()
    names = get_driver_name_map(session)
    laps = session.laps.pick_accurate()
    best = laps.groupby("Driver")["LapTime"].min().dropna().sort_values()
    return [(code, names.get(code, code), t.total_seconds())
            for code, t in best.items()]


def _grid_order(year, round_num, session_name):
    session = fastf1.get_session(year, round_num, session_name)
    session.load()
    names = get_driver_name_map(session)
    results = session.results.sort_values("Position")
    out = []
    for _, row in results.iterrows():
        code = row["Abbreviation"]
        pos = row["Position"]
        if pos != pos:  # NaN check
            continue
        out.append((code, names.get(code, code), 0.0))
    return out
