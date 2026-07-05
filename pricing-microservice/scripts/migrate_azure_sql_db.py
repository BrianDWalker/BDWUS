#!/usr/bin/env python3
"""
Clone selected Azure SQL Database user schemas, tables, indexes, views, and data.

This script uses Azure AD access tokens from the Azure CLI to connect to Azure SQL.
It recreates user objects from the source database in the target database, copies
the table data, and validates row counts.
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import subprocess

import pyodbc


SQL_COPT_SS_ACCESS_TOKEN = 1256
DEFAULT_SERVER = "bdwus.database.windows.net"
DEFAULT_SOURCE_DB = os.getenv("SOURCE_SQL_DATABASE")
DEFAULT_TARGET_DB = os.getenv("TARGET_SQL_DATABASE") or os.getenv("SQL_DATABASE") or "AZBDWUSP"
DEFAULT_SCHEMAS = ("ai", "billing", "dbo", "ms")
SYSTEM_VIEWS = {"sys.database_firewall_rules"}


def get_access_token_struct() -> bytes:
    raw = subprocess.check_output(
        [
            "az",
            "account",
            "get-access-token",
            "--resource",
            "https://database.windows.net/",
            "-o",
            "json",
        ],
        text=True,
    )
    access_token = json.loads(raw)["accessToken"].encode("utf-16-le")
    return struct.pack(f"<I{len(access_token)}s", len(access_token), access_token)


def connect(server: str, database: str) -> pyodbc.Connection:
    conn_str = (
        "Driver={ODBC Driver 18 for SQL Server};"
        f"Server=tcp:{server},1433;"
        f"Database={database};"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
        "Connection Timeout=30;"
    )
    return pyodbc.connect(conn_str, attrs_before={SQL_COPT_SS_ACCESS_TOKEN: get_access_token_struct()})


def qname(schema: str, name: str) -> str:
    return f"[{schema}].[{name}]"


def bracket(identifier: str) -> str:
    return f"[{identifier}]"


def fetchall_dicts(cursor: pyodbc.Cursor, sql: str, params: tuple = ()) -> list[dict]:
    rows = cursor.execute(sql, params).fetchall()
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in rows]


def get_tables(cursor: pyodbc.Cursor, schemas: tuple[str, ...]) -> list[dict]:
    placeholders = ",".join("?" for _ in schemas)
    return fetchall_dicts(
        cursor,
        f"""
        SELECT
          s.name AS schema_name,
          t.name AS table_name,
          t.object_id
        FROM sys.tables t
        JOIN sys.schemas s ON s.schema_id = t.schema_id
        WHERE s.name IN ({placeholders})
        ORDER BY CASE s.name WHEN 'billing' THEN 1 WHEN 'ms' THEN 2 WHEN 'ai' THEN 3 WHEN 'dbo' THEN 4 ELSE 5 END,
                 s.name,
                 t.name
        """,
        schemas,
    )


def get_views(cursor: pyodbc.Cursor, schemas: tuple[str, ...]) -> list[dict]:
    placeholders = ",".join("?" for _ in schemas)
    return fetchall_dicts(
        cursor,
        f"""
        SELECT
          s.name AS schema_name,
          v.name AS view_name,
          OBJECT_DEFINITION(v.object_id) AS definition
        FROM sys.views v
        JOIN sys.schemas s ON s.schema_id = v.schema_id
        WHERE s.name IN ({placeholders})
        ORDER BY s.name, v.name
        """,
        schemas,
    )


def get_columns(cursor: pyodbc.Cursor, object_id: int) -> list[dict]:
    return fetchall_dicts(
        cursor,
        """
        SELECT
          c.column_id,
          c.name AS column_name,
          typ.name AS type_name,
          c.max_length,
          c.precision,
          c.scale,
          c.is_nullable,
          c.is_identity,
          c.is_computed,
          dc.definition AS default_definition,
          CONVERT(BIGINT, ic.seed_value) AS seed_value,
          CONVERT(BIGINT, ic.increment_value) AS increment_value
        FROM sys.columns c
        JOIN sys.types typ ON typ.user_type_id = c.user_type_id
        LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
        LEFT JOIN sys.identity_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE c.object_id = ?
        ORDER BY c.column_id
        """,
        (object_id,),
    )


def get_primary_key(cursor: pyodbc.Cursor, object_id: int) -> dict | None:
    rows = fetchall_dicts(
        cursor,
        """
        SELECT
          kc.name AS constraint_name,
          ic.key_ordinal,
          c.name AS column_name
        FROM sys.key_constraints kc
        JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE kc.parent_object_id = ? AND kc.type = 'PK'
        ORDER BY ic.key_ordinal
        """,
        (object_id,),
    )
    if not rows:
        return None
    return {
        "constraint_name": rows[0]["constraint_name"],
        "columns": [row["column_name"] for row in rows],
    }


def get_indexes(cursor: pyodbc.Cursor, object_id: int) -> list[dict]:
    return fetchall_dicts(
        cursor,
        """
        WITH key_cols AS (
          SELECT
            i.object_id,
            i.index_id,
            STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS key_columns
          FROM sys.indexes i
          JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
          JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
          WHERE i.object_id = ? AND i.is_primary_key = 0 AND i.is_hypothetical = 0 AND i.index_id > 0
          GROUP BY i.object_id, i.index_id
        ),
        include_cols AS (
          SELECT
            i.object_id,
            i.index_id,
            STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id) AS include_columns
          FROM sys.indexes i
          JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1
          JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
          WHERE i.object_id = ? AND i.is_primary_key = 0 AND i.is_hypothetical = 0 AND i.index_id > 0
          GROUP BY i.object_id, i.index_id
        )
        SELECT
          i.name AS index_name,
          i.is_unique,
          i.type_desc,
          kc.key_columns,
          ic.include_columns
        FROM sys.indexes i
        JOIN key_cols kc ON kc.object_id = i.object_id AND kc.index_id = i.index_id
        LEFT JOIN include_cols ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE i.object_id = ? AND i.is_primary_key = 0 AND i.is_hypothetical = 0 AND i.index_id > 0
        ORDER BY i.name
        """,
        (object_id, object_id, object_id),
    )


def sql_type(column: dict) -> str:
    type_name = column["type_name"].lower()
    max_length = column["max_length"]
    precision = column["precision"]
    scale = column["scale"]

    if type_name in {"nvarchar", "nchar"}:
        if max_length == -1:
            size = "MAX"
        else:
            size = str(max_length // 2)
        return f"{type_name.upper()}({size})"
    if type_name in {"varchar", "char", "varbinary", "binary"}:
        size = "MAX" if max_length == -1 else str(max_length)
        return f"{type_name.upper()}({size})"
    if type_name in {"decimal", "numeric"}:
        return f"{type_name.upper()}({precision},{scale})"
    if type_name in {"datetime2", "datetimeoffset", "time"}:
        return f"{type_name.upper()}({scale})"
    return type_name.upper()


def build_create_table(schema: str, table: str, columns: list[dict], pk: dict | None) -> str:
    lines: list[str] = []
    for column in columns:
        if column["is_computed"]:
            raise RuntimeError(f"Computed columns are not supported automatically: {schema}.{table}.{column['column_name']}")
        line = f"  {bracket(column['column_name'])} {sql_type(column)}"
        if column["is_identity"]:
            line += f" IDENTITY({int(column['seed_value'])},{int(column['increment_value'])})"
        if column["default_definition"]:
            line += f" DEFAULT {column['default_definition']}"
        line += " NOT NULL" if not column["is_nullable"] else " NULL"
        lines.append(line)

    if pk:
        pk_cols = ", ".join(bracket(col) for col in pk["columns"])
        lines.append(f"  CONSTRAINT {bracket(pk['constraint_name'])} PRIMARY KEY ({pk_cols})")

    body = ",\n".join(lines)
    return f"CREATE TABLE {qname(schema, table)} (\n{body}\n);"


def execute_batches(cursor: pyodbc.Cursor, sql: str) -> None:
    batches = []
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
    for batch in batches:
        cursor.execute(batch)


def ensure_schemas(target_cursor: pyodbc.Cursor, schemas: tuple[str, ...]) -> None:
    for schema in schemas:
        target_cursor.execute(f"IF SCHEMA_ID('{schema}') IS NULL EXEC('CREATE SCHEMA [{schema}]');")


def copy_table(
    source_cursor: pyodbc.Cursor,
    target_cursor: pyodbc.Cursor,
    schema: str,
    table: str,
    columns: list[dict],
    batch_size: int,
) -> int:
    target_cursor.execute(f"DELETE FROM {qname(schema, table)};")
    column_names = [col["column_name"] for col in columns]
    select_columns = ", ".join(bracket(col) for col in column_names)
    placeholders = ", ".join("?" for _ in column_names)
    insert_sql = f"INSERT INTO {qname(schema, table)} ({select_columns}) VALUES ({placeholders})"
    select_sql = f"SELECT {select_columns} FROM {qname(schema, table)}"

    identity_cols = [col for col in columns if col["is_identity"]]
    if identity_cols:
        target_cursor.execute(f"SET IDENTITY_INSERT {qname(schema, table)} ON;")

    source_cursor.execute(select_sql)
    rows_copied = 0
    target_cursor.fast_executemany = True
    while True:
        rows = source_cursor.fetchmany(batch_size)
        if not rows:
            break
        target_cursor.executemany(insert_sql, rows)
        rows_copied += len(rows)

    if identity_cols:
        target_cursor.execute(f"SET IDENTITY_INSERT {qname(schema, table)} OFF;")

    return rows_copied


def main() -> None:
    parser = argparse.ArgumentParser(description="Clone Azure SQL schema and data between databases.")
    parser.add_argument("--server", default=DEFAULT_SERVER)
    parser.add_argument("--source-db", default=DEFAULT_SOURCE_DB, required=DEFAULT_SOURCE_DB is None)
    parser.add_argument("--target-db", default=DEFAULT_TARGET_DB)
    parser.add_argument("--schemas", nargs="+", default=list(DEFAULT_SCHEMAS))
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--skip-data", action="store_true")
    args = parser.parse_args()

    schemas = tuple(args.schemas)
    source_conn = connect(args.server, args.source_db)
    target_conn = connect(args.server, args.target_db)
    source_cursor = source_conn.cursor()
    target_cursor = target_conn.cursor()

    try:
        print(f"Connecting source={args.source_db} target={args.target_db} on server={args.server}")
        tables = get_tables(source_cursor, schemas)
        views = [view for view in get_views(source_cursor, schemas) if f"{view['schema_name']}.{view['view_name']}" not in SYSTEM_VIEWS]
        print(f"Found {len(tables)} tables and {len(views)} views to migrate")

        ensure_schemas(target_cursor, schemas)
        target_conn.commit()

        table_metadata: dict[tuple[str, str], list[dict]] = {}
        for table_info in tables:
            schema = table_info["schema_name"]
            table = table_info["table_name"]
            object_id = table_info["object_id"]
            columns = get_columns(source_cursor, object_id)
            pk = get_primary_key(source_cursor, object_id)
            create_sql = build_create_table(schema, table, columns, pk)
            target_cursor.execute(
                f"IF OBJECT_ID('{schema}.{table}', 'U') IS NOT NULL DROP TABLE {qname(schema, table)};"
            )
            target_cursor.execute(create_sql)
            table_metadata[(schema, table)] = columns
            print(f"Created table {schema}.{table}")

        for table_info in tables:
            schema = table_info["schema_name"]
            table = table_info["table_name"]
            object_id = table_info["object_id"]
            for index in get_indexes(source_cursor, object_id):
                unique_sql = "UNIQUE " if index["is_unique"] else ""
                include_sql = f" INCLUDE ({index['include_columns']})" if index["include_columns"] else ""
                sql = (
                    f"CREATE {unique_sql}{index['type_desc']} INDEX {bracket(index['index_name'])} "
                    f"ON {qname(schema, table)} ({index['key_columns']}){include_sql};"
                )
                target_cursor.execute(sql)
                print(f"Created index {index['index_name']} on {schema}.{table}")

        target_conn.commit()

        for view in views:
            schema = view["schema_name"]
            name = view["view_name"]
            target_cursor.execute(
                f"IF OBJECT_ID('{schema}.{name}', 'V') IS NOT NULL DROP VIEW {qname(schema, name)};"
            )
            execute_batches(target_cursor, view["definition"])
            print(f"Created view {schema}.{name}")

        target_conn.commit()

        row_counts: dict[str, tuple[int, int]] = {}
        if not args.skip_data:
            for table_info in tables:
                schema = table_info["schema_name"]
                table = table_info["table_name"]
                count = copy_table(
                    source_cursor,
                    target_cursor,
                    schema,
                    table,
                    table_metadata[(schema, table)],
                    args.batch_size,
                )
                source_count = source_cursor.execute(f"SELECT COUNT(*) FROM {qname(schema, table)}").fetchone()[0]
                target_count = target_cursor.execute(f"SELECT COUNT(*) FROM {qname(schema, table)}").fetchone()[0]
                row_counts[f"{schema}.{table}"] = (source_count, target_count)
                print(f"Copied {schema}.{table}: {count} rows")

            target_conn.commit()

        print("\nValidation summary")
        for object_name, (source_count, target_count) in row_counts.items():
            status = "OK" if source_count == target_count else "MISMATCH"
            print(f"{status}\t{object_name}\tsource={source_count}\ttarget={target_count}")

    finally:
        source_conn.close()
        target_conn.close()


if __name__ == "__main__":
    main()
