# mr_bear/backtest.py — 2025 season backtest

import fastf1

from .data import is_sprint_weekend, get_full_classification
from .picks import generate_picks, generate_picks_no_bias
from .scoring import score_picks


def get_actual_results(year, round_num, session_name):
    classification = get_full_classification(year, round_num, session_name)
    return {
        "p1": classification[0] if len(classification) > 0 else None,
        "p2": classification[1] if len(classification) > 1 else None,
        "p3": classification[2] if len(classification) > 2 else None,
    }, classification


def backtest_round(year, round_num):
    event = fastf1.get_event(year, round_num)
    event_name = event["EventName"]
    sprint = is_sprint_weekend(year, round_num)

    sessions = [("qualifying", "Qualifying"), ("race", "Race")]
    if sprint:
        sessions = [
            ("sprint_qualifying", "Sprint Qualifying"),
            ("sprint", "Sprint"),
            ("qualifying", "Qualifying"),
            ("race", "Race"),
        ]

    rows = []
    bear_total = 0
    baseline_total = 0

    for session_type, session_name in sessions:
        try:
            picks = generate_picks(year, round_num, session_type)
            baseline = generate_picks_no_bias(year, round_num, session_type)
            actual, classification = get_actual_results(year, round_num, session_name)

            # add fastest lap for race
            if session_type == "race":
                try:
                    from .data import _load_session
                    session = fastf1.get_session(year, round_num, "Race")
                    _load_session(session, round_num)
                    laps = session.laps
                    fastest = laps.loc[laps["LapTime"].idxmin()]
                    actual["fastest_lap"] = fastest["Driver"]
                except Exception:
                    actual["fastest_lap"] = None
            else:
                actual["fastest_lap"] = None

            bear_score = score_picks(picks, actual, classification)
            base_score = score_picks(baseline, actual, classification)
            bear_total += bear_score
            baseline_total += base_score

            fl_pick = picks.get("fastest_lap") or "-"
            fl_base = baseline.get("fastest_lap") or "-"
            label = session_name.replace("Sprint Qualifying", "Sprint Quali")

            rows.append(f"| {label:<14} | {picks['p1']:<7} | {picks['p2']:<7} | "
                        f"{picks['p3']:<7} | {fl_pick:<7} | {bear_score:<5} | {base_score:<13} |")
        except Exception as e:
            label = session_name.replace("Sprint Qualifying", "Sprint Quali")
            rows.append(f"| {label:<14} | {'ERR':<7} | {'ERR':<7} | "
                        f"{'ERR':<7} | {'-':<7} | {'?':<5} | {'?':<13} |")
            print(f"  Warning: {session_name} R{round_num}: {e}")

    header = f"\n## Round {round_num}: {event_name}"
    table_head = ("| Session        | P1 Pick | P2 Pick | P3 Pick | FL Pick | Score | No-Bias Score |"
                  "\n|----------------|---------|---------|---------|---------|-------|---------------|")

    print(header)
    print(table_head)
    for row in rows:
        print(row)

    return bear_total, baseline_total


def backtest_season(year, single_round=None):
    schedule = fastf1.get_event_schedule(year)
    rounds = [r for r in schedule["RoundNumber"] if r > 0]

    if single_round:
        rounds = [single_round]

    bear_season = 0
    baseline_season = 0

    print(f"# Mr Bear Backtest — {year} Season\n")

    for round_num in rounds:
        try:
            bear, baseline = backtest_round(year, round_num)
            bear_season += bear
            baseline_season += baseline
        except Exception as e:
            print(f"\n## Round {round_num}: FAILED — {e}")

    diff = baseline_season - bear_season
    print(f"\n## Season Total")
    print(f"Mr Bear: {bear_season} pts | No-Bias Baseline: {baseline_season} pts | "
          f"Verstappen Cost: {diff} pts")
