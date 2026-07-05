from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

from app.database import get_sql_connection
from app.services import smoke_data

ops_router = APIRouter(prefix="/api/ops", tags=["ops"])
admin_router = APIRouter(prefix="/api/admin", tags=["admin"])
billing_workflow_router = APIRouter(prefix="/api/billing-workflows", tags=["billing-workflows"])
SCHEMA_READY = False
SCHEMA_LOCK = threading.Lock()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def jdump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def row_to_dict(cursor, row) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for index, col in enumerate(cursor.description):
        value = row[index]
        if isinstance(value, datetime):
            value = value.isoformat()
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


def require_row(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any]:
    row = fetch_one(sql, params)
    if not row:
        raise HTTPException(status_code=404, detail="Record not found.")
    return row


def execute(sql: str, params: tuple[Any, ...] = ()) -> None:
    conn = get_sql_connection()
    try:
        conn.cursor().execute(sql, params)
        conn.commit()
    finally:
        conn.close()


def stable_uuid(value: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, value))


def ensure_ops_storage() -> None:
    if smoke_data.smoke_mode_enabled():
        return
    global SCHEMA_READY
    if SCHEMA_READY:
        return
    with SCHEMA_LOCK:
        if SCHEMA_READY:
            return
        conn = get_sql_connection()
        try:
            cursor = conn.cursor()
            required_checks = [
                ("ops", "Orders"),
                ("ops", "NetworkEvents"),
                ("ops", "ProvisioningJobs"),
                ("ops", "Settlements"),
                ("admin", "Users"),
                ("admin", "Roles"),
                ("admin", "Integrations"),
                ("billingops", "Invoices"),
                ("billingops", "InvoiceActions"),
                ("billingops", "Adjustments"),
            ]
            missing = []
            for schema, name in required_checks:
                row = cursor.execute(
                    """
                    SELECT 1
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                    """,
                    (schema, name),
                ).fetchone()
                if not row:
                    missing.append(f"{schema}.{name}")
            if missing:
                raise RuntimeError(
                    "Ops/admin/billing workflow storage is not ready. Apply the source-controlled Azure SQL migrations "
                    "and, if needed, run pricing-microservice/scripts/bootstrap_demo_data.py explicitly. "
                    f"Missing objects: {', '.join(missing)}"
                )
        finally:
            conn.close()
        SCHEMA_READY = True


def table_has_rows(table_name: str) -> bool:
    return fetch_one(f"SELECT TOP 1 1 AS HasRow FROM {table_name}") is not None


