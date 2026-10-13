#!/usr/bin/env python3
"""Compatibility entry point using the same guarded dev migration runner."""
import argparse
from pathlib import Path
from migrate_azure_sql_db import apply_files, validate_target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sql_file", type=Path)
    parser.add_argument("--target-db", default="AZBDWUSDEV")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    validate_target(args.target_db)
    if args.apply:
        apply_files([args.sql_file], args.target_db)
    else:
        print(args.sql_file.read_text())


if __name__ == "__main__":
    main()
