#!/usr/bin/env python3
"""Validate fc-gpt Phase 2 Azure SQL schema readiness."""

from __future__ import annotations

import sys

from app.database import SQL_DATABASE, SQL_SERVER, get_sql_connection


REQUIRED_OBJECTS = [
    ("admin", "Users", "USER_TABLE"),
    ("admin", "Roles", "USER_TABLE"),
    ("admin", "Integrations", "USER_TABLE"),
    ("billing", "BillingElements", "USER_TABLE"),
    ("billingops", "Invoices", "USER_TABLE"),
    ("billingops", "InvoiceActions", "USER_TABLE"),
    ("billingops", "Adjustments", "USER_TABLE"),
    ("care", "Tickets", "USER_TABLE"),
    ("care", "TicketNotes", "USER_TABLE"),
    ("knowledge", "Topics", "USER_TABLE"),
    ("knowledge", "Documents", "USER_TABLE"),
    ("knowledge", "DocumentTopics", "USER_TABLE"),
    ("knowledge", "vDocuments", "VIEW"),
    ("ops", "Orders", "USER_TABLE"),
    ("ops", "NetworkEvents", "USER_TABLE"),
    ("ops", "ProvisioningJobs", "USER_TABLE"),
    ("ops", "Settlements", "USER_TABLE"),
    ("report", "ReportDefinitions", "USER_TABLE"),
    ("report", "vReportDefinitions", "VIEW"),
]

MIN_ROW_COUNTS = {
    "billing.BillingElements": 1,
    "knowledge.Topics": 4,
    "knowledge.Documents": 5,
    "report.ReportDefinitions": 3,
}

REQUIRED_COLUMNS = {
    "ops.Orders": ["UpdatedAtUtc", "IsDeleted"],
    "ops.NetworkEvents": ["UpdatedAtUtc", "IsDeleted"],
    "ops.ProvisioningJobs": ["UpdatedAtUtc", "IsDeleted"],
    "ops.Settlements": ["UpdatedAtUtc", "IsDeleted"],
    "admin.Users": ["UpdatedAtUtc", "IsDeleted"],
    "admin.Roles": ["UpdatedAtUtc", "IsDeleted"],
    "admin.Integrations": ["UpdatedAtUtc", "IsDeleted"],
    "billingops.Invoices": ["UpdatedAtUtc", "IsDeleted"],
    "billingops.InvoiceActions": ["UpdatedAtUtc", "IsDeleted"],
    "billingops.Adjustments": ["UpdatedAtUtc", "IsDeleted"],
    "care.Tickets": ["EscalationLevel", "SlaTargetHours", "ClosureReason", "ClosedAtUtc", "UpdatedAtUtc", "IsDeleted"],
}


def main() -> int:
    print(f"Validating Phase 2 schema on {SQL_SERVER}/{SQL_DATABASE}")
    failures: list[str] = []
    conn = get_sql_connection()
    try:
        cursor = conn.cursor()
        for schema, name, type_desc in REQUIRED_OBJECTS:
            row = cursor.execute(
                """
                SELECT 1
                FROM sys.objects o
                JOIN sys.schemas s ON s.schema_id = o.schema_id
                WHERE s.name = ? AND o.name = ? AND o.type_desc = ?
                """,
                (schema, name, type_desc),
            ).fetchone()
            if not row:
                failures.append(f"Missing object: {schema}.{name} ({type_desc})")
            else:
                print(f"OK object {schema}.{name}")

        for object_name, columns in REQUIRED_COLUMNS.items():
            schema, table = object_name.split(".", 1)
            existing = {
                row[0]
                for row in cursor.execute(
                    """
                    SELECT c.name
                    FROM sys.columns c
                    JOIN sys.objects o ON o.object_id = c.object_id
                    JOIN sys.schemas s ON s.schema_id = o.schema_id
                    WHERE s.name = ? AND o.name = ?
                    """,
                    (schema, table),
                ).fetchall()
            }
            for column in columns:
                if column not in existing:
                    failures.append(f"Missing column: {object_name}.{column}")
                else:
                    print(f"OK column {object_name}.{column}")

        for table, minimum in MIN_ROW_COUNTS.items():
            row = cursor.execute(f"SELECT COUNT_BIG(*) FROM {table}").fetchone()
            count = int(row[0])
            if count < minimum:
                failures.append(f"Row count too low: {table} count={count} expected>={minimum}")
            else:
                print(f"OK rows {table} count={count}")

        migration = cursor.execute(
            "SELECT 1 FROM dbo.SchemaMigrations WHERE MigrationId = ?",
            ("fc-gpt-phase2-schema-hardening",),
        ).fetchone()
        if not migration:
            failures.append("Missing migration marker: fc-gpt-phase2-schema-hardening")
        else:
            print("OK migration marker fc-gpt-phase2-schema-hardening")
    finally:
        conn.close()

    if failures:
        print("Phase 2 schema validation failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("Phase 2 schema validation passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