def seed_ops_data() -> None:
    conn = get_sql_connection()
    try:
        cur = conn.cursor()
        if not table_has_rows("ops.Orders"):
            cur.executemany("INSERT INTO ops.Orders (OrderId, OrderNumber, CustomerNumber, AccountName, ServiceName, LifecycleStage, OverallStatus, SlaStatus, DueDate, AssignedTeam, CircuitId, Location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
                (stable_uuid("order-1"), "ORD-1001", "CUST-1001", "Apex Health", "Fiber 1G", "Provisioning", "In Progress", "On Track", "2026-05-20", "Provisioning Ops", "CKT-1001-701", "Chicago Campus"),
                (stable_uuid("order-2"), "ORD-1002", "CUST-1004", "Summit Manufacturing", "SD-WAN", "Installation", "Pending Network", "At Risk", "2026-05-22", "Network Ops", "CKT-1004-702", "Los Angeles Plant")
            ])
        if not table_has_rows("ops.NetworkEvents"):
            cur.executemany("INSERT INTO ops.NetworkEvents (EventId, EventNumber, Market, Type, Impacted, Severity, SlaExposure, Status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
                (stable_uuid("event-1"), "NE-1001", "Dallas", "Fiber outage", "Metro Logistics", "Critical", 12450, "Open"),
                (stable_uuid("event-2"), "NE-1002", "Chicago", "Latency spike", "Apex Health", "Major", 3200, "Monitoring")
            ])
        if not table_has_rows("ops.ProvisioningJobs"):
            cur.executemany("INSERT INTO ops.ProvisioningJobs (ProvisioningJobId, OrderId, JobNumber, JobType, OwnerName, Status, DueDate) VALUES (?, ?, ?, ?, ?, ?, ?)", [
                (stable_uuid("job-1"), stable_uuid("order-1"), "JOB-1001", "Circuit turn-up", "Provisioning Ops", "Queued", "2026-05-19"),
                (stable_uuid("job-2"), stable_uuid("order-2"), "JOB-1002", "Install coordination", "Field Ops", "Blocked", "2026-05-21")
            ])
        if not table_has_rows("ops.Settlements"):
            cur.executemany("INSERT INTO ops.Settlements (SettlementId, SettlementNumber, PartnerName, BillingPeriod, ExposureAmount, Status, ClaimType) VALUES (?, ?, ?, ?, ?, ?, ?)", [
                (stable_uuid("settlement-1"), "SET-1001", "Carrier West", "2026-05", 18420, "Review", "Interconnect credit"),
                (stable_uuid("settlement-2"), "SET-1002", "Metro Fiber", "2026-05", 6400, "Open", "Access true-up")
            ])
        if not table_has_rows("admin.Users"):
            cur.executemany("INSERT INTO admin.Users (UserId, UserNumber, UserName, Email, RoleName, Status, LastLoginAtUtc) VALUES (?, ?, ?, ?, ?, ?, ?)", [
                (stable_uuid("admin-user-1"), "USR-1001", "Rhea Patel", "rhea@example.com", "Sales Manager", "Active", utc_now()),
                (stable_uuid("admin-user-2"), "USR-1002", "Cal Brooks", "cal@example.com", "Billing Analyst", "Active", utc_now())
            ])
        if not table_has_rows("admin.Roles"):
            cur.executemany("INSERT INTO admin.Roles (RoleId, RoleNumber, RoleName, PermissionsJson, Status) VALUES (?, ?, ?, ?, ?)", [
                (stable_uuid("role-1"), "ROLE-1", "Sales Manager", jdump(["opportunities", "quotes", "approvals"]), "Active"),
                (stable_uuid("role-2"), "ROLE-2", "Billing Analyst", jdump(["invoices", "payments", "adjustments"]), "Active")
            ])
        if not table_has_rows("admin.Integrations"):
            cur.executemany("INSERT INTO admin.Integrations (IntegrationId, IntegrationNumber, IntegrationName, OwnerName, Status, Detail) VALUES (?, ?, ?, ?, ?, ?)", [
                (stable_uuid("integration-1"), "INT-1", "CRM Sync", "Platform", "Connected", "Customer and account sync"),
                (stable_uuid("integration-2"), "INT-2", "Provisioning API", "Network", "Pending", "Activation and circuit mapping")
            ])
        if not table_has_rows("billingops.Invoices"):
            cur.executemany("INSERT INTO billingops.Invoices (InvoiceId, InvoiceNumber, CustomerNumber, AccountName, Amount, Balance, Status, InvoiceDate, DueDate, BillingProfile) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
                (stable_uuid("invoice-1"), "INV-1001", "CUST-1001", "Apex Health", 28450, 7200, "Open", "2026-05-01", "2026-05-31", "Net 30"),
                (stable_uuid("invoice-2"), "INV-1002", "CUST-1002", "Brightstar Retail", 11840, 11840, "Dispute", "2026-05-01", "2026-05-20", "Net 15")
            ])
        if not table_has_rows("billingops.InvoiceActions"):
            cur.executemany("INSERT INTO billingops.InvoiceActions (InvoiceActionId, InvoiceId, ActionType, Status, RequestedBy, Notes) VALUES (?, ?, ?, ?, ?, ?)", [
                (stable_uuid("invoice-action-1"), stable_uuid("invoice-1"), "Send reminder", "Completed", "Billing Ops", "Reminder email sent"),
                (stable_uuid("invoice-action-2"), stable_uuid("invoice-2"), "Open dispute", "Open", "Billing Ops", "Charge dispute under investigation")
            ])
        if not table_has_rows("billingops.Adjustments"):
            cur.executemany("INSERT INTO billingops.Adjustments (AdjustmentId, InvoiceId, AdjustmentNumber, AdjustmentType, Amount, Status, Reason, CreatedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
                (stable_uuid("adjustment-1"), stable_uuid("invoice-2"), "ADJ-1001", "Credit", -450, "Pending", "Provisioning delay credit", "Billing Ops"),
                (stable_uuid("adjustment-2"), stable_uuid("invoice-1"), "ADJ-1002", "Charge", 180, "Applied", "Usage true-up", "Billing Ops")
            ])
        conn.commit()
    finally:
        conn.close()


