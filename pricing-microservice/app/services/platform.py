from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

from app.services.sales import ensure_sales_storage, fetch_all, fetch_one
from app.services import smoke_data

router = APIRouter(prefix="/api/platform", tags=["platform"])

DEFAULT_USERS = [
    {"id": "USR-1001", "name": "Rhea Patel", "role": "Sales Operations", "status": "Active", "lastLogin": "2026-05-14T08:45:00Z"},
    {"id": "USR-1002", "name": "Cal Brooks", "role": "Billing Ops", "status": "Active", "lastLogin": "2026-05-14T09:10:00Z"},
    {"id": "USR-1003", "name": "Maya Ortiz", "role": "Network Ops", "status": "Locked", "lastLogin": "2026-05-12T17:05:00Z"},
]

DEFAULT_ROLES = [
    {"id": "ROLE-1", "name": "Sales Manager", "permissions": ["opportunities", "quotes", "approvals"], "status": "Active"},
    {"id": "ROLE-2", "name": "Billing Analyst", "permissions": ["invoices", "payments", "adjustments"], "status": "Active"},
    {"id": "ROLE-3", "name": "Provisioning Lead", "permissions": ["orders", "tasks", "escalations"], "status": "Review"},
]

DEFAULT_INTEGRATIONS = [
    {"id": "INT-1", "name": "CRM Sync", "status": "Connected", "owner": "Platform", "detail": "Customer and account sync"},
    {"id": "INT-2", "name": "Billing Engine", "status": "Connected", "owner": "Finance", "detail": "Ledger and invoice posting"},
    {"id": "INT-3", "name": "Provisioning API", "status": "Pending", "owner": "Network", "detail": "Activation and circuit mapping"},
]

