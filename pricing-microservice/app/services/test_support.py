from __future__ import annotations

import os
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.services.ops import ensure_ops_storage
from app.services.sales import ensure_sales_storage, invalidate_bootstrap_cache, trim
from app.services.sql_access import sql_transaction


router = APIRouter(prefix="/api/test-support", tags=["test-support"])
TEST_SUPPORT_ENABLED = os.getenv("ENABLE_TEST_SUPPORT_API", "true").lower() in {"1", "true", "yes"}


def _require_test_support() -> None:
    if not TEST_SUPPORT_ENABLED:
        raise HTTPException(status_code=404, detail="Test support API is disabled.")


def _stable_uuid(value: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"fc-gpt-phase10:{value}"))


def _namespace_values(namespace: str) -> dict[str, str]:
    clean = trim(namespace) or "default"
    return {
        "namespace": clean,
        "customer_number": f"E2E-{clean.upper()[:24]}",
        "account_name": f"Phase10 {clean}",
        "lead_id": _stable_uuid(f"{clean}:lead"),
        "account_id": _stable_uuid(f"{clean}:account"),
        "opportunity_id": _stable_uuid(f"{clean}:opportunity"),
        "quote_id": _stable_uuid(f"{clean}:quote"),
        "approval_id": _stable_uuid(f"{clean}:approval"),
        "order_id": _stable_uuid(f"{clean}:order"),
        "invoice_id": _stable_uuid(f"{clean}:invoice"),
        "user_number": f"USR-{clean.upper()[:12]}",
        "role_number": f"ROLE-{clean.upper()[:12]}",
        "integration_number": f"INT-{clean.upper()[:12]}",
    }