@ops_router.get("/bootstrap")
def ops_bootstrap() -> dict[str, Any]:
    if smoke_data.smoke_mode_enabled():
        return smoke_data.ops_bootstrap()
    ensure_ops_storage()
    return {"orders": fetch_all("SELECT * FROM ops.Orders WHERE IsDeleted = 0 ORDER BY CreatedAtUtc DESC"), "networkEvents": fetch_all("SELECT * FROM ops.NetworkEvents ORDER BY CreatedAtUtc DESC"), "provisioningJobs": fetch_all("SELECT * FROM ops.ProvisioningJobs ORDER BY CreatedAtUtc DESC"), "settlements": fetch_all("SELECT * FROM ops.Settlements ORDER BY CreatedAtUtc DESC")}


@ops_router.get("/orders")
def list_orders():
    if smoke_data.smoke_mode_enabled():
        return smoke_data.ORDERS
    ensure_ops_storage()
    return fetch_all("SELECT * FROM ops.Orders WHERE IsDeleted = 0 ORDER BY CreatedAtUtc DESC")


@ops_router.get("/network-events")
def list_network_events():
    if smoke_data.smoke_mode_enabled():
        return smoke_data.NETWORK_EVENTS
    ensure_ops_storage()
    return fetch_all("SELECT * FROM ops.NetworkEvents ORDER BY CreatedAtUtc DESC")


@ops_router.get("/provisioning-jobs")
def list_provisioning_jobs():
    if smoke_data.smoke_mode_enabled():
        return smoke_data.PROVISIONING_JOBS
    ensure_ops_storage()
    return fetch_all("SELECT * FROM ops.ProvisioningJobs ORDER BY CreatedAtUtc DESC")


@ops_router.get("/carrier-settlement")
def list_settlements():
    if smoke_data.smoke_mode_enabled():
        return smoke_data.SETTLEMENTS
    ensure_ops_storage()
    return fetch_all("SELECT * FROM ops.Settlements ORDER BY CreatedAtUtc DESC")


@admin_router.get("/users")
def list_users():
    ensure_ops_storage()
    return fetch_all("SELECT * FROM admin.Users ORDER BY UserName")


@admin_router.get("/roles")
def list_roles():
    ensure_ops_storage()
    return fetch_all("SELECT * FROM admin.Roles ORDER BY RoleName")


@admin_router.get("/integrations")
def list_integrations():
    ensure_ops_storage()
    return fetch_all("SELECT * FROM admin.Integrations ORDER BY IntegrationName")


@billing_workflow_router.get("/invoices")
def list_invoices():
    if smoke_data.smoke_mode_enabled():
        return smoke_data.INVOICES
    ensure_ops_storage()
    return fetch_all("SELECT * FROM billingops.Invoices ORDER BY InvoiceDate DESC")


@billing_workflow_router.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: uuid.UUID):
    if smoke_data.smoke_mode_enabled():
        for invoice in smoke_data.INVOICES:
            if invoice["InvoiceId"] == str(invoice_id):
                return invoice
        raise HTTPException(status_code=404, detail="Invoice not found.")
    ensure_ops_storage()
    row = fetch_one("SELECT TOP 1 * FROM billingops.Invoices WHERE InvoiceId = ?", (str(invoice_id),))
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    return row


@billing_workflow_router.get("/invoices/{invoice_id}/actions")
def invoice_actions(invoice_id: uuid.UUID):
    if smoke_data.smoke_mode_enabled():
        return [{"InvoiceActionId": "action-1", "InvoiceId": str(invoice_id), "ActionType": "Review", "Status": "Open", "RequestedBy": "Billing Ops", "Notes": "Smoke action"}]
    ensure_ops_storage()
    return fetch_all("SELECT * FROM billingops.InvoiceActions WHERE InvoiceId = ? ORDER BY CreatedAtUtc DESC", (str(invoice_id),))


@billing_workflow_router.get("/adjustments")
def list_adjustments():
    if smoke_data.smoke_mode_enabled():
        return smoke_data.ADJUSTMENTS
    ensure_ops_storage()
    return fetch_all("SELECT * FROM billingops.Adjustments ORDER BY CreatedAtUtc DESC")
