from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any


def smoke_mode_enabled() -> bool:
    return os.getenv("PLATFORM_RUNTIME_SMOKE_MODE", "").lower() in {"1", "true", "yes"}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


CUSTOMERS: list[dict[str, Any]] = [
    {
        "CustomerNumber": "CUST-1001",
        "CustomerName": "Apex Health",
        "CustomerType": "Enterprise",
        "Industry": "Healthcare",
        "Region": "Midwest",
        "CountryCode": "US",
        "Status": "Active",
        "CreditRating": 88,
        "BillingProfile": "Net 30",
        "PrimaryContact": "Mara Ellis",
        "Mrr": 1480000,
        "Segment": "Enterprise",
        "SupportTier": "Gold",
        "AccountManager": "Rhea Patel",
    }
]

PRODUCTS: list[dict[str, Any]] = [
    {
        "ProductId": "prod-1",
        "ProductCode": "FIBER-1G",
        "ProductName": "Fiber 1G",
        "Category": "Access",
        "ServiceCategory": "Fiber",
        "BillingCode": "MRC-FIBER",
        "BaseMrc": 1200,
        "BaseNrc": 500,
        "Status": "Active",
    }
]

BILLING_CODES = [{"BillingCodeId": "code-1", "Code": "MRC-FIBER", "Description": "Fiber monthly", "BillingType": "Recurring"}]
BILLING_ELEMENTS = [{"BillingElementId": "elem-1", "ElementName": "Monthly charge", "ElementType": "Recurring", "Amount": 1200}]
OFFERS = [{"OfferId": "offer-1", "OfferCode": "OFFER-1", "OfferName": "Fiber launch", "OfferType": "Discount", "Eligibility": "Enterprise", "Status": "Active"}]
PROMOTIONS = [{"PromotionId": "promo-1", "PromotionCode": "PROMO-1", "PromotionName": "Install credit", "PromotionType": "Credit", "DiscountPct": 10, "Status": "Active"}]
RATE_PLANS = [{"RatePlanId": "rate-1", "PlanCode": "PLAN-1", "PlanName": "Fiber Standard", "PlanTier": "Standard", "BillingFrequency": "Monthly", "MonthlyBaseFee": 1200, "MinimumCommitment": 0}]

ORDERS = [
    {
        "OrderId": "order-1",
        "OrderNumber": "ORD-1001",
        "CustomerNumber": "CUST-1001",
        "AccountName": "Apex Health",
        "ServiceName": "Fiber 1G",
        "LifecycleStage": "Design",
        "OverallStatus": "Draft",
        "SlaStatus": "On Track",
        "AssignedTeam": "Provisioning Ops",
    }
]

NETWORK_EVENTS = [
    {
        "EventId": "event-1",
        "EventNumber": "NE-1001",
        "Market": "Midwest",
        "Type": "Capacity",
        "Impacted": "Backbone",
        "Severity": "Major",
        "Status": "Open",
        "SlaExposure": 25000,
    }
]

PROVISIONING_JOBS = [
    {
        "ProvisioningJobId": "job-1",
        "JobNumber": "JOB-1001",
        "JobType": "Activation",
        "OwnerName": "Provisioning Ops",
        "Status": "Queued",
    }
]

SETTLEMENTS = [
    {
        "SettlementId": "set-1",
        "SettlementNumber": "SET-1001",
        "PartnerName": "Carrier One",
        "BillingPeriod": "May 2026",
        "ExposureAmount": 1000,
        "Status": "Open",
        "ClaimType": "Dispute",
    }
]

INVOICES = [
    {
        "InvoiceId": "invoice-1",
        "InvoiceNumber": "INV-1001",
        "CustomerNumber": "CUST-1001",
        "AccountName": "Apex Health",
        "Amount": 10000,
        "Balance": 2500,
        "Status": "Open",
        "InvoiceDate": "2026-05-01",
        "DueDate": "2026-06-01",
    }
]

ADJUSTMENTS = [{"AdjustmentId": "adj-1", "AdjustmentNumber": "ADJ-1001", "AdjustmentType": "Credit", "Amount": -100, "Status": "Pending", "Reason": "Credit"}]


def sales_dashboard() -> dict[str, Any]:
    return {
        "LeadCount": 1,
        "OpportunityCount": 1,
        "QuoteCount": 1,
        "PendingApprovalCount": 1,
        "ContractCount": 1,
        "PipelineValue": 10000,
        "QuoteMrcValue": 1200,
    }


def sales_bootstrap() -> dict[str, Any]:
    return {
        "dashboard": sales_dashboard(),
        "leads": [{"LeadId": "lead-1", "LeadNumber": "LEAD-1001", "CompanyName": "Apex Health", "Status": "Open"}],
        "accounts": [{"AccountId": "acct-1", "AccountName": "Apex Health", "CustomerNumber": "CUST-1001", "Status": "Active"}],
        "opportunities": [{"OpportunityId": "opp-1", "OpportunityName": "Fiber Expansion", "AccountNameResolved": "Apex Health", "Status": "Open", "EstimatedValue": 10000}],
        "quotes": [{"QuoteId": "quote-1", "QuoteNumber": "Q-1001", "TotalMrc": 1200, "ApprovalStatus": "Pending"}],
        "customPricing": [],
        "approvals": [],
        "contracts": [],
        "billingCustomers": CUSTOMERS,
        "billingProducts": PRODUCTS,
        "billingProductHierarchy": [{"ProductHierarchyId": "hier-1", "ProductName": "Fiber 1G", "HierarchyPath": "Access/Fiber", "DisplayOrder": 1}],
        "billingCodes": BILLING_CODES,
        "billingElements": BILLING_ELEMENTS,
        "offers": OFFERS,
        "promotions": PROMOTIONS,
        "ratePlans": RATE_PLANS,
    }


def platform_bootstrap() -> dict[str, Any]:
    return {
        "generatedAtUtc": utc_now_iso(),
        "dashboard": sales_dashboard(),
        "customers": CUSTOMERS,
        "accounts": sales_bootstrap()["accounts"],
        "leads": sales_bootstrap()["leads"],
        "opportunities": sales_bootstrap()["opportunities"],
        "quotes": sales_bootstrap()["quotes"],
        "contracts": [],
        "products": PRODUCTS,
        "billingCodes": BILLING_CODES,
        "offers": OFFERS,
        "promotions": PROMOTIONS,
        "ratePlans": RATE_PLANS,
        "approvals": [],
        "reportDefinitions": [
            {"id": "executive-scorecard", "name": "Executive scorecard", "area": "Executive", "description": "Pipeline and revenue."}
        ],
        "users": [{"UserNumber": "USR-1001", "UserName": "Rhea Patel", "RoleName": "Sales Manager", "Status": "Active"}],
        "roles": [{"RoleNumber": "ROLE-1", "RoleName": "Sales Manager", "PermissionsJson": "[]", "Status": "Active"}],
        "integrations": [{"IntegrationNumber": "INT-1", "IntegrationName": "CRM Sync", "Status": "Connected"}],
    }


def ops_bootstrap() -> dict[str, Any]:
    return {
        "orders": ORDERS,
        "networkEvents": NETWORK_EVENTS,
        "provisioningJobs": PROVISIONING_JOBS,
        "settlements": SETTLEMENTS,
    }
