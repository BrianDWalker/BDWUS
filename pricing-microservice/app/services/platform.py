from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

from app.services.sales import ensure_sales_storage, sales_bootstrap as sales_module_bootstrap
from app.services import smoke_data
from app.services.sql_access import fetch_all, fetch_one

router = APIRouter(prefix="/api/platform", tags=["platform"])

REPORT_DEFINITION_SEEDS = [
    {"id": "executive-scorecard", "name": "Executive scorecard", "area": "Executive", "description": "Pipeline, quoted value, approvals, and contract coverage."},
    {"id": "pricing-approval-queue", "name": "Pricing approval queue", "area": "Pricing", "description": "Quotes and custom pricing requests waiting on review."},
    {"id": "customer-revenue", "name": "Customer revenue watchlist", "area": "Billing", "description": "Customer MRR and account exposure across active accounts."},
]
# Backward-compatible import surface for older smoke/contract tests. Production route handlers
# use report_definitions(), which reads report.vReportDefinitions from Azure SQL.
REPORT_DEFINITIONS = REPORT_DEFINITION_SEEDS


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


def report_definitions() -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT id, name, area, description, SortOrder, Status
        FROM report.vReportDefinitions
        ORDER BY SortOrder, name
        """
    )


def admin_users() -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT UserId, UserNumber, UserName, Email, RoleName, Status, LastLoginAtUtc, CreatedAtUtc, UpdatedAtUtc
        FROM admin.Users
        WHERE IsDeleted = 0
        ORDER BY UserName
        """
    )


def admin_roles() -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT RoleId, RoleNumber, RoleName, PermissionsJson, Status, CreatedAtUtc, UpdatedAtUtc
        FROM admin.Roles
        WHERE IsDeleted = 0
        ORDER BY RoleName
        """
    )


def admin_integrations() -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT IntegrationId, IntegrationNumber, IntegrationName, OwnerName, Status, Detail, CreatedAtUtc, UpdatedAtUtc
        FROM admin.Integrations
        WHERE IsDeleted = 0
        ORDER BY IntegrationName
        """
    )


def knowledge_topics() -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT
            TopicId AS id,
            TopicName AS name,
            TopicName AS label,
            Description AS description,
            SortOrder,
            Status AS status
        FROM knowledge.Topics
        WHERE IsDeleted = 0
        ORDER BY SortOrder, TopicName
        """
    )


def knowledge_documents() -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT
            d.DocumentId AS id,
            d.Title AS title,
            d.Category AS category,
            d.Audience AS audience,
            d.UpdatedDate AS updated,
            d.OwnerName AS owner,
            d.Summary AS summary,
            d.SourceUrl AS sourceUrl,
            d.Status AS status,
            STRING_AGG(t.TopicName, ', ') AS topics
        FROM knowledge.Documents d
        LEFT JOIN knowledge.DocumentTopics dt ON dt.DocumentId = d.DocumentId
        LEFT JOIN knowledge.Topics t ON t.TopicId = dt.TopicId AND t.IsDeleted = 0
        WHERE d.IsDeleted = 0
        GROUP BY d.DocumentId, d.Title, d.Category, d.Audience, d.UpdatedDate, d.OwnerName, d.Summary, d.SourceUrl, d.Status
        ORDER BY d.UpdatedDate DESC, d.Title
        """
    )
    for row in rows:
        tag_values = [row.get("category"), row.get("audience"), row.get("owner"), row.get("topics")]
        row["tags"] = [
            tag.strip()
            for value in tag_values
            for tag in str(value or "").split(",")
            if tag.strip()
        ]
    return rows


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
    sales_payload = sales_module_bootstrap()
    reports = report_definitions()
    users = admin_users()
    roles = admin_roles()
    integrations = admin_integrations()
    return {
        "generatedAtUtc": utc_now_iso(),
        "dashboard": sales_payload.get("dashboard", {}),
        "customers": sales_payload.get("billingCustomers", []),
        "accounts": sales_payload.get("accounts", [])[:25],
        "leads": sales_payload.get("leads", [])[:25],
        "opportunities": sales_payload.get("opportunities", [])[:25],
        "quotes": sales_payload.get("quotes", [])[:25],
        "contracts": sales_payload.get("contracts", [])[:25],
        "products": sales_payload.get("billingProducts", [])[:25],
        "billingCodes": sales_payload.get("billingCodes", [])[:50],
        "offers": sales_payload.get("offers", [])[:25],
        "promotions": sales_payload.get("promotions", [])[:25],
        "ratePlans": sales_payload.get("ratePlans", [])[:25],
        "approvals": sales_payload.get("approvals", []),
        "reportDefinitions": reports,
        "users": users,
        "roles": roles,
        "integrations": integrations,
    }