@router.post("/namespaces/{namespace}/workflow-seed")
def seed_workflow_namespace(namespace: str) -> dict[str, Any]:
    _require_test_support()
    ensure_sales_storage()
    ensure_ops_storage()
    values = _namespace_values(namespace)

    with sql_transaction() as conn:
        cur = conn.cursor()

        # Remove deterministic rows so the seed operation is idempotent.
        cur.execute("DELETE FROM ms.Approvals WHERE ApprovalId = ?", (values["approval_id"],))
        cur.execute("DELETE FROM ms.QuoteLineItems WHERE QuoteId = ?", (values["quote_id"],))
        cur.execute("DELETE FROM ms.Quotes WHERE QuoteId = ?", (values["quote_id"],))
        cur.execute("DELETE FROM ms.OpportunityNotes WHERE OpportunityId = ?", (values["opportunity_id"],))
        cur.execute("DELETE FROM ms.OpportunityProducts WHERE OpportunityId = ?", (values["opportunity_id"],))
        cur.execute("DELETE FROM ms.Opportunities WHERE OpportunityId = ?", (values["opportunity_id"],))
        cur.execute("DELETE FROM ms.Accounts WHERE AccountId = ?", (values["account_id"],))
        cur.execute("DELETE FROM ms.LeadActivities WHERE LeadId = ?", (values["lead_id"],))
        cur.execute("DELETE FROM ms.Leads WHERE LeadId = ?", (values["lead_id"],))
        cur.execute("DELETE FROM billingops.InvoiceActions WHERE InvoiceId = ?", (values["invoice_id"],))
        cur.execute("DELETE FROM billingops.Adjustments WHERE InvoiceId = ?", (values["invoice_id"],))
        cur.execute("DELETE FROM billingops.Invoices WHERE InvoiceId = ?", (values["invoice_id"],))
        cur.execute("DELETE FROM ops.ProvisioningJobs WHERE OrderId = ?", (values["order_id"],))
        cur.execute("DELETE FROM ops.Orders WHERE OrderId = ?", (values["order_id"],))

        cur.execute(
            """
            INSERT INTO ms.Leads
            (LeadId, LeadNumber, CustomerNumber, AccountName, ContactName, Source, Qualification, Status, EstimatedValue, OwnerName, ProductInterest, ServiceNeedsJson, CustomerInfoJson, Notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                values["lead_id"],
                f"LEAD-{values['namespace'][:8].upper()}",
                values["customer_number"],
                values["account_name"],
                "Phase 10 Contact",
                "Test Support",
                "Open",
                "Open",
                25000,
                "Admin",
                "Fiber 1G",
                '["Fiber 1G","Managed Router"]',
                '{"region":"Midwest","supportTier":"Gold"}',
                f"Workflow namespace {values['namespace']}",
            ),
        )
        cur.execute(
            """
            INSERT INTO ms.Accounts
            (AccountId, AccountNumber, CustomerNumber, AccountName, Segment, Region, Status, OwnerName, Mrr, CustomerInfoJson)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                values["account_id"],
                f"ACCT-{values['namespace'][:8].upper()}",
                values["customer_number"],
                values["account_name"],
                "Enterprise",
                "Midwest",
                "Active",
                "Admin",
                12000,
                '{"customerType":"Enterprise"}',
            ),
        )
        cur.execute(
            """
            INSERT INTO ms.Opportunities
            (OpportunityId, OpportunityNumber, LeadId, AccountId, OpportunityName, Stage, Status, OwnerName, CloseDate, EstimatedValue, MarginPct, LocationCount, ProductSummary, ServiceSummary, ApprovalStatus, ConvertedFromLeadId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                values["opportunity_id"],
                f"OPP-{values['namespace'][:8].upper()}",
                values["lead_id"],
                values["account_id"],
                f"{values['account_name']} expansion",
                "Discovery",
                "Open",
                "Admin",
                None,
                36000,
                32,
                2,
                "Fiber 1G",
                "Primary site and backup access",
                "Pending",
                values["lead_id"],
            ),
        )
        cur.execute(
            """
            INSERT INTO ms.Quotes
            (QuoteId, QuoteNumber, OpportunityId, Status, VersionNo, TotalMrc, TotalNrc, MarginPct, DiscountPct, ManualAdjustmentPct, ApprovalStatus)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                values["quote_id"],
                f"Q-{values['namespace'][:8].upper()}",
                values["opportunity_id"],
                "Submitted",
                1,
                2400,
                500,
                32,
                0,
                0,
                "Pending",
            ),
        )
        cur.execute(
            """
            INSERT INTO ms.QuoteLineItems
            (QuoteLineItemId, QuoteId, ProductName, LineType, Quantity, Mrc, Nrc, Cost, MarginPct, DiscountPct, BillingCode, Notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                _stable_uuid(f"{namespace}:quote-line-1"),
                values["quote_id"],
                "Fiber 1G",
                "Recurring",
                1,
                2400,
                500,
                1400,
                32,
                0,
                "MRC-FIBER",
                "Phase 10 workflow seed",
            ),
        )
        cur.execute(
            """
            INSERT INTO ms.Approvals
            (ApprovalId, EntityType, EntityId, ApprovalType, StepName, Status, RequestedBy)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                values["approval_id"],
                "quote",
                values["quote_id"],
                "Pricing",
                "Review",
                "Pending",
                "Admin",
            ),
        )
        cur.execute(
            """
            INSERT INTO ops.Orders
            (OrderId, OrderNumber, CustomerNumber, AccountName, ServiceName, LifecycleStage, OverallStatus, SlaStatus, DueDate, AssignedTeam, CircuitId, Location)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                values["order_id"],
                f"ORD-{values['namespace'][:8].upper()}",
                values["customer_number"],
                values["account_name"],
                "Fiber 1G",
                "Design",
                "Draft",
                "On Track",
                None,
                "Provisioning Ops",
                f"CKT-{values['namespace'][:8].upper()}",
                "Primary site",
            ),
        )
        cur.execute(
            """
            INSERT INTO billingops.Invoices
            (InvoiceId, InvoiceNumber, CustomerNumber, AccountName, Amount, Balance, Status, InvoiceDate, DueDate, BillingProfile)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                values["invoice_id"],
                f"INV-{values['namespace'][:8].upper()}",
                values["customer_number"],
                values["account_name"],
                2400,
                2400,
                "Open",
                None,
                None,
                "Net 30",
            ),
        )

    invalidate_bootstrap_cache()
    return {
        "namespace": values["namespace"],
        "customerNumber": values["customer_number"],
        "leadId": values["lead_id"],
        "opportunityId": values["opportunity_id"],
        "quoteId": values["quote_id"],
        "approvalId": values["approval_id"],
        "orderId": values["order_id"],
        "invoiceId": values["invoice_id"],
        "userNumber": values["user_number"],
        "roleNumber": values["role_number"],
        "integrationNumber": values["integration_number"],
    }


