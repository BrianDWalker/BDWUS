from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter

from app.services.ops import ensure_ops_storage, execute, fetch_one, require_row, utc_now, jdump

ops_write_router = APIRouter(prefix="/api/ops", tags=["ops-write"])
admin_write_router = APIRouter(prefix="/api/admin", tags=["admin-write"])
billing_write_router = APIRouter(prefix="/api/billing-workflows", tags=["billing-write"])


@ops_write_router.post("/orders")
def create_order(payload: dict[str, Any]):
    ensure_ops_storage()
    order_id = str(uuid.uuid4())
    execute(
        "INSERT INTO ops.Orders (OrderId, OrderNumber, CustomerNumber, AccountName, ServiceName, LifecycleStage, OverallStatus, SlaStatus, DueDate, AssignedTeam, CircuitId, Location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            order_id,
            payload.get("orderNumber") or f"ORD-{order_id[:4].upper()}",
            payload.get("customerNumber"),
            payload.get("accountName") or "New Account",
            payload.get("serviceName") or "Service",
            payload.get("lifecycleStage") or "Design",
            payload.get("overallStatus") or "Draft",
            payload.get("slaStatus") or "On Track",
            payload.get("dueDate"),
            payload.get("assignedTeam") or "Ops",
            payload.get("circuitId") or f"CKT-{order_id[:4].upper()}",
            payload.get("location") or "Primary site",
        ),
    )
    return require_row("SELECT TOP 1 * FROM ops.Orders WHERE OrderId = ?", (order_id,))


@ops_write_router.put("/orders/{order_id}")
def update_order(order_id: uuid.UUID, payload: dict[str, Any]):
    ensure_ops_storage()
    current = require_row("SELECT TOP 1 * FROM ops.Orders WHERE OrderId = ? AND IsDeleted = 0", (str(order_id),))
    execute(
        "UPDATE ops.Orders SET LifecycleStage = ?, OverallStatus = ?, SlaStatus = ?, DueDate = ?, AssignedTeam = ?, CircuitId = ?, Location = ? WHERE OrderId = ?",
        (
            payload.get("lifecycleStage", current.get("LifecycleStage")),
            payload.get("overallStatus", current.get("OverallStatus")),
            payload.get("slaStatus", current.get("SlaStatus")),
            payload.get("dueDate", current.get("DueDate")),
            payload.get("assignedTeam", current.get("AssignedTeam")),
            payload.get("circuitId", current.get("CircuitId")),
            payload.get("location", current.get("Location")),
            str(order_id),
        ),
    )
    return require_row("SELECT TOP 1 * FROM ops.Orders WHERE OrderId = ?", (str(order_id),))


@ops_write_router.post("/provisioning-jobs")
def create_provisioning_job(payload: dict[str, Any]):
    ensure_ops_storage()
    job_id = str(uuid.uuid4())
    execute(
        "INSERT INTO ops.ProvisioningJobs (ProvisioningJobId, OrderId, JobNumber, JobType, OwnerName, Status, DueDate) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            job_id,
            payload.get("orderId"),
            payload.get("jobNumber") or f"JOB-{job_id[:4].upper()}",
            payload.get("jobType") or "Task",
            payload.get("ownerName") or "Ops",
            payload.get("status") or "Queued",
            payload.get("dueDate"),
        ),
    )
    return require_row("SELECT TOP 1 * FROM ops.ProvisioningJobs WHERE ProvisioningJobId = ?", (job_id,))


@ops_write_router.put("/provisioning-jobs/{job_id}")
def update_provisioning_job(job_id: uuid.UUID, payload: dict[str, Any]):
    ensure_ops_storage()
    current = require_row("SELECT TOP 1 * FROM ops.ProvisioningJobs WHERE ProvisioningJobId = ?", (str(job_id),))
    execute(
        "UPDATE ops.ProvisioningJobs SET OwnerName = ?, Status = ?, DueDate = ? WHERE ProvisioningJobId = ?",
        (
            payload.get("ownerName", current.get("OwnerName")),
            payload.get("status", current.get("Status")),
            payload.get("dueDate", current.get("DueDate")),
            str(job_id),
        ),
    )
    return require_row("SELECT TOP 1 * FROM ops.ProvisioningJobs WHERE ProvisioningJobId = ?", (str(job_id),))


@ops_write_router.post("/network-events")
def create_network_event(payload: dict[str, Any]):
    ensure_ops_storage()
    event_id = str(uuid.uuid4())
    execute(
        "INSERT INTO ops.NetworkEvents (EventId, EventNumber, Market, Type, Impacted, Severity, SlaExposure, Status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            payload.get("eventNumber") or f"NE-{event_id[:4].upper()}",
            payload.get("market") or "Unknown",
            payload.get("type") or "Event",
            payload.get("impacted") or "Unknown",
            payload.get("severity") or "Major",
            payload.get("slaExposure") or 0,
            payload.get("status") or "Open",
        ),
    )
    return require_row("SELECT TOP 1 * FROM ops.NetworkEvents WHERE EventId = ?", (event_id,))


