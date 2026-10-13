#!/usr/bin/env python3
"""Preview the ordered versioned SQL; apply only to the isolated dev database."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import re
import sys

SQL_DIR = Path(__file__).resolve().parents[1] / "sql"
DEV_DATABASE = "AZBDWUSDEV"


def split_batches(sql: str) -> list[str]:
    return [batch.strip() for batch in re.split(r"(?im)^\s*GO\s*$", sql) if batch.strip()]


def validate_target(database: str) -> None:
    if database.casefold() != DEV_DATABASE.casefold():
        raise ValueError("Schema and seed tools may target AZBDWUSDEV only; prod is protected")


def apply_files(paths: list[Path], database: str) -> None:
    validate_target(database)
    sys.path.insert(0, str(SQL_DIR.parent))
    from app.database import get_sql_connection
    conn = get_sql_connection(database=database)
    try:
        cursor = conn.cursor()
        actual = cursor.execute("SELECT DB_NAME()").fetchone()[0]
        validate_target(actual)
        for path in paths:
            for batch in split_batches(path.read_text()):
                cursor.execute(batch)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target-db", default=DEV_DATABASE)
    parser.add_argument("--apply", action="store_true", help="Owner-approved dev SQL application")
    args = parser.parse_args()
    validate_target(args.target_db)
    paths = [SQL_DIR / name for name in json.loads((SQL_DIR / "manifest.json").read_text())]
    if args.apply:
        apply_files(paths, args.target_db)
    else:
        for path in paths:
            print(f"-- {path.name}\n{path.read_text()}")


if __name__ == "__main__":
    main()