@router.delete("/namespaces/{namespace}")
def cleanup_workflow_namespace(namespace: str) -> dict[str, Any]:
    _require_test_support()
    ensure_sales_storage()
    ensure_ops_storage()
    values = _namespace_values(namespace)

    with sql_transaction() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM ms.ContractHistory WHERE ContractId IN (SELECT ContractId FROM ms.Contracts WHERE QuoteId = ?)", (values["quote_id"],))
        cur.execute("DELETE FROM ms.ContractFiles WHERE ContractId IN (SELECT ContractId FROM ms.Contracts WHERE QuoteId = ?)", (values["quote_id"],))
        cur.execute("DELETE FROM ms.Contracts WHERE QuoteId = ?", (values["quote_id"],))
        cur.execute("DELETE FROM ms.Approvals WHERE EntityId = ? OR ApprovalId = ?", (values["quote_id"], values["approval_id"]))
        cur.execute("DELETE FROM ms.QuoteLineItems WHERE QuoteId IN (SELECT QuoteId FROM ms.Quotes WHERE OpportunityId = ?)", (values["opportunity_id"],))
        cur.execute("DELETE FROM ms.PricingResults WHERE QuoteId IN (SELECT QuoteId FROM ms.Quotes WHERE OpportunityId = ?)", (values["opportunity_id"],))
        cur.execute("DELETE FROM ms.PricingInputs WHERE QuoteId IN (SELECT QuoteId FROM ms.Quotes WHERE OpportunityId = ?)", (values["opportunity_id"],))
        cur.execute("DELETE FROM ms.Quotes WHERE OpportunityId = ?", (values["opportunity_id"],))
        cur.execute("DELETE FROM ms.OpportunityProducts WHERE OpportunityId = ?", (values["opportunity_id"],))
        cur.execute("DELETE FROM ms.OpportunityNotes WHERE OpportunityId = ?", (values["opportunity_id"],))
        cur.execute("DELETE FROM ms.Opportunities WHERE OpportunityId = ? OR ConvertedFromLeadId = ?", (values["opportunity_id"], values["lead_id"]))
        cur.execute("DELETE FROM ms.Accounts WHERE AccountId = ? OR CustomerNumber = ?", (values["account_id"], values["customer_number"]))
        cur.execute("DELETE FROM ms.LeadActivities WHERE LeadId = ?", (values["lead_id"],))
        cur.execute("DELETE FROM ms.Leads WHERE LeadId = ?", (values["lead_id"],))
        cur.execute("DELETE FROM billingops.InvoiceActions WHERE InvoiceId = ?", (values["invoice_id"],))
        cur.execute("DELETE FROM billingops.Adjustments WHERE InvoiceId = ?", (values["invoice_id"],))
        cur.execute("DELETE FROM billingops.Invoices WHERE InvoiceId = ? OR CustomerNumber = ?", (values["invoice_id"], values["customer_number"]))
        cur.execute("DELETE FROM admin.Users WHERE UserNumber = ?", (values["user_number"],))
        cur.execute("DELETE FROM admin.Roles WHERE RoleNumber = ?", (values["role_number"],))
        cur.execute("DELETE FROM admin.Integrations WHERE IntegrationNumber = ?", (values["integration_number"],))
        cur.execute("DELETE FROM ops.ProvisioningJobs WHERE OrderId = ?", (values["order_id"],))
        cur.execute("DELETE FROM ops.Orders WHERE OrderId = ? OR CustomerNumber = ?", (values["order_id"], values["customer_number"]))

    invalidate_bootstrap_cache()
    return {"namespace": values["namespace"], "cleaned": True}