REPORT_DEFINITIONS = [
    {"id": "executive-scorecard", "name": "Executive scorecard", "area": "Executive", "description": "Pipeline, quoted value, approvals, and contract coverage."},
    {"id": "pricing-approval-queue", "name": "Pricing approval queue", "area": "Pricing", "description": "Quotes and custom pricing requests waiting on review."},
    {"id": "customer-revenue", "name": "Customer revenue watchlist", "area": "Billing", "description": "Customer MRR and account exposure across active accounts."},
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sales_dashboard() -> dict[str, Any]:
    if smoke_data.smoke_mode_enabled():
        return smoke_data.sales_dashboard()
    ensure_sales_storage()
    row = fetch_one("SELECT TOP 1 * FROM ms.vSalesModuleDashboard")
    return row or {
        "LeadCount": 0,
        "OpportunityCount": 0,
        "QuoteCount": 0,
        "PendingApprovalCount": 0,
        "ContractCount": 0,
        "PipelineValue": 0,
        "QuoteMrcValue": 0,
    }


def approvals() -> list[dict[str, Any]]:
    ensure_sales_storage()
    return fetch_all("SELECT * FROM ms.Approvals ORDER BY CreatedAtUtc DESC")


def customer_summary_rows() -> list[dict[str, Any]]:
    ensure_sales_storage()
    return fetch_all(
        """
        SELECT c.CustomerNumber, c.CustomerName, c.CustomerType, c.Industry, c.Region, c.CountryCode,
               c.Status, c.CreditRating, c.Mrr, cp.Segment, cp.SupportTier, cp.AccountManager, cp.Notes
        FROM billing.Customers c
        LEFT JOIN billing.CustomerProfiles cp ON cp.CustomerNumber = c.CustomerNumber AND cp.IsDeleted = 0
        WHERE c.IsDeleted = 0
        ORDER BY c.CustomerName
        """
    )


def report_rows(report_id: str) -> list[dict[str, Any]]:
    ensure_sales_storage()
    if report_id == "pricing-approval-queue":
        rows = fetch_all(
            """
            SELECT q.QuoteNumber AS account, od.AccountRegion AS region, od.AccountSegment AS segment,
                   od.OpportunityName AS service, COALESCE(q.TotalMrc, 0) + COALESCE(q.TotalNrc, 0) AS amount,
                   q.MarginPct AS metric, q.ApprovalStatus AS status
            FROM ms.vQuoteDetail q
            LEFT JOIN ms.vOpportunityDetail od ON od.OpportunityId = q.OpportunityId
            ORDER BY q.CreatedAtUtc DESC
            """
        )
    elif report_id == "customer-revenue":
        rows = fetch_all(
            """
            SELECT c.CustomerName AS account, c.Region AS region, cp.Segment AS segment,
                   c.CustomerType AS service, c.Mrr AS amount, c.CreditRating AS metric, c.Status AS status
            FROM billing.Customers c
            LEFT JOIN billing.CustomerProfiles cp ON cp.CustomerNumber = c.CustomerNumber AND cp.IsDeleted = 0
            WHERE c.IsDeleted = 0
            ORDER BY c.Mrr DESC, c.CustomerName
            """
        )
    else:
        rows = fetch_all(
            """
            SELECT od.AccountNameResolved AS account, od.AccountRegion AS region, od.AccountSegment AS segment,
                   od.OpportunityName AS service, od.EstimatedValue AS amount, od.MarginPct AS metric, od.Status AS status
            FROM ms.vOpportunityDetail od
            ORDER BY od.EstimatedValue DESC, od.CreatedAtUtc DESC
            """
        )
    for row in rows:
        row["reportId"] = report_id
    return rows


@router.get("/bootstrap")
def platform_bootstrap() -> dict[str, Any]:
    if smoke_data.smoke_mode_enabled():
        return smoke_data.platform_bootstrap()
    ensure_sales_storage()
    return {
        "generatedAtUtc": utc_now_iso(),
        "dashboard": sales_dashboard(),
        "customers": customer_summary_rows(),
        "accounts": fetch_all("SELECT TOP 25 * FROM ms.Accounts WHERE IsDeleted = 0 ORDER BY CreatedAtUtc DESC"),
        "leads": fetch_all("SELECT TOP 25 * FROM ms.vLeadDetail ORDER BY CreatedAtUtc DESC"),
        "opportunities": fetch_all("SELECT TOP 25 * FROM ms.vOpportunityDetail ORDER BY CreatedAtUtc DESC"),
        "quotes": fetch_all("SELECT TOP 25 * FROM ms.vQuoteDetail ORDER BY CreatedAtUtc DESC"),
        "contracts": fetch_all("SELECT TOP 25 * FROM ms.Contracts WHERE IsDeleted = 0 ORDER BY CreatedAtUtc DESC"),
        "products": fetch_all("SELECT TOP 25 * FROM billing.Products WHERE IsDeleted = 0 ORDER BY ProductName"),
        "billingCodes": fetch_all("SELECT TOP 50 * FROM billing.BillingCodes WHERE IsDeleted = 0 ORDER BY Code"),
        "offers": fetch_all("SELECT TOP 25 * FROM billing.Offers WHERE IsDeleted = 0 ORDER BY OfferName"),
        "promotions": fetch_all("SELECT TOP 25 * FROM billing.Promotions WHERE IsDeleted = 0 ORDER BY PromotionName"),
        "ratePlans": fetch_all("SELECT TOP 25 * FROM billing.RatePlans WHERE IsDeleted = 0 ORDER BY PlanName"),
        "approvals": approvals(),
        "reportDefinitions": REPORT_DEFINITIONS,
        "users": DEFAULT_USERS,
        "roles": DEFAULT_ROLES,
        "integrations": DEFAULT_INTEGRATIONS,
    }


@router.get("/reports/definitions")
def platform_report_definitions() -> list[dict[str, Any]]:
    return REPORT_DEFINITIONS


@router.get("/reports/{report_id}")
def platform_report(report_id: str) -> dict[str, Any]:
    matching = next((item for item in REPORT_DEFINITIONS if item["id"] == report_id), None)
    if not matching:
        raise HTTPException(status_code=404, detail="Report definition not found.")
    rows = report_rows(report_id)
    return {
        "definition": matching,
        "generatedAtUtc": utc_now_iso(),
        "rowCount": len(rows),
        "totalAmount": sum(float(item.get("amount") or 0) for item in rows),
        "rows": rows,
    }


@router.get("/administration/summary")
def administration_summary() -> dict[str, Any]:
    dashboard = sales_dashboard()
    return {
        "generatedAtUtc": utc_now_iso(),
        "users": DEFAULT_USERS,
        "roles": DEFAULT_ROLES,
        "integrations": DEFAULT_INTEGRATIONS,
        "platform": {
            "serviceName": os.getenv("PLATFORM_API_SERVICE_NAME", "BDWUS Platform API"),
            "environment": os.getenv("PLATFORM_ENVIRONMENT", "development"),
            "assistantModel": os.getenv("AZURE_AI_FOUNDRY_DEPLOYMENT") or os.getenv("AZURE_OPENAI_DEPLOYMENT") or "gpt-5-nano",
        },
        "controls": {
            "pendingApprovals": dashboard.get("PendingApprovalCount", 0),
            "openQuotes": dashboard.get("QuoteCount", 0),
            "openOpportunities": dashboard.get("OpportunityCount", 0),
        },
    }


@router.get("/customer-360/{customer_number}")
def customer_360(customer_number: str) -> dict[str, Any]:
    if smoke_data.smoke_mode_enabled():
        customer = next((item for item in smoke_data.CUSTOMERS if item["CustomerNumber"] == customer_number), None)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found.")
        return {
            "generatedAtUtc": smoke_data.utc_now_iso(),
            "customer": customer,
            "accounts": smoke_data.sales_bootstrap()["accounts"],
            "serviceLocations": [{"ServiceLocationId": "loc-1", "LocationName": "HQ", "City": "Chicago", "StateProvince": "IL", "ServiceabilityType": "On-net", "Status": "Active"}],
            "opportunities": smoke_data.sales_bootstrap()["opportunities"],
            "quotes": smoke_data.sales_bootstrap()["quotes"],
            "contracts": [],
        }
    ensure_sales_storage()
    customer = fetch_one(
        """
        SELECT c.CustomerNumber, c.CustomerName, c.CustomerType, c.Industry, c.Region, c.CountryCode, c.Status,
               c.CreditRating, c.BillingProfile, c.PrimaryContact, c.Mrr,
               cp.Segment, cp.SupportTier, cp.AccountManager, cp.Notes, cp.ProfileJson
        FROM billing.Customers c
        LEFT JOIN billing.CustomerProfiles cp ON cp.CustomerNumber = c.CustomerNumber AND cp.IsDeleted = 0
        WHERE c.CustomerNumber = ? AND c.IsDeleted = 0
        """,
        (customer_number,),
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return {
        "generatedAtUtc": utc_now_iso(),
        "customer": customer,
        "accounts": fetch_all("SELECT * FROM ms.Accounts WHERE CustomerNumber = ? AND IsDeleted = 0 ORDER BY CreatedAtUtc DESC", (customer_number,)),
        "serviceLocations": fetch_all("SELECT * FROM billing.ServiceLocations WHERE CustomerNumber = ? AND IsDeleted = 0 ORDER BY CreatedAtUtc DESC", (customer_number,)),
        "opportunities": fetch_all(
            """
            SELECT od.* FROM ms.vOpportunityDetail od
            LEFT JOIN ms.Accounts a ON a.AccountId = od.AccountId
            WHERE a.CustomerNumber = ? ORDER BY od.CreatedAtUtc DESC
            """,
            (customer_number,),
        ),
        "quotes": fetch_all(
            """
            SELECT q.* FROM ms.vQuoteDetail q
            LEFT JOIN ms.vOpportunityDetail od ON od.OpportunityId = q.OpportunityId
            LEFT JOIN ms.Accounts a ON a.AccountId = od.AccountId
            WHERE a.CustomerNumber = ? ORDER BY q.CreatedAtUtc DESC
            """,
            (customer_number,),
        ),
        "contracts": fetch_all(
            """
            SELECT c.* FROM ms.Contracts c
            LEFT JOIN ms.Opportunities o ON o.OpportunityId = c.OpportunityId
            LEFT JOIN ms.Accounts a ON a.AccountId = o.AccountId
            WHERE a.CustomerNumber = ? AND c.IsDeleted = 0 ORDER BY c.CreatedAtUtc DESC
            """,
            (customer_number,),
        ),
    }


@router.get("/product-pricing/overview")
def product_pricing_overview() -> dict[str, Any]:
    if smoke_data.smoke_mode_enabled():
        return {
            "generatedAtUtc": smoke_data.utc_now_iso(),
            "products": smoke_data.PRODUCTS,
            "services": [{"ServiceId": "svc-1", "ServiceName": "Fiber", "Status": "Active"}],
            "hierarchy": smoke_data.sales_bootstrap()["billingProductHierarchy"],
            "billingCodes": smoke_data.BILLING_CODES,
            "offers": smoke_data.OFFERS,
            "promotions": smoke_data.PROMOTIONS,
            "ratePlans": smoke_data.RATE_PLANS,
            "summary": {
                "productCount": len(smoke_data.PRODUCTS),
                "serviceCount": 1,
                "billingCodeCount": len(smoke_data.BILLING_CODES),
                "offerCount": len(smoke_data.OFFERS),
                "promotionCount": len(smoke_data.PROMOTIONS),
                "ratePlanCount": len(smoke_data.RATE_PLANS),
            },
        }
    ensure_sales_storage()
    products = fetch_all("SELECT * FROM billing.Products WHERE IsDeleted = 0 ORDER BY ProductName")
    services = fetch_all("SELECT * FROM billing.Services WHERE IsDeleted = 0 ORDER BY ServiceName")
    hierarchy = fetch_all("SELECT * FROM billing.vProductBillingHierarchy ORDER BY DisplayOrder, ProductName")
    billing_codes = fetch_all("SELECT * FROM billing.BillingCodes WHERE IsDeleted = 0 ORDER BY Code")
    offers = fetch_all("SELECT * FROM billing.Offers WHERE IsDeleted = 0 ORDER BY OfferName")
    promotions = fetch_all("SELECT * FROM billing.Promotions WHERE IsDeleted = 0 ORDER BY PromotionName")
    rate_plans = fetch_all("SELECT * FROM billing.RatePlans WHERE IsDeleted = 0 ORDER BY PlanName")
    return {
        "generatedAtUtc": utc_now_iso(),
        "products": products,
        "services": services,
        "hierarchy": hierarchy,
        "billingCodes": billing_codes,
        "offers": offers,
        "promotions": promotions,
        "ratePlans": rate_plans,
        "summary": {
            "productCount": len(products),
            "serviceCount": len(services),
            "billingCodeCount": len(billing_codes),
            "offerCount": len(offers),
            "promotionCount": len(promotions),
            "ratePlanCount": len(rate_plans),
        },
    }
