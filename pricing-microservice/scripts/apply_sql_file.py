#!/usr/bin/env python3
"""Apply a GO-delimited SQL file to Azure SQL using the app database connection."""

from __future__ import annotations

import argparse
from pathlib import Path

from app.database import SQL_DATABASE, SQL_SERVER, get_sql_connection


def split_batches(sql: str) -> list[str]:
    batches: list[str] = []
    current: list[str] = []
    for line in sql.splitlines():
        if line.strip().upper() == "GO":
            batch = "\n".join(current).strip()
            if batch:
                batches.append(batch)
            current = []
        else:
            current.append(line)
    tail = "\n".join(current).strip()
    if tail:
        batches.append(tail)
    return batches


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply a GO-delimited SQL file to Azure SQL.")
    parser.add_argument("sql_file", type=Path)
    args = parser.parse_args()

    sql_path = args.sql_file.resolve()
    sql = sql_path.read_text(encoding="utf-8")
    batches = split_batches(sql)

    print(f"Applying {sql_path} to {SQL_SERVER}/{SQL_DATABASE} ({len(batches)} batches)")
    conn = get_sql_connection()
    try:
        cursor = conn.cursor()
        for index, batch in enumerate(batches, start=1):
            cursor.execute(batch)
            print(f"Applied batch {index}/{len(batches)}")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    print("Migration applied successfully")


if __name__ == "__main__":
    main()