@ops_write_router.post("/carrier-settlement")
def create_settlement(payload: dict[str, Any]):
    ensure_ops_storage()
    settlement_id = str(uuid.uuid4())
    execute(
        "INSERT INTO ops.Settlements (SettlementId, SettlementNumber, PartnerName, BillingPeriod, ExposureAmount, Status, ClaimType) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            settlement_id,
            payload.get("settlementNumber") or f"SET-{settlement_id[:4].upper()}",
            payload.get("partnerName") or "Partner",
            payload.get("billingPeriod") or "Current",
            payload.get("exposureAmount") or 0,
            payload.get("status") or "Open",
            payload.get("claimType") or "Review",
        ),
    )
    return require_row("SELECT TOP 1 * FROM ops.Settlements WHERE SettlementId = ?", (settlement_id,))


@admin_write_router.post("/users")
def create_user(payload: dict[str, Any]):
    ensure_ops_storage()
    user_id = str(uuid.uuid4())
    execute(
        "INSERT INTO admin.Users (UserId, UserNumber, UserName, Email, RoleName, Status, LastLoginAtUtc) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            user_id,
            payload.get("userNumber") or f"USR-{user_id[:4].upper()}",
            payload.get("userName") or "New User",
            payload.get("email"),
            payload.get("roleName") or "Operator",
            payload.get("status") or "Active",
            utc_now(),
        ),
    )
    return require_row("SELECT TOP 1 * FROM admin.Users WHERE UserId = ?", (user_id,))


@admin_write_router.post("/roles")
def create_role(payload: dict[str, Any]):
    ensure_ops_storage()
    role_id = str(uuid.uuid4())
    execute(
        "INSERT INTO admin.Roles (RoleId, RoleNumber, RoleName, PermissionsJson, Status) VALUES (?, ?, ?, ?, ?)",
        (
            role_id,
            payload.get("roleNumber") or f"ROLE-{role_id[:4].upper()}",
            payload.get("roleName") or "Role",
            jdump(payload.get("permissions") or []),
            payload.get("status") or "Active",
        ),
    )
    return require_row("SELECT TOP 1 * FROM admin.Roles WHERE RoleId = ?", (role_id,))


@admin_write_router.post("/integrations")
def create_integration(payload: dict[str, Any]):
    ensure_ops_storage()
    integration_id = str(uuid.uuid4())
    execute(
        "INSERT INTO admin.Integrations (IntegrationId, IntegrationNumber, IntegrationName, OwnerName, Status, Detail) VALUES (?, ?, ?, ?, ?, ?)",
        (
            integration_id,
            payload.get("integrationNumber") or f"INT-{integration_id[:4].upper()}",
            payload.get("integrationName") or "Integration",
            payload.get("ownerName") or "Platform",
            payload.get("status") or "Pending",
            payload.get("detail") or "",
        ),
    )
    return require_row("SELECT TOP 1 * FROM admin.Integrations WHERE IntegrationId = ?", (integration_id,))


@billing_write_router.post("/invoices/{invoice_id}/actions")
def create_invoice_action(invoice_id: uuid.UUID, payload: dict[str, Any]):
    ensure_ops_storage()
    action_id = str(uuid.uuid4())
    execute(
        "INSERT INTO billingops.InvoiceActions (InvoiceActionId, InvoiceId, ActionType, Status, RequestedBy, Notes) VALUES (?, ?, ?, ?, ?, ?)",
        (
            action_id,
            str(invoice_id),
            payload.get("actionType") or "Review",
            payload.get("status") or "Open",
            payload.get("requestedBy") or "Billing Ops",
            payload.get("notes") or "",
        ),
    )
    return require_row("SELECT TOP 1 * FROM billingops.InvoiceActions WHERE InvoiceActionId = ?", (action_id,))


@billing_write_router.post("/adjustments")
def create_adjustment(payload: dict[str, Any]):
    ensure_ops_storage()
    adjustment_id = str(uuid.uuid4())
    execute(
        "INSERT INTO billingops.Adjustments (AdjustmentId, InvoiceId, AdjustmentNumber, AdjustmentType, Amount, Status, Reason, CreatedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            adjustment_id,
            payload.get("invoiceId"),
            payload.get("adjustmentNumber") or f"ADJ-{adjustment_id[:4].upper()}",
            payload.get("adjustmentType") or "Credit",
            payload.get("amount") or 0,
            payload.get("status") or "Pending",
            payload.get("reason") or "",
            payload.get("createdBy") or "Billing Ops",
        ),
    )
    return require_row("SELECT TOP 1 * FROM billingops.Adjustments WHERE AdjustmentId = ?", (adjustment_id,))