@router.get("/reports/definitions")
def platform_report_definitions() -> list[dict[str, Any]]:
    if smoke_data.smoke_mode_enabled():
        return smoke_data.platform_bootstrap().get("reportDefinitions", [])
    return report_definitions()


@router.get("/reports/{report_id}")
def platform_report(report_id: str) -> dict[str, Any]:
    if smoke_data.smoke_mode_enabled():
        definitions = smoke_data.platform_bootstrap().get("reportDefinitions", [])
    else:
        definitions = report_definitions()
    matching = next((item for item in definitions if item["id"] == report_id), None)
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
    if smoke_data.smoke_mode_enabled():
        payload = smoke_data.platform_bootstrap()
        dashboard = payload.get("dashboard", {})
        return {
            "generatedAtUtc": smoke_data.utc_now_iso(),
            "users": payload.get("users", []),
            "roles": payload.get("roles", []),
            "integrations": payload.get("integrations", []),
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
    dashboard = sales_dashboard()
    users = admin_users()
    roles = admin_roles()
    integrations = admin_integrations()
    return {
        "generatedAtUtc": utc_now_iso(),
        "users": users,
        "roles": roles,
        "integrations": integrations,
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


@router.get("/knowledge/bootstrap")
def knowledge_bootstrap() -> dict[str, Any]:
    if smoke_data.smoke_mode_enabled():
        return {
            "generatedAtUtc": smoke_data.utc_now_iso(),
            "documents": [],
            "topics": [],
            "summary": {
                "documentCount": 0,
                "topicCount": 0,
                "currentCount": 0,
                "reviewCount": 0,
            },
        }
    documents = knowledge_documents()
    topics = knowledge_topics()
    current_count = sum(1 for item in documents if item.get("status") in {"Current", "Approved", "Active"})
    review_count = sum(1 for item in documents if item.get("status") in {"Review", "Draft", "Needs Update"})
    return {
        "generatedAtUtc": utc_now_iso(),
        "documents": documents,
        "topics": topics,
        "summary": {
            "documentCount": len(documents),
            "topicCount": len(topics),
            "currentCount": current_count,
            "reviewCount": review_count,
        },
    }


@router.get("/knowledge/documents")
def list_knowledge_documents() -> list[dict[str, Any]]:
    if smoke_data.smoke_mode_enabled():
        return []
    return knowledge_documents()


@router.get("/knowledge/topics")
def list_knowledge_topics() -> list[dict[str, Any]]:
    if smoke_data.smoke_mode_enabled():
        return []
    return knowledge_topics()


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
    sales_payload = sales_module_bootstrap()
    products = sales_payload.get("billingProducts", [])
    services = fetch_all("SELECT * FROM billing.Services WHERE IsDeleted = 0 ORDER BY ServiceName")
    hierarchy = sales_payload.get("billingProductHierarchy", [])
    billing_codes = sales_payload.get("billingCodes", [])
    offers = sales_payload.get("offers", [])
    promotions = sales_payload.get("promotions", [])
    rate_plans = sales_payload.get("ratePlans", [])
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
