from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
import uuid

from app.database import get_sql_connection


def row_to_dict(cursor, row) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for index, col in enumerate(cursor.description):
        value = row[index]
        if isinstance(value, Decimal):
            value = float(value)
        elif isinstance(value, datetime):
            value = value.isoformat()
        elif isinstance(value, date):
            value = value.isoformat()
        elif isinstance(value, uuid.UUID):
            value = str(value)
        result[col[0]] = value
    return result


def fetch_all(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    conn = get_sql_connection()
    try:
        cursor = conn.cursor()
        rows = cursor.execute(sql, params).fetchall()
        return [row_to_dict(cursor, row) for row in rows]
    finally:
        conn.close()


def fetch_one(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    rows = fetch_all(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: tuple[Any, ...] = ()) -> None:
    conn = get_sql_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
    finally:
        conn.close()
