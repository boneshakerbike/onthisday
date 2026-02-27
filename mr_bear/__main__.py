# mr_bear/__main__.py — CLI entry point

import sys


def main():
    args = sys.argv[1:]

    if not args:
        print("Usage:")
        print("  python -m mr_bear predict <year> <round> <session_type>")
        print("  python -m mr_bear backtest <year> [--round N]")
        print()
        print("session_type: qualifying | race | sprint_qualifying | sprint")
        sys.exit(1)

    command = args[0]

    if command == "predict":
        if len(args) < 4:
            print("Usage: python -m mr_bear predict <year> <round> <session_type>")
            sys.exit(1)

        from .picks import generate_picks
        year = int(args[1])
        round_num = int(args[2])
        session_type = args[3]

        picks = generate_picks(year, round_num, session_type)
        print(f"Mr Bear's picks — {year} R{round_num} {session_type}:")
        print(f"  P1: {picks['p1']}")
        print(f"  P2: {picks['p2']}")
        print(f"  P3: {picks['p3']}")
        if picks["fastest_lap"]:
            print(f"  FL: {picks['fastest_lap']}")

    elif command == "backtest":
        if len(args) < 2:
            print("Usage: python -m mr_bear backtest <year> [--round N]")
            sys.exit(1)

        from .backtest import backtest_season
        year = int(args[1])
        single_round = None
        if "--round" in args:
            idx = args.index("--round")
            single_round = int(args[idx + 1])

        backtest_season(year, single_round)

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
