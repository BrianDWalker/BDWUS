from __future__ import annotations

import json
import os
import re
import uuid
import threading
from datetime import datetime, date, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from app.database import get_sql_connection
from app.services.context import lookup_customer_profile
from app.services.pricing import calculate_price


router = APIRouter(prefix="/api/sales", tags=["sales"])
billing_router = APIRouter(prefix="/api/billing", tags=["billing"])

SQL_DIR = Path(__file__).resolve().parents[2] / "sql"
SCHEMA_FILE = SQL_DIR / "sales_schema.sql"
SCHEMA_READY = False
SCHEMA_LOCK = threading.Lock()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def stable_uuid(value: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, value)


def jdump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def jload(value: str | None) -> Any:
    if not value:
      return None
    return json.loads(value)


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


def fetch_all_on_cursor(cursor, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    rows = cursor.execute(sql, params).fetchall()
    return [row_to_dict(cursor, row) for row in rows]


def fetch_one_on_cursor(cursor, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    rows = fetch_all_on_cursor(cursor, sql, params)
    return rows[0] if rows else None


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


def split_batches(script: str) -> list[str]:
    batches: list[str] = []
    current: list[str] = []
    for line in script.splitlines():
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


def ensure_sales_storage() -> None:
    global SCHEMA_READY
    if SCHEMA_READY:
        return
    with SCHEMA_LOCK:
        if SCHEMA_READY:
            return
        script = SCHEMA_FILE.read_text(encoding="utf-8")
        conn = get_sql_connection()
        try:
            cursor = conn.cursor()
            for batch in split_batches(script):
                cursor.execute(batch)
            conn.commit()
            SCHEMA_READY = True
        finally:
            conn.close()


def table_has_rows(table_name: str) -> bool:
    row = fetch_one(f"SELECT TOP 1 1 AS HasRow FROM {table_name}")
    return row is not None


def seed_if_empty() -> None:
    if table_has_rows("billing.Customers") and table_has_rows("ms.Leads"):
        return

    customers = [
        {
            "customer_number": "CUST-1001",
            "customer_name": "Apex Health",
            "customer_type": "Enterprise",
            "industry": "Healthcare",
            "region": "Midwest",
            "country_code": "US",
            "status": "Active",
            "credit_rating": 88,
            "billing_profile": "Net 30, tax exempt, consolidated bill",
            "primary_contact": "Mara Ellis",
            "mrr": 1480000,
            "segment": "Enterprise",
            "support_tier": "Gold",
            "serviceability": "On-net fiber / enterprise voice",
            "locations": [
                ("HQ", "100 Apex Plaza", "Chicago", "IL", "60601", "On-net"),
                ("Campus East", "220 Health Way", "Aurora", "IL", "60502", "Near-net"),
            ],
            "services": ["Fiber 1G", "Cloud Voice", "SLA Support"],
        },
        {
            "customer_number": "CUST-1002",
            "customer_name": "Brightstar Retail",
            "customer_type": "SMB",
            "industry": "Retail",
            "region": "Southeast",
            "country_code": "US",
            "status": "Active",
            "credit_rating": 73,
            "billing_profile": "Net 15, card autopay, store-level detail",
            "primary_contact": "Nolan Pierce",
            "mrr": 228300,
            "segment": "SMB",
            "support_tier": "Silver",
            "serviceability": "Wireless footprint / store continuity",
            "locations": [
                ("HQ", "900 Commerce Blvd", "Atlanta", "GA", "30301", "Near-net"),
                ("Store 14", "14 Market Street", "Savannah", "GA", "31401", "Wireless"),
            ],
            "services": ["Mobile Plus", "Fiber 500"],
        },
        {
            "customer_number": "CUST-1003",
            "customer_name": "Metro Logistics",
            "customer_type": "Enterprise",
            "industry": "Logistics",
            "region": "Southwest",
            "country_code": "US",
            "status": "Active",
            "credit_rating": 91,
            "billing_profile": "Net 45, PO required, usage summary",
            "primary_contact": "Devin Rowe",
            "mrr": 336200,
            "segment": "Enterprise",
            "support_tier": "Gold",
            "serviceability": "On-net transport / branch wireless",
            "locations": [
                ("Distribution Center", "700 Freight Rd", "Dallas", "TX", "75201", "On-net"),
                ("Branch South", "80 Yard Ave", "Phoenix", "AZ", "85001", "Near-net"),
            ],
            "services": ["SD-WAN", "DIA"],
        },
        {
            "customer_number": "CUST-1004",
            "customer_name": "Summit Manufacturing",
            "customer_type": "Enterprise",
            "industry": "Manufacturing",
            "region": "West Coast",
            "country_code": "US",
            "status": "Active",
            "credit_rating": 84,
            "billing_profile": "Net 30, cost center split",
            "primary_contact": "Iris Chen",
            "mrr": 189500,
            "segment": "Enterprise",
            "support_tier": "Gold",
            "serviceability": "Industrial wireless / IoT mix",
            "locations": [
                ("Plant A", "50 Factory Rd", "Los Angeles", "CA", "90001", "Wireless"),
                ("Plant B", "60 Factory Rd", "Riverside", "CA", "92501", "Near-net"),
            ],
            "services": ["IoT SIM", "Mobile Plus"],
        },
        {
            "customer_number": "CUST-1005",
            "customer_name": "Coastal Health Partners",
            "customer_type": "Enterprise",
            "industry": "Healthcare",
            "region": "Southeast",
            "country_code": "US",
            "status": "Active",
            "credit_rating": 77,
            "billing_profile": "Net 30, parent-child hierarchy",
            "primary_contact": "Priya Shah",
            "mrr": 319300,
            "segment": "Enterprise",
            "support_tier": "Platinum",
            "serviceability": "Outage sensitive / review required",
            "locations": [
                ("Main Campus", "800 Care Dr", "Tampa", "FL", "33601", "On-net"),
                ("Clinic West", "18 West Care Way", "Orlando", "FL", "32801", "Review"),
            ],
            "services": ["DIA", "Managed Router"],
        },
    ]

    products = [
        ("P-FIB-500", "Fiber 500", "Wireline", "Access", "DIA-MRC", 2500, 1100),
        ("P-FIB-1G", "Fiber 1G", "Wireline", "Access", "DIA-MRC", 4500, 1800),
        ("P-DIA-1G", "DIA 1G", "Wireline", "Access", "DIA-MRC", 5200, 2200),
        ("P-VOICE", "Cloud Voice", "Voice", "Voice", "CVO-MRC", 120, 95),
        ("P-SDWAN", "SD-WAN", "Managed", "Managed", "SDW-MRC", 1800, 900),
        ("P-ROUTER", "Managed Router", "Managed", "Managed", "CPE-MRC", 140, 80),
        ("P-WBACK", "Wireless Backup", "Wireless", "Wireless", "WLS-BACKUP", 160, 60),
        ("P-IOT", "IoT SIM", "Wireless", "Wireless", "IOT-SIM", 22, 8),
    ]
    services = [
        ("S-FIBER", "Fiber Access", "Access", "On-net", "DIA-MRC", 2500, 1100),
        ("S-VOICE", "Cloud Voice", "Voice", "Broadband", "CVO-MRC", 120, 95),
        ("S-SDWAN", "SD-WAN", "Managed", "Any", "SDW-MRC", 1800, 900),
        ("S-IOT", "IoT Mobility", "Wireless", "Wireless", "IOT-SIM", 22, 8),
        ("S-ROUTER", "Managed Router", "Managed", "Any", "CPE-MRC", 140, 80),
    ]
    billing_codes = [
        ("DIA-MRC", "Dedicated Internet Access recurring charge", "Recurring"),
        ("DIA-NRC", "Dedicated Internet Access installation", "One-time"),
        ("CVO-MRC", "Cloud Voice recurring charge", "Recurring"),
        ("CPE-MRC", "Managed router recurring charge", "Recurring"),
        ("WLS-BACKUP", "Wireless backup recurring charge", "Recurring"),
        ("IOT-SIM", "IoT SIM recurring charge", "Recurring"),
        ("SDW-MRC", "SD-WAN recurring charge", "Recurring"),
    ]
    offers = [
        ("OFFER-FIBER-WINBACK", "Fiber Winback", "Promo", "36 mo term", "12% MRC discount"),
        ("OFFER-ENTERPRISE-RENEW", "Enterprise Renewal Guardrail", "Strategic", "Enterprise with approval", "Margin protection"),
        ("OFFER-IOT-RAMP", "IoT Device Ramp", "Offer", "Industrial / fleet", "Volume-based savings"),
    ]
    promotions = [
        ("PROMO-FIBER", "Fiber Winback", "Promo", 12),
        ("PROMO-RENEW", "Enterprise Renewal Guardrail", "Strategic", 5),
        ("PROMO-IOT", "IoT Device Ramp", "Offer", 8),
    ]

    conn = get_sql_connection()
    try:
        cur = conn.cursor()
        cur.fast_executemany = True

        if not table_has_rows("billing.Customers"):
            cur.executemany(
                """
                INSERT INTO billing.Customers
                (CustomerNumber, CustomerName, CustomerType, Industry, Region, CountryCode, Status, CreditRating, BillingProfile, PrimaryContact, Mrr, CustomerDataJson)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        item["customer_number"],
                        item["customer_name"],
                        item["customer_type"],
                        item["industry"],
                        item["region"],
                        item["country_code"],
                        item["status"],
                        item["credit_rating"],
                        item["billing_profile"],
                        item["primary_contact"],
                        item["mrr"],
                        jdump({"segment": item["segment"], "serviceability": item["serviceability"], "services": item["services"]}),
                    )
                    for item in customers
                ],
            )

            cur.executemany(
                """
                INSERT INTO billing.CustomerProfiles
                (CustomerNumber, AccountManager, Segment, SupportTier, Notes, ProfileJson)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        item["customer_number"],
                        item["primary_contact"],
                        item["segment"],
                        item["support_tier"],
                        item["serviceability"],
                        jdump({"services": item["services"], "locations": item["locations"]}),
                    )
                    for item in customers
                ],
            )

            cur.executemany(
                """
                INSERT INTO billing.ServiceLocations
                (ServiceLocationId, CustomerNumber, LocationName, AddressLine1, City, StateProvince, PostalCode, CountryCode, ServiceabilityType)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        str(stable_uuid(f"{item['customer_number']}:{location[0]}")),
                        item["customer_number"],
                        location[0],
                        location[1],
                        location[2],
                        location[3],
                        location[4],
                        item["country_code"],
                        location[5],
                    )
                    for item in customers
                    for location in item["locations"]
                ],
            )

        if not table_has_rows("billing.BillingCodes"):
            cur.executemany(
                """
                INSERT INTO billing.BillingCodes
                (BillingCodeId, Code, Description, BillingType)
                VALUES (?, ?, ?, ?)
                """,
                [(str(stable_uuid(code)), code, description, billing_type) for code, description, billing_type in billing_codes],
            )

        if not table_has_rows("billing.Products"):
            cur.executemany(
                """
                INSERT INTO billing.Products
                (ProductId, ProductCode, ProductName, Category, ServiceCategory, BillingCode, BaseMrc, BaseNrc)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid(code)), code, name, category, service_category, billing_code, mrc, nrc)
                    for code, name, category, service_category, billing_code, mrc, nrc in products
                ],
            )
            cur.executemany(
                """
                INSERT INTO billing.Services
                (ServiceId, ServiceCode, ServiceName, Category, ServiceabilityType, BillingCode, BaseMrc, BaseNrc)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid(code)), code, name, category, serviceability_type, billing_code, mrc, nrc)
                    for code, name, category, serviceability_type, billing_code, mrc, nrc in services
                ],
            )
            cur.executemany(
                """
                INSERT INTO billing.RatePlans
                (RatePlanId, ProductId, PlanCode, PlanName, PlanTier, BillingFrequency, IncludedUnits, OveragePricePerUnit, MonthlyBaseFee, MinimumCommitment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        str(stable_uuid(f"plan-{code}")),
                        str(stable_uuid(code)),
                        f"PLAN-{code}",
                        name,
                        "Enterprise" if "1G" in name or "SD-WAN" in name else "Standard",
                        "Monthly",
                        1000 if "1G" in name or "SD-WAN" in name else 250,
                        Decimal("0.08"),
                        Decimal(str(mrc)),
                        Decimal("250"),
                    )
                    for code, name, *_rest, mrc, _nrc in products
                ],
            )
            cur.executemany(
                """
                INSERT INTO billing.ProductHierarchy
                (ProductHierarchyId, ProductId, ParentProductId, HierarchyPath, DisplayOrder)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid(f"hier-{code}")), str(stable_uuid(code)), None, f"/{code}", index)
                    for index, (code, *_rest) in enumerate(products, start=1)
                ],
            )

        if not table_has_rows("billing.Offers"):
            cur.executemany(
                """
                INSERT INTO billing.Offers
                (OfferId, OfferCode, OfferName, OfferType, Eligibility, DiscountDescription)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [(str(stable_uuid(code)), code, name, offer_type, eligibility, discount) for code, name, offer_type, eligibility, discount in offers],
            )

        if not table_has_rows("billing.Promotions"):
            cur.executemany(
                """
                INSERT INTO billing.Promotions
                (PromotionId, PromotionCode, PromotionName, PromotionType, DiscountPct)
                VALUES (?, ?, ?, ?, ?)
                """,
                [(str(stable_uuid(code)), code, name, promo_type, discount) for code, name, promo_type, discount in promotions],
            )

        if not table_has_rows("ms.Accounts"):
            account_rows = []
            for item in customers:
                account_rows.append(
                    (
                        str(stable_uuid(f"account:{item['customer_number']}")),
                        f"ACCT-{item['customer_number'].split('-')[-1]}",
                        item["customer_number"],
                        item["customer_name"],
                        item["segment"],
                        item["region"],
                        "Active",
                        item["primary_contact"],
                        item["mrr"],
                        jdump({"billingProfile": item["billing_profile"], "services": item["services"]}),
                    )
                )
            cur.executemany(
                """
                INSERT INTO ms.Accounts
                (AccountId, AccountNumber, CustomerNumber, AccountName, Segment, Region, Status, OwnerName, Mrr, CustomerInfoJson)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                account_rows,
            )

        if not table_has_rows("ms.Leads"):
            leads = [
                ("LEAD-441", "CUST-1001", "Apex Health", "Mara Ellis", "Partner referral", "Qualified", "Open", 74200, "Tia Brooks", "Fiber 500", ["Fiber 500", "Cloud Voice"], {"customerType": "Enterprise", "region": "Midwest"}),
                ("LEAD-446", "CUST-1002", "Brightstar Retail", "Nolan Pierce", "Website", "Discovery", "Open", 51800, "Sam Malik", "Cloud Voice", ["Cloud Voice", "Mobile Plus"], {"customerType": "SMB", "region": "Southeast"}),
                ("LEAD-452", "CUST-1004", "Summit Manufacturing", "Iris Chen", "Outbound", "Needs analysis", "Open", 146900, "Ari Fox", "SD-WAN", ["SD-WAN", "IoT SIM"], {"customerType": "Enterprise", "region": "West Coast"}),
            ]
            cur.executemany(
                """
                INSERT INTO ms.Leads
                (LeadId, LeadNumber, CustomerNumber, AccountName, ContactName, Source, Qualification, Status, EstimatedValue, OwnerName, ProductInterest, ServiceNeedsJson, CustomerInfoJson, Notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        str(stable_uuid(f"lead:{number}")),
                        number,
                        customer_number,
                        account_name,
                        contact_name,
                        source,
                        qualification,
                        status,
                        value,
                        owner,
                        product,
                        jdump(service_needs),
                        jdump(customer_info),
                        f"{account_name} interested in {product} and related services.",
                    )
                    for number, customer_number, account_name, contact_name, source, qualification, status, value, owner, product, service_needs, customer_info in leads
                ],
            )
            cur.executemany(
                """
                INSERT INTO ms.LeadActivities
                (LeadActivityId, LeadId, ActivityDate, ActivityType, Outcome, Notes, NextStep, CreatedBy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid("lead-441-a1")), str(stable_uuid("lead:LEAD-441")), utc_now(), "Call", "Connected", "Confirmed fiber and voice needs.", "Send discovery recap", "Tia Brooks"),
                    (str(stable_uuid("lead-441-a2")), str(stable_uuid("lead:LEAD-441")), utc_now(), "Email", "Follow-up scheduled", "Sent recap and discovery checklist.", "Confirm service locations", "Tia Brooks"),
                    (str(stable_uuid("lead-446-a1")), str(stable_uuid("lead:LEAD-446")), utc_now(), "Meeting", "Connected", "Reviewed mobile and voice needs.", "Prepare opportunity", "Sam Malik"),
                ],
            )

        if not table_has_rows("ms.Opportunities"):
            opp_rows = [
                ("OPP-812", "Apex Health", "CUST-1001", "Hospital campus bandwidth uplift", "Contracting", "Open", "Maya Ortiz", "2026-06-04", 416700, 39.8, 12, "Fiber 1G, Cloud Voice, SLA Support", "On-net fiber / enterprise voice", "Approval Required", "LEAD-441"),
                ("OPP-827", "Summit Manufacturing", "CUST-1004", "IoT fleet expansion", "Solutioning", "Open", "Ari Fox", "2026-06-18", 198210, 22.5, 34, "IoT SIM, Private APN, Device Care", "Wireless footprint", "Draft", "LEAD-452"),
                ("OPP-833", "Brightstar Retail", "CUST-1002", "Store continuity bundle", "Proposal", "Open", "Sarah Johnson", "2026-05-28", 84900, 35.7, 38, "Fiber 500, Mobile Plus, failover", "Mixed on-net / near-net", "Sent", "LEAD-446"),
            ]
            cur.executemany(
                """
                INSERT INTO ms.Opportunities
                (OpportunityId, OpportunityNumber, LeadId, AccountId, OpportunityName, Stage, Status, OwnerName, CloseDate, EstimatedValue, MarginPct, LocationCount, ProductSummary, ServiceSummary, ApprovalStatus, ConvertedFromLeadId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        str(stable_uuid(f"opp:{opp_number}")),
                        opp_number,
                        str(stable_uuid(f"lead:{lead_number}")) if lead_number else None,
                        str(stable_uuid(f"account:{customer_number}")),
                        opp_name,
                        stage,
                        status,
                        owner,
                        close_date,
                        value,
                        margin,
                        locations,
                        product_summary,
                        service_summary,
                        approval_status,
                        str(stable_uuid(f"lead:{lead_number}")) if lead_number else None,
                    )
                    for opp_number, account_name, customer_number, opp_name, stage, status, owner, close_date, value, margin, locations, product_summary, service_summary, approval_status, lead_number in opp_rows
                ],
            )

        if not table_has_rows("ms.OpportunityProducts"):
            opp_products = [
                ("OPP-812", "Fiber 1G", "DIA-MRC", 1, 13500, 2400, 9400, 39.8, None, None),
                ("OPP-812", "Cloud Voice", "CVO-MRC", 25, 3800, 900, 2600, 31.5, None, None),
                ("OPP-827", "IoT SIM", "IOT-SIM", 500, 2800, 1600, 950, 22.5, None, None),
                ("OPP-833", "Fiber 500", "DIA-MRC", 12, 1900, 600, 1100, 35.7, None, None),
            ]
            cur.executemany(
                """
                INSERT INTO ms.OpportunityProducts
                (OpportunityProductId, OpportunityId, ProductName, BillingCode, Quantity, Mrc, Nrc, Cost, MarginPct, ServiceId, ProductId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        str(stable_uuid(f"opp-product:{opp_number}:{product_name}")),
                        str(stable_uuid(f"opp:{opp_number}")),
                        product_name,
                        billing_code,
                        qty,
                        mrc,
                        nrc,
                        cost,
                        margin,
                        None,
                        str(stable_uuid(f"P-{billing_code}-{product_name}")),
                    )
                    for opp_number, product_name, billing_code, qty, mrc, nrc, cost, margin, _service_id, _product_id in opp_products
                ],
            )

        if not table_has_rows("ms.OpportunityServices"):
            opp_services = [
                ("OPP-812", "Fiber Access", "On-net fiber to campus locations", 12, "On-net", True),
                ("OPP-812", "Cloud Voice", "Voice seats and call routing", 12, "On-net", False),
                ("OPP-827", "IoT Mobility", "Fleet SIM and device connectivity", 34, "Wireless", True),
                ("OPP-833", "Retail Continuity", "Branch failover and mobile backup", 38, "Mixed", True),
            ]
            cur.executemany(
                """
                INSERT INTO ms.OpportunityServices
                (OpportunityServiceId, OpportunityId, ServiceName, ServiceDescription, LocationCount, Serviceability, IsPrimary, ServiceId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        str(stable_uuid(f"opp-service:{opp_number}:{service_name}")),
                        str(stable_uuid(f"opp:{opp_number}")),
                        service_name,
                        description,
                        locations,
                        serviceability,
                        1 if primary else 0,
                        None,
                    )
                    for opp_number, service_name, description, locations, serviceability, primary in opp_services
                ],
            )

        if not table_has_rows("ms.OpportunityNotes"):
            cur.executemany(
                """
                INSERT INTO ms.OpportunityNotes
                (OpportunityNoteId, OpportunityId, NoteType, Note, CreatedBy)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid("opp-note-1")), str(stable_uuid("opp:OPP-812")), "General", "Customer needs high availability for the hospital campus.", "Maya Ortiz"),
                    (str(stable_uuid("opp-note-2")), str(stable_uuid("opp:OPP-827")), "Pricing", "Competitive response needed for IoT fleet expansion.", "Ari Fox"),
                    (str(stable_uuid("opp-note-3")), str(stable_uuid("opp:OPP-833")), "Serviceability", "Branch failover requires install coordination.", "Sarah Johnson"),
                ],
            )

        if not table_has_rows("ms.Quotes"):
            cur.executemany(
                """
                INSERT INTO ms.Quotes
                (QuoteId, QuoteNumber, OpportunityId, Status, VersionNo, TotalMrc, TotalNrc, MarginPct, DiscountPct, ManualAdjustmentPct, ApprovalStatus)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid("quote:Q-2048")), "Q-2048", str(stable_uuid("opp:OPP-812")), "Draft", 1, 17300, 13200, 39.8, 12, 0, "Pending"),
                    (str(stable_uuid("quote:Q-2052")), "Q-2052", str(stable_uuid("opp:OPP-827")), "Draft", 1, 2950, 10800, 22.5, 14, 0, "Pending"),
                    (str(stable_uuid("quote:Q-2061")), "Q-2061", str(stable_uuid("opp:OPP-833")), "Sent", 1, 2358, 8200, 35.7, 4, 0, "Approved"),
                ],
            )

        if not table_has_rows("ms.QuoteLineItems"):
            cur.executemany(
                """
                INSERT INTO ms.QuoteLineItems
                (QuoteLineItemId, QuoteId, ProductName, LineType, Quantity, Mrc, Nrc, Cost, MarginPct, DiscountPct, BillingCode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid("qli-2048-1")), str(stable_uuid("quote:Q-2048")), "Fiber 1G", "Recurring", 1, 13500, 2400, 9400, 39.8, 12, "DIA-MRC"),
                    (str(stable_uuid("qli-2048-2")), str(stable_uuid("quote:Q-2048")), "Cloud Voice", "Recurring", 25, 3800, 900, 2600, 31.5, 12, "CVO-MRC"),
                    (str(stable_uuid("qli-2052-1")), str(stable_uuid("quote:Q-2052")), "IoT SIM", "Recurring", 500, 2800, 1600, 950, 22.5, 14, "IOT-SIM"),
                    (str(stable_uuid("qli-2061-1")), str(stable_uuid("quote:Q-2061")), "Fiber 500", "Recurring", 12, 1900, 600, 1100, 35.7, 4, "DIA-MRC"),
                ],
            )

        if not table_has_rows("ms.PricingInputs"):
            cur.executemany(
                """
                INSERT INTO ms.PricingInputs
                (PricingInputId, QuoteId, InputJson)
                VALUES (?, ?, ?)
                """,
                [
                    (str(stable_uuid("pi-2048")), str(stable_uuid("quote:Q-2048")), jdump({"targetMarginPctInput": 39.8, "manualAdjustmentPctInput": 0, "contractTermMonthsInput": 36})),
                    (str(stable_uuid("pi-2052")), str(stable_uuid("quote:Q-2052")), jdump({"targetMarginPctInput": 22.5, "manualAdjustmentPctInput": 0, "contractTermMonthsInput": 36})),
                    (str(stable_uuid("pi-2061")), str(stable_uuid("quote:Q-2061")), jdump({"targetMarginPctInput": 35.7, "manualAdjustmentPctInput": 0, "contractTermMonthsInput": 24})),
                ],
            )

        if not table_has_rows("ms.PricingResults"):
            cur.executemany(
                """
                INSERT INTO ms.PricingResults
                (PricingResultId, QuoteId, ResultJson, RecommendedPrice, ExpectedMarginPct, FinalPrice, Score)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid("pr-2048")), str(stable_uuid("quote:Q-2048")), jdump({"pricingMessage": "Seeded pricing result"}), 21700, 39.8, 21700, 0.88),
                    (str(stable_uuid("pr-2052")), str(stable_uuid("quote:Q-2052")), jdump({"pricingMessage": "Seeded pricing result"}), 9800, 22.5, 9800, 0.74),
                    (str(stable_uuid("pr-2061")), str(stable_uuid("quote:Q-2061")), jdump({"pricingMessage": "Seeded pricing result"}), 5500, 35.7, 5500, 0.81),
                ],
            )

        if not table_has_rows("ms.Approvals"):
            cur.executemany(
                """
                INSERT INTO ms.Approvals
                (ApprovalId, EntityType, EntityId, ApprovalType, StepName, Status, RequestedBy, ApprovedBy, RequestedChanges)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid("approval-q-2048")), "quote", str(stable_uuid("quote:Q-2048")), "Pricing", "Pricing", "Pending", "Pricing Desk", None, None),
                    (str(stable_uuid("approval-q-2052")), "quote", str(stable_uuid("quote:Q-2052")), "Pricing", "Pricing", "Pending", "Pricing Desk", None, None),
                ],
            )

        if not table_has_rows("ms.CustomPricingRequests"):
            cur.executemany(
                """
                INSERT INTO ms.CustomPricingRequests
                (CustomPricingRequestId, QuoteId, OpportunityId, RequestNumber, Status, Reason, RequestedBy, SubmittedAtUtc)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid("cpr-2048")), str(stable_uuid("quote:Q-2048")), str(stable_uuid("opp:OPP-812")), "CPR-2048", "Submitted", "Margin exception for enterprise hospital expansion", "Tia Brooks", utc_now()),
                    (str(stable_uuid("cpr-2052")), str(stable_uuid("quote:Q-2052")), str(stable_uuid("opp:OPP-827")), "CPR-2052", "Draft", "Discount rework needed for IoT expansion", "Ari Fox", None),
                ],
            )

        if not table_has_rows("ms.Contracts"):
            cur.executemany(
                """
                INSERT INTO ms.Contracts
                (ContractId, ContractNumber, OpportunityId, QuoteId, ContractName, Status, TermsJson, SignedDate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid("con-1042")), "CON-1042", str(stable_uuid("opp:OPP-812")), str(stable_uuid("quote:Q-2048")), "Apex Health master services agreement", "Ready", jdump({"termMonths": 36, "renewal": "Annual", "install": "30 days"}), "2026-05-12"),
                    (str(stable_uuid("con-1088")), "CON-1088", str(stable_uuid("opp:OPP-827")), str(stable_uuid("quote:Q-2052")), "Summit Manufacturing expansion contract", "Review", jdump({"termMonths": 36, "renewal": "Annual", "install": "45 days"}), "2026-05-09"),
                ],
            )

        if not table_has_rows("ms.ContractFiles"):
            cur.executemany(
                """
                INSERT INTO ms.ContractFiles
                (ContractFileId, ContractId, FileName, FileType, StorageUrl, FileSizeBytes)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid("cf-1042")), str(stable_uuid("con-1042")), "Apex-Health-MSA.pdf", "application/pdf", "/contracts/CON-1042.pdf", 241223),
                    (str(stable_uuid("cf-1088")), str(stable_uuid("con-1088")), "Summit-Expansion-Contract.pdf", "application/pdf", "/contracts/CON-1088.pdf", 198842),
                ],
            )

        if not table_has_rows("ms.ContractHistory"):
            cur.executemany(
                """
                INSERT INTO ms.ContractHistory
                (ContractHistoryId, ContractId, EventType, Notes, CreatedBy)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid("ch-1042-1")), str(stable_uuid("con-1042")), "Generated", "Contract created from approved quote.", "System"),
                    (str(stable_uuid("ch-1042-2")), str(stable_uuid("con-1042")), "ReadyForReview", "Pending legal review.", "Legal"),
                ],
            )

        if not table_has_rows("ms.ServiceabilityChecks"):
            cur.executemany(
                """
                INSERT INTO ms.ServiceabilityChecks
                (ServiceabilityCheckId, OpportunityId, CustomerNumber, LocationName, AddressLine1, City, StateProvince, PostalCode, ResultStatus, ResultJson)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (str(stable_uuid("svc-1")), str(stable_uuid("opp:OPP-812")), "CUST-1001", "HQ", "100 Apex Plaza", "Chicago", "IL", "60601", "On-net", jdump({"result": "On-net fiber", "notes": "Existing footprint"})),
                    (str(stable_uuid("svc-2")), str(stable_uuid("opp:OPP-827")), "CUST-1004", "Plant A", "50 Factory Rd", "Los Angeles", "CA", "90001", "Wireless", jdump({"result": "Wireless coverage", "notes": "Review install complexity"})),
                ],
            )

        conn.commit()
    finally:
        conn.close()


def require_row(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any]:
    row = fetch_one(sql, params)
    if not row:
        raise HTTPException(status_code=404, detail="Record not found.")
    return row


def soft_delete(table: str, id_column: str, entity_id: str) -> None:
    execute(
        f"UPDATE {table} SET IsDeleted = 1, UpdatedAtUtc = SYSUTCDATETIME() WHERE {id_column} = ?",
        (entity_id,),
    )


def trim(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def json_field(payload: dict[str, Any], key: str, fallback: Any = None) -> str | None:
    value = payload.get(key, fallback)
    if value is None:
        return None
    return jdump(value)


def list_table(table: str, order_by: str = "CreatedAtUtc DESC") -> list[dict[str, Any]]:
    return fetch_all(f"SELECT * FROM {table} WHERE IsDeleted = 0 ORDER BY {order_by}")


def get_view_row(view: str, id_column: str, entity_id: str) -> dict[str, Any]:
    return require_row(f"SELECT TOP 1 * FROM {view} WHERE {id_column} = ?", (entity_id,))


def upsert_account_from_customer(customer_number: str, account_name: str | None = None) -> str:
    account = fetch_one(
        "SELECT TOP 1 AccountId FROM ms.Accounts WHERE CustomerNumber = ? AND IsDeleted = 0",
        (customer_number,),
    )
    if account:
        return account["AccountId"]
    customer = fetch_one("SELECT TOP 1 * FROM billing.vCustomerLookup WHERE CustomerNumber = ?", (customer_number,))
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    account_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO ms.Accounts
        (AccountId, AccountNumber, CustomerNumber, AccountName, Segment, Region, Status, OwnerName, Mrr, CustomerInfoJson)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            account_id,
            f"ACCT-{customer_number.split('-')[-1]}",
            customer_number,
            account_name or customer["CustomerName"],
            customer.get("Segment") or customer.get("CustomerType"),
            customer.get("CustomerRegion") or customer.get("Region"),
            "Active",
            customer.get("PrimaryContact"),
            customer.get("Mrr") or 0,
            jdump(customer),
        ),
    )
    return account_id


def row_as_value(row: dict[str, Any], columns: list[str]) -> list[Any]:
    return [row.get(column) for column in columns]


def current_opportunity_quote(opportunity_id: str) -> dict[str, Any] | None:
    return fetch_one("SELECT TOP 1 * FROM ms.Quotes WHERE OpportunityId = ? AND IsDeleted = 0 ORDER BY CreatedAtUtc DESC", (opportunity_id,))


def line_items_for_quote(quote_id: str) -> list[dict[str, Any]]:
    return fetch_all("SELECT * FROM ms.QuoteLineItems WHERE QuoteId = ? AND IsDeleted = 0 ORDER BY CreatedAtUtc", (quote_id,))


def build_pricing_context_from_quote(quote: dict[str, Any]) -> dict[str, Any]:
    opportunity = fetch_one("SELECT TOP 1 * FROM ms.Opportunities WHERE OpportunityId = ? AND IsDeleted = 0", (quote["OpportunityId"],))
    account = fetch_one("SELECT TOP 1 * FROM ms.Accounts WHERE AccountId = ? AND IsDeleted = 0", (opportunity["AccountId"],)) if opportunity else None
    items = line_items_for_quote(quote["QuoteId"])
    mrc = sum(Decimal(str(item.get("Mrc") or 0)) for item in items) or Decimal(str(quote.get("TotalMrc") or 0))
    cost = sum(Decimal(str(item.get("Cost") or 0)) for item in items) or Decimal("0")
    return {
        "queryType": "sales_quote",
        "executionCount": len(items) or 1,
        "avgDurationMinutes": Decimal("0.5"),
        "avgCpuSeconds": Decimal("0.2"),
        "avgRowCount": Decimal(str(max(len(items), 1))),
        "rowsQueried": len(items),
        "rowsInserted": 0,
        "rowsUpdated": 0,
        "rowsDeleted": 0,
        "rowsMerged": 0,
        "baseListPrice": cost or mrc or Decimal("1000"),
        "subscriptionQuantity": len(items) or 1,
        "customerType": account.get("Segment") if account else None,
        "contractTermMonths": 36,
        "dbLookupUsed": True,
    }


@router.get("/dashboard")
def sales_dashboard():
    ensure_sales_storage()
    seed_if_empty()
    return fetch_one("SELECT TOP 1 * FROM ms.vSalesModuleDashboard") or {}


@router.get("/bootstrap")
def sales_bootstrap():
    ensure_sales_storage()
    seed_if_empty()
    conn = get_sql_connection()
    try:
        cursor = conn.cursor()
        bootstrap = {
            "dashboard": fetch_one_on_cursor(cursor, "SELECT TOP 1 * FROM ms.vSalesModuleDashboard") or {},
            "leads": fetch_all_on_cursor(cursor, "SELECT * FROM ms.vLeadDetail ORDER BY CreatedAtUtc DESC"),
            "accounts": fetch_all_on_cursor(cursor, "SELECT * FROM ms.Accounts WHERE IsDeleted = 0 ORDER BY CreatedAtUtc DESC"),
            "opportunities": fetch_all_on_cursor(cursor, "SELECT * FROM ms.vOpportunityDetail ORDER BY CreatedAtUtc DESC"),
            "quotes": fetch_all_on_cursor(cursor, "SELECT * FROM ms.vQuoteDetail ORDER BY CreatedAtUtc DESC"),
            "customPricing": fetch_all_on_cursor(cursor, "SELECT * FROM ms.CustomPricingRequests WHERE IsDeleted = 0 ORDER BY CreatedAtUtc DESC"),
            "approvals": fetch_all_on_cursor(cursor, "SELECT * FROM ms.Approvals ORDER BY CreatedAtUtc DESC"),
            "contracts": fetch_all_on_cursor(cursor, "SELECT * FROM ms.vContractDetail ORDER BY CreatedAtUtc DESC"),
            "billingCustomers": fetch_all_on_cursor(cursor, "SELECT * FROM billing.vCustomerLookup ORDER BY CustomerNumber"),
            "billingProducts": fetch_all_on_cursor(cursor, "SELECT * FROM billing.Products WHERE IsDeleted = 0 ORDER BY ProductName"),
            "billingProductHierarchy": fetch_all_on_cursor(cursor, "SELECT * FROM billing.vProductBillingHierarchy ORDER BY DisplayOrder, ProductName"),
            "billingCodes": fetch_all_on_cursor(cursor, "SELECT * FROM billing.BillingCodes WHERE IsDeleted = 0 ORDER BY Code"),
            "billingElements": fetch_all_on_cursor(cursor, "SELECT * FROM billing.BillingElements WHERE IsDeleted = 0 ORDER BY ElementName"),
            "offers": fetch_all_on_cursor(cursor, "SELECT * FROM billing.Offers WHERE IsDeleted = 0 ORDER BY OfferName"),
            "promotions": fetch_all_on_cursor(cursor, "SELECT * FROM billing.Promotions WHERE IsDeleted = 0 ORDER BY PromotionName"),
            "ratePlans": fetch_all_on_cursor(cursor, "SELECT * FROM billing.RatePlans WHERE IsDeleted = 0 ORDER BY PlanName"),
        }
        return bootstrap
    finally:
        conn.close()


@router.get("/leads")
def list_leads(q: str | None = None, status: str | None = None):
    ensure_sales_storage()
    seed_if_empty()
    query = "SELECT * FROM ms.vLeadDetail WHERE 1=1"
    params: list[Any] = []
    if q:
        query += " AND (LeadNumber LIKE ? OR AccountName LIKE ? OR ProductInterest LIKE ? OR OwnerName LIKE ?)"
        like = f"%{q}%"
        params.extend([like, like, like, like])
    if status and status != "All":
        query += " AND Status = ?"
        params.append(status)
    query += " ORDER BY CreatedAtUtc DESC"
    return fetch_all(query, tuple(params))


@router.get("/leads/{lead_id}")
def get_lead(lead_id: uuid.UUID):
    ensure_sales_storage()
    seed_if_empty()
    return get_view_row("ms.vLeadDetail", "LeadId", str(lead_id))


@router.post("/leads")
def create_lead(payload: dict[str, Any]):
    ensure_sales_storage()
    lead_id = str(uuid.uuid4())
    account_name = trim(payload.get("accountName") or payload.get("AccountName") or payload.get("leadName")) or "New Lead"
    customer_number = trim(payload.get("customerNumber") or payload.get("CustomerNumber"))
    service_needs = payload.get("serviceNeeds") or payload.get("ServiceNeeds") or []
    customer_info = payload.get("customerInfo") or payload.get("CustomerInfo") or {}
    execute(
        """
        INSERT INTO ms.Leads
        (LeadId, LeadNumber, CustomerNumber, AccountName, ContactName, Source, Qualification, Status, EstimatedValue, OwnerName, ProductInterest, ServiceNeedsJson, CustomerInfoJson, Notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            lead_id,
            payload.get("leadNumber") or f"LEAD-{lead_id[:4].upper()}",
            customer_number,
            account_name,
            trim(payload.get("contactName")),
            trim(payload.get("source")) or "Website",
            trim(payload.get("qualification")) or "Open",
            trim(payload.get("status")) or "Open",
            payload.get("estimatedValue") or 0,
            trim(payload.get("ownerName")) or trim(payload.get("owner")) or "Unassigned",
            trim(payload.get("productInterest")) or payload.get("product"),
            json_field(payload, "serviceNeeds", service_needs),
            json_field(payload, "customerInfo", customer_info),
            trim(payload.get("notes")) or "",
        ),
    )
    return get_view_row("ms.vLeadDetail", "LeadId", lead_id)


@router.put("/leads/{lead_id}")
def update_lead(lead_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    current = get_lead(lead_id)
    execute(
        """
        UPDATE ms.Leads
        SET CustomerNumber = ?, AccountName = ?, ContactName = ?, Source = ?, Qualification = ?, Status = ?, EstimatedValue = ?, OwnerName = ?, ProductInterest = ?, ServiceNeedsJson = ?, CustomerInfoJson = ?, Notes = ?, UpdatedAtUtc = SYSUTCDATETIME()
        WHERE LeadId = ?
        """,
        (
            trim(payload.get("customerNumber", current.get("CustomerNumber"))),
            trim(payload.get("accountName", current.get("AccountName"))),
            trim(payload.get("contactName", current.get("ContactName"))),
            trim(payload.get("source", current.get("Source"))),
            trim(payload.get("qualification", current.get("Qualification"))),
            trim(payload.get("status", current.get("Status"))),
            payload.get("estimatedValue", current.get("EstimatedValue")) or 0,
            trim(payload.get("ownerName", current.get("OwnerName"))),
            trim(payload.get("productInterest", current.get("ProductInterest"))),
            json_field(payload, "serviceNeeds", current.get("ServiceNeedsJson")),
            json_field(payload, "customerInfo", current.get("CustomerInfoJson")),
            trim(payload.get("notes", current.get("Notes"))),
            str(lead_id),
        ),
    )
    return get_view_row("ms.vLeadDetail", "LeadId", str(lead_id))


@router.delete("/leads/{lead_id}")
def delete_lead(lead_id: uuid.UUID):
    ensure_sales_storage()
    soft_delete("ms.Leads", "LeadId", str(lead_id))
    return {"ok": True}


@router.post("/leads/{lead_id}/convert")
def convert_lead(lead_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    conn = get_sql_connection()
    try:
        cur = conn.cursor()
        lead = cur.execute("SELECT TOP 1 * FROM ms.Leads WHERE LeadId = ? AND IsDeleted = 0", (str(lead_id),)).fetchone()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found.")
        customer_number = lead.CustomerNumber or payload.get("customerNumber")
        if not customer_number:
            raise HTTPException(status_code=400, detail="Lead conversion requires a customer number.")
        account_id = upsert_account_from_customer(customer_number, lead.AccountName)
        opportunity_id = str(uuid.uuid4())
        opportunity_number = payload.get("opportunityNumber") or f"OPP-{opportunity_id[:4].upper()}"
        opportunity_name = trim(payload.get("opportunityName")) or f"{lead.AccountName} opportunity"
        cur.execute(
            """
            INSERT INTO ms.Opportunities
            (OpportunityId, OpportunityNumber, LeadId, AccountId, OpportunityName, Stage, Status, OwnerName, CloseDate, EstimatedValue, MarginPct, LocationCount, ProductSummary, ServiceSummary, ApprovalStatus, ConvertedFromLeadId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                opportunity_id,
                opportunity_number,
                str(lead_id),
                account_id,
                opportunity_name,
                "Qualification",
                "Open",
                trim(payload.get("ownerName")) or lead.OwnerName,
                payload.get("closeDate"),
                payload.get("estimatedValue") or lead.EstimatedValue,
                payload.get("marginPct"),
                payload.get("locationCount"),
                lead.ProductInterest,
                lead.ServiceNeedsJson or "[]",
                "Open",
                str(lead_id),
            ),
        )
        cur.execute(
            """
            UPDATE ms.Leads
            SET Status = ?, Qualification = ?, ConvertedOpportunityId = ?, UpdatedAtUtc = SYSUTCDATETIME()
            WHERE LeadId = ?
            """,
            ("Converted", "Open", opportunity_id, str(lead_id)),
        )
        cur.execute(
            """
            INSERT INTO ms.OpportunityNotes
            (OpportunityNoteId, OpportunityId, NoteType, Note, CreatedBy)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                opportunity_id,
                "Conversion",
                f"Lead converted from {lead.LeadNumber}.",
                trim(payload.get("approvedBy")) or lead.OwnerName,
            ),
        )
        conn.commit()
        return get_view_row("ms.vOpportunityDetail", "OpportunityId", opportunity_id)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.get("/leads/{lead_id}/activities")
def get_lead_activities(lead_id: uuid.UUID):
    ensure_sales_storage()
    return fetch_all("SELECT * FROM ms.LeadActivities WHERE LeadId = ? AND IsDeleted = 0 ORDER BY ActivityDate DESC", (str(lead_id),))


@router.post("/leads/{lead_id}/activities")
def create_lead_activity(lead_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    execute(
        """
        INSERT INTO ms.LeadActivities
        (LeadActivityId, LeadId, ActivityDate, ActivityType, Outcome, Notes, NextStep, CreatedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            str(lead_id),
            payload.get("activityDate") or utc_now(),
            trim(payload.get("activityType")) or "Call",
            trim(payload.get("outcome")) or "Logged",
            trim(payload.get("notes")) or trim(payload.get("summary")) or "",
            trim(payload.get("nextStep")) or "",
            trim(payload.get("createdBy")) or "Admin",
        ),
    )
    return get_lead_activities(lead_id)


@router.get("/accounts")
def list_accounts(q: str | None = None):
    ensure_sales_storage()
    query = "SELECT * FROM ms.Accounts WHERE IsDeleted = 0"
    params: list[Any] = []
    if q:
        like = f"%{q}%"
        query += " AND (AccountNumber LIKE ? OR AccountName LIKE ? OR Segment LIKE ? OR Region LIKE ?)"
        params.extend([like, like, like, like])
    query += " ORDER BY CreatedAtUtc DESC"
    return fetch_all(query, tuple(params))


@router.get("/accounts/{account_id}")
def get_account(account_id: uuid.UUID):
    ensure_sales_storage()
    return require_row("SELECT TOP 1 * FROM ms.Accounts WHERE AccountId = ? AND IsDeleted = 0", (str(account_id),))


@router.post("/accounts")
def create_account(payload: dict[str, Any]):
    ensure_sales_storage()
    account_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO ms.Accounts
        (AccountId, AccountNumber, CustomerNumber, AccountName, Segment, Region, Status, OwnerName, Mrr, CustomerInfoJson)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            account_id,
            trim(payload.get("accountNumber")) or f"ACCT-{account_id[:4].upper()}",
            trim(payload.get("customerNumber")),
            trim(payload.get("accountName")) or "New Account",
            trim(payload.get("segment")),
            trim(payload.get("region")),
            trim(payload.get("status")) or "Active",
            trim(payload.get("ownerName")),
            payload.get("mrr") or 0,
            json_field(payload, "customerInfo", payload.get("customerInfo") or {}),
        ),
    )
    return get_account(uuid.UUID(account_id))


@router.put("/accounts/{account_id}")
def update_account(account_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    current = get_account(account_id)
    execute(
        """
        UPDATE ms.Accounts
        SET CustomerNumber = ?, AccountName = ?, Segment = ?, Region = ?, Status = ?, OwnerName = ?, Mrr = ?, CustomerInfoJson = ?, UpdatedAtUtc = SYSUTCDATETIME()
        WHERE AccountId = ?
        """,
        (
            trim(payload.get("customerNumber", current.get("CustomerNumber"))),
            trim(payload.get("accountName", current.get("AccountName"))),
            trim(payload.get("segment", current.get("Segment"))),
            trim(payload.get("region", current.get("Region"))),
            trim(payload.get("status", current.get("Status"))),
            trim(payload.get("ownerName", current.get("OwnerName"))),
            payload.get("mrr", current.get("Mrr")) or 0,
            json_field(payload, "customerInfo", current.get("CustomerInfoJson")),
            str(account_id),
        ),
    )
    return get_account(account_id)


@router.delete("/accounts/{account_id}")
def delete_account(account_id: uuid.UUID):
    ensure_sales_storage()
    soft_delete("ms.Accounts", "AccountId", str(account_id))
    return {"ok": True}


@router.get("/opportunities")
def list_opportunities(q: str | None = None, stage: str | None = None, owner: str | None = None):
    ensure_sales_storage()
    query = "SELECT * FROM ms.vOpportunityDetail WHERE 1=1"
    params: list[Any] = []
    if q:
        like = f"%{q}%"
        query += " AND (OpportunityNumber LIKE ? OR OpportunityName LIKE ? OR AccountNameResolved LIKE ? OR ProductSummary LIKE ?)"
        params.extend([like, like, like, like])
    if stage and stage != "All stages":
        query += " AND Stage = ?"
        params.append(stage)
    if owner and owner != "All owners":
        query += " AND OwnerName = ?"
        params.append(owner)
    query += " ORDER BY CreatedAtUtc DESC"
    return fetch_all(query, tuple(params))


@router.get("/opportunities/{opportunity_id}")
def get_opportunity(opportunity_id: uuid.UUID):
    ensure_sales_storage()
    return get_view_row("ms.vOpportunityDetail", "OpportunityId", str(opportunity_id))


@router.post("/opportunities")
def create_opportunity(payload: dict[str, Any]):
    ensure_sales_storage()
    account_id = payload.get("accountId")
    if not account_id and payload.get("customerNumber"):
        account_id = upsert_account_from_customer(payload["customerNumber"], payload.get("accountName"))
    if not account_id:
        raise HTTPException(status_code=400, detail="Opportunity requires an account.")
    opportunity_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO ms.Opportunities
        (OpportunityId, OpportunityNumber, LeadId, AccountId, OpportunityName, Stage, Status, OwnerName, CloseDate, EstimatedValue, MarginPct, LocationCount, ProductSummary, ServiceSummary, ApprovalStatus, ConvertedFromLeadId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            opportunity_id,
            trim(payload.get("opportunityNumber")) or f"OPP-{opportunity_id[:4].upper()}",
            payload.get("leadId"),
            account_id,
            trim(payload.get("opportunityName")) or "New Opportunity",
            trim(payload.get("stage")) or "Discovery",
            trim(payload.get("status")) or "Open",
            trim(payload.get("ownerName")) or trim(payload.get("owner")),
            payload.get("closeDate"),
            payload.get("estimatedValue") or 0,
            payload.get("marginPct"),
            payload.get("locationCount"),
            trim(payload.get("productSummary")),
            trim(payload.get("serviceSummary")),
            trim(payload.get("approvalStatus")) or "Draft",
            payload.get("convertedFromLeadId"),
        ),
    )
    return get_opportunity(uuid.UUID(opportunity_id))


@router.put("/opportunities/{opportunity_id}")
def update_opportunity(opportunity_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    current = get_opportunity(opportunity_id)
    execute(
        """
        UPDATE ms.Opportunities
        SET AccountId = ?, OpportunityName = ?, Stage = ?, Status = ?, OwnerName = ?, CloseDate = ?, EstimatedValue = ?, MarginPct = ?, LocationCount = ?, ProductSummary = ?, ServiceSummary = ?, ApprovalStatus = ?, UpdatedAtUtc = SYSUTCDATETIME()
        WHERE OpportunityId = ?
        """,
        (
            payload.get("accountId") or current.get("AccountId"),
            trim(payload.get("opportunityName", current.get("OpportunityName"))),
            trim(payload.get("stage", current.get("Stage"))),
            trim(payload.get("status", current.get("Status"))),
            trim(payload.get("ownerName", current.get("OwnerName"))),
            payload.get("closeDate", current.get("CloseDate")),
            payload.get("estimatedValue", current.get("EstimatedValue")) or 0,
            payload.get("marginPct", current.get("MarginPct")),
            payload.get("locationCount", current.get("LocationCount")),
            trim(payload.get("productSummary", current.get("ProductSummary"))),
            trim(payload.get("serviceSummary", current.get("ServiceSummary"))),
            trim(payload.get("approvalStatus", current.get("ApprovalStatus"))),
            str(opportunity_id),
        ),
    )
    return get_opportunity(opportunity_id)


@router.delete("/opportunities/{opportunity_id}")
def delete_opportunity(opportunity_id: uuid.UUID):
    ensure_sales_storage()
    soft_delete("ms.Opportunities", "OpportunityId", str(opportunity_id))
    return {"ok": True}


@router.get("/opportunities/{opportunity_id}/products")
def get_opportunity_products(opportunity_id: uuid.UUID):
    ensure_sales_storage()
    return fetch_all("SELECT * FROM ms.OpportunityProducts WHERE OpportunityId = ? AND IsDeleted = 0 ORDER BY CreatedAtUtc", (str(opportunity_id),))


@router.post("/opportunities/{opportunity_id}/products")
def create_opportunity_product(opportunity_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    execute(
        """
        INSERT INTO ms.OpportunityProducts
        (OpportunityProductId, OpportunityId, ProductId, ProductName, BillingCode, Quantity, Mrc, Nrc, Cost, MarginPct, ServiceId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            str(opportunity_id),
            payload.get("productId"),
            trim(payload.get("productName")) or "Product",
            trim(payload.get("billingCode")),
            payload.get("quantity") or 1,
            payload.get("mrc") or 0,
            payload.get("nrc") or 0,
            payload.get("cost") or 0,
            payload.get("marginPct"),
            payload.get("serviceId"),
        ),
    )
    return get_opportunity_products(opportunity_id)


@router.put("/opportunities/{opportunity_id}/products/{product_id}")
def update_opportunity_product(opportunity_id: uuid.UUID, product_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    execute(
        """
        UPDATE ms.OpportunityProducts
        SET ProductId = ?, ProductName = ?, BillingCode = ?, Quantity = ?, Mrc = ?, Nrc = ?, Cost = ?, MarginPct = ?, ServiceId = ?, UpdatedAtUtc = SYSUTCDATETIME()
        WHERE OpportunityProductId = ? AND OpportunityId = ?
        """,
        (
            payload.get("productId"),
            trim(payload.get("productName")),
            trim(payload.get("billingCode")),
            payload.get("quantity") or 1,
            payload.get("mrc") or 0,
            payload.get("nrc") or 0,
            payload.get("cost") or 0,
            payload.get("marginPct"),
            payload.get("serviceId"),
            str(product_id),
            str(opportunity_id),
        ),
    )
    return get_opportunity_products(opportunity_id)


@router.delete("/opportunities/{opportunity_id}/products/{product_id}")
def delete_opportunity_product(opportunity_id: uuid.UUID, product_id: uuid.UUID):
    ensure_sales_storage()
    execute(
        "UPDATE ms.OpportunityProducts SET IsDeleted = 1, UpdatedAtUtc = SYSUTCDATETIME() WHERE OpportunityProductId = ? AND OpportunityId = ?",
        (str(product_id), str(opportunity_id)),
    )
    return {"ok": True}


@router.get("/opportunities/{opportunity_id}/notes")
def get_opportunity_notes(opportunity_id: uuid.UUID):
    ensure_sales_storage()
    return fetch_all("SELECT * FROM ms.OpportunityNotes WHERE OpportunityId = ? AND IsDeleted = 0 ORDER BY CreatedAtUtc DESC", (str(opportunity_id),))


@router.post("/opportunities/{opportunity_id}/notes")
def create_opportunity_note(opportunity_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    execute(
        """
        INSERT INTO ms.OpportunityNotes
        (OpportunityNoteId, OpportunityId, NoteType, Note, CreatedBy)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            str(opportunity_id),
            trim(payload.get("noteType")) or "General",
            trim(payload.get("note")) or "",
            trim(payload.get("createdBy")) or "Admin",
        ),
    )
    return get_opportunity_notes(opportunity_id)


@router.get("/custom-pricing")
def list_custom_pricing():
    ensure_sales_storage()
    return fetch_all("SELECT * FROM ms.CustomPricingRequests WHERE IsDeleted = 0 ORDER BY CreatedAtUtc DESC")


@router.get("/custom-pricing/{request_id}")
def get_custom_pricing(request_id: uuid.UUID):
    ensure_sales_storage()
    return require_row("SELECT TOP 1 * FROM ms.CustomPricingRequests WHERE CustomPricingRequestId = ? AND IsDeleted = 0", (str(request_id),))


@router.post("/custom-pricing")
def create_custom_pricing(payload: dict[str, Any]):
    ensure_sales_storage()
    request_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO ms.CustomPricingRequests
        (CustomPricingRequestId, QuoteId, OpportunityId, RequestNumber, Status, Reason, RequestedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            request_id,
            payload.get("quoteId"),
            payload.get("opportunityId"),
            payload.get("requestNumber") or f"CPR-{request_id[:4].upper()}",
            trim(payload.get("status")) or "Draft",
            trim(payload.get("reason")) or "",
            trim(payload.get("requestedBy")) or "Admin",
        ),
    )
    return get_custom_pricing(uuid.UUID(request_id))


@router.put("/custom-pricing/{request_id}")
def update_custom_pricing(request_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    current = get_custom_pricing(request_id)
    execute(
        """
        UPDATE ms.CustomPricingRequests
        SET QuoteId = ?, OpportunityId = ?, Status = ?, Reason = ?, RequestedBy = ?, UpdatedAtUtc = SYSUTCDATETIME()
        WHERE CustomPricingRequestId = ?
        """,
        (
            payload.get("quoteId", current.get("QuoteId")),
            payload.get("opportunityId", current.get("OpportunityId")),
            trim(payload.get("status", current.get("Status"))),
            trim(payload.get("reason", current.get("Reason"))),
            trim(payload.get("requestedBy", current.get("RequestedBy"))),
            str(request_id),
        ),
    )
    return get_custom_pricing(request_id)


@router.delete("/custom-pricing/{request_id}")
def delete_custom_pricing(request_id: uuid.UUID):
    ensure_sales_storage()
    soft_delete("ms.CustomPricingRequests", "CustomPricingRequestId", str(request_id))
    return {"ok": True}


@router.post("/custom-pricing/{request_id}/submit")
def submit_custom_pricing(request_id: uuid.UUID, payload: dict[str, Any] | None = None):
    ensure_sales_storage()
    approval_id = str(uuid.uuid4())
    request = get_custom_pricing(request_id)
    execute(
        "UPDATE ms.CustomPricingRequests SET Status = ?, SubmittedAtUtc = SYSUTCDATETIME(), UpdatedAtUtc = SYSUTCDATETIME() WHERE CustomPricingRequestId = ?",
        ("Submitted", str(request_id)),
    )
    execute(
        """
        INSERT INTO ms.Approvals
        (ApprovalId, EntityType, EntityId, ApprovalType, StepName, Status, RequestedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            approval_id,
            "custom_pricing",
            str(request_id),
            "Pricing",
            "Review",
            "Pending",
            trim((payload or {}).get("requestedBy")) or request.get("RequestedBy") or "Admin",
        ),
    )
    return get_custom_pricing(request_id)


@router.get("/quotes")
def list_quotes():
    ensure_sales_storage()
    return fetch_all("SELECT * FROM ms.vQuoteDetail WHERE 1=1 ORDER BY CreatedAtUtc DESC")


@router.get("/quotes/{quote_id}")
def get_quote(quote_id: uuid.UUID):
    ensure_sales_storage()
    return get_view_row("ms.vQuoteDetail", "QuoteId", str(quote_id))


@router.post("/quotes")
def create_quote(payload: dict[str, Any]):
    ensure_sales_storage()
    opportunity_id = payload.get("opportunityId")
    if not opportunity_id:
        raise HTTPException(status_code=400, detail="Quote requires an opportunity.")
    quote_id = str(uuid.uuid4())
    line_items = payload.get("lineItems") or []
    pricing_input = payload.get("pricingInput") or {}
    if not line_items:
        products = fetch_all("SELECT TOP 10 * FROM ms.OpportunityProducts WHERE OpportunityId = ? AND IsDeleted = 0 ORDER BY CreatedAtUtc", (str(opportunity_id),))
        line_items = [
            {
                "productName": item["ProductName"],
                "billingCode": item.get("BillingCode"),
                "quantity": item.get("Quantity", 1),
                "mrc": item.get("Mrc", 0),
                "nrc": item.get("Nrc", 0),
                "cost": item.get("Cost", 0),
                "marginPct": item.get("MarginPct"),
                "lineType": "Recurring",
            }
            for item in products
        ]
    total_mrc = sum(Decimal(str(item.get("mrc") or 0)) for item in line_items)
    total_nrc = sum(Decimal(str(item.get("nrc") or 0)) for item in line_items)
    execute(
        """
        INSERT INTO ms.Quotes
        (QuoteId, QuoteNumber, OpportunityId, Status, VersionNo, TotalMrc, TotalNrc, MarginPct, DiscountPct, ManualAdjustmentPct, ApprovalStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            quote_id,
            payload.get("quoteNumber") or f"Q-{quote_id[:4].upper()}",
            str(opportunity_id),
            trim(payload.get("status")) or "Draft",
            payload.get("versionNo") or 1,
            float(total_mrc),
            float(total_nrc),
            payload.get("marginPct"),
            payload.get("discountPct"),
            payload.get("manualAdjustmentPct"),
            trim(payload.get("approvalStatus")) or "Pending",
        ),
    )
    for item in line_items:
        execute(
            """
            INSERT INTO ms.QuoteLineItems
            (QuoteLineItemId, QuoteId, ProductName, LineType, Quantity, Mrc, Nrc, Cost, MarginPct, DiscountPct, BillingCode, Notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                quote_id,
                trim(item.get("productName")) or trim(item.get("serviceName")) or "Item",
                trim(item.get("lineType")) or "Recurring",
                item.get("quantity") or 1,
                item.get("mrc") or 0,
                item.get("nrc") or 0,
                item.get("cost") or 0,
                item.get("marginPct"),
                item.get("discountPct"),
                trim(item.get("billingCode")),
                trim(item.get("notes")),
            ),
        )
    execute(
        """
        INSERT INTO ms.PricingInputs (PricingInputId, QuoteId, InputJson)
        VALUES (?, ?, ?)
        """,
        (str(uuid.uuid4()), quote_id, jdump(pricing_input)),
    )
    quote = get_quote(uuid.UUID(quote_id))
    return quote


@router.put("/quotes/{quote_id}")
def update_quote(quote_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    current = get_quote(quote_id)
    execute(
        """
        UPDATE ms.Quotes
        SET Status = ?, TotalMrc = ?, TotalNrc = ?, MarginPct = ?, DiscountPct = ?, ManualAdjustmentPct = ?, ApprovalStatus = ?, UpdatedAtUtc = SYSUTCDATETIME()
        WHERE QuoteId = ?
        """,
        (
            trim(payload.get("status", current.get("Status"))),
            payload.get("totalMrc", current.get("TotalMrc")) or 0,
            payload.get("totalNrc", current.get("TotalNrc")) or 0,
            payload.get("marginPct", current.get("MarginPct")),
            payload.get("discountPct", current.get("DiscountPct")),
            payload.get("manualAdjustmentPct", current.get("ManualAdjustmentPct")),
            trim(payload.get("approvalStatus", current.get("ApprovalStatus"))),
            str(quote_id),
        ),
    )
    return get_quote(quote_id)


@router.delete("/quotes/{quote_id}")
def delete_quote(quote_id: uuid.UUID):
    ensure_sales_storage()
    soft_delete("ms.Quotes", "QuoteId", str(quote_id))
    return {"ok": True}


@router.get("/quotes/{quote_id}/line-items")
def get_quote_line_items(quote_id: uuid.UUID):
    ensure_sales_storage()
    return line_items_for_quote(str(quote_id))


@router.post("/quotes/{quote_id}/line-items")
def create_quote_line_item(quote_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    execute(
        """
        INSERT INTO ms.QuoteLineItems
        (QuoteLineItemId, QuoteId, ProductName, ServiceName, BillingCode, LineType, Quantity, Mrc, Nrc, Cost, MarginPct, DiscountPct, Notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            str(quote_id),
            trim(payload.get("productName")) or "Item",
            trim(payload.get("serviceName")),
            trim(payload.get("billingCode")),
            trim(payload.get("lineType")) or "Recurring",
            payload.get("quantity") or 1,
            payload.get("mrc") or 0,
            payload.get("nrc") or 0,
            payload.get("cost") or 0,
            payload.get("marginPct"),
            payload.get("discountPct"),
            trim(payload.get("notes")),
        ),
    )
    return get_quote_line_items(quote_id)


@router.put("/quotes/{quote_id}/line-items/{line_item_id}")
def update_quote_line_item(quote_id: uuid.UUID, line_item_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    execute(
        """
        UPDATE ms.QuoteLineItems
        SET ProductName = ?, ServiceName = ?, BillingCode = ?, LineType = ?, Quantity = ?, Mrc = ?, Nrc = ?, Cost = ?, MarginPct = ?, DiscountPct = ?, Notes = ?, UpdatedAtUtc = SYSUTCDATETIME()
        WHERE QuoteLineItemId = ? AND QuoteId = ?
        """,
        (
            trim(payload.get("productName")),
            trim(payload.get("serviceName")),
            trim(payload.get("billingCode")),
            trim(payload.get("lineType")),
            payload.get("quantity") or 1,
            payload.get("mrc") or 0,
            payload.get("nrc") or 0,
            payload.get("cost") or 0,
            payload.get("marginPct"),
            payload.get("discountPct"),
            trim(payload.get("notes")),
            str(line_item_id),
            str(quote_id),
        ),
    )
    return get_quote_line_items(quote_id)


@router.delete("/quotes/{quote_id}/line-items/{line_item_id}")
def delete_quote_line_item(quote_id: uuid.UUID, line_item_id: uuid.UUID):
    ensure_sales_storage()
    execute(
        "UPDATE ms.QuoteLineItems SET IsDeleted = 1, UpdatedAtUtc = SYSUTCDATETIME() WHERE QuoteLineItemId = ? AND QuoteId = ?",
        (str(line_item_id), str(quote_id)),
    )
    return {"ok": True}


@router.post("/quotes/{quote_id}/price")
def price_quote(quote_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    quote = get_quote(quote_id)
    items = get_quote_line_items(quote_id)
    context = build_pricing_context_from_quote(quote)
    cost_per_unit = sum(Decimal(str(item.get("Cost") or 0)) for item in items) or Decimal("1000")
    pricing = calculate_price(
        context=context,
        target_margin_pct=Decimal(str(payload.get("targetMarginPct") or quote.get("MarginPct") or 30)),
        manual_adjustment_pct=Decimal(str(payload.get("manualAdjustmentPct") or quote.get("ManualAdjustmentPct") or 0)),
        competitor_price=Decimal(str(payload["competitorPrice"])) if payload.get("competitorPrice") is not None else None,
        demand_index=Decimal(str(payload["demandIndex"])) if payload.get("demandIndex") is not None else None,
        inventory_qty=int(payload.get("inventoryQty")) if payload.get("inventoryQty") is not None else None,
        cost_per_unit=cost_per_unit,
        customer_type_input=payload.get("customerType"),
        contract_term_months=int(payload.get("contractTermMonths") or 36),
    )
    execute(
        """
        INSERT INTO ms.PricingResults
        (PricingResultId, QuoteId, ResultJson, RecommendedPrice, ExpectedMarginPct, FinalPrice, Score)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            str(quote_id),
            jdump(pricing.model_dump()),
            float(pricing.recommendedPrice),
            float(pricing.expectedMarginPct),
            float(pricing.finalPrice),
            float(pricing.score),
        ),
    )
    execute(
        """
        UPDATE ms.Quotes
        SET TotalMrc = ?, TotalNrc = ?, MarginPct = ?, DiscountPct = ?, ManualAdjustmentPct = ?, ApprovalStatus = ?, Status = ?, UpdatedAtUtc = SYSUTCDATETIME()
        WHERE QuoteId = ?
        """,
        (
            float(pricing.finalPrice),
            float(sum(Decimal(str(item.get("Nrc") or 0)) for item in items)),
            float(pricing.expectedMarginPct),
            payload.get("discountPct", quote.get("DiscountPct")) or 0,
            payload.get("manualAdjustmentPct", quote.get("ManualAdjustmentPct")) or 0,
            "Ready",
            "Draft",
            str(quote_id),
        ),
    )
    return pricing.model_dump()


@router.post("/quotes/{quote_id}/submit-approval")
def submit_quote_approval(quote_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    approval_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO ms.Approvals
        (ApprovalId, EntityType, EntityId, ApprovalType, StepName, Status, RequestedBy, RequestedChanges)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            approval_id,
            "quote",
            str(quote_id),
            "Pricing",
            "Review",
            "Pending",
            trim(payload.get("requestedBy")) or "Pricing Desk",
            trim(payload.get("requestedChanges")),
        ),
    )
    execute("UPDATE ms.Quotes SET ApprovalStatus = ?, Status = ? WHERE QuoteId = ?", ("Pending", "Submitted", str(quote_id)))
    return require_row("SELECT TOP 1 * FROM ms.Approvals WHERE ApprovalId = ?", (approval_id,))


@router.get("/approvals")
def list_approvals():
    ensure_sales_storage()
    return fetch_all("SELECT * FROM ms.Approvals ORDER BY CreatedAtUtc DESC")


@router.get("/approvals/{approval_id}")
def get_approval(approval_id: uuid.UUID):
    ensure_sales_storage()
    return require_row("SELECT TOP 1 * FROM ms.Approvals WHERE ApprovalId = ?", (str(approval_id),))


def approve_entity(approval: dict[str, Any], approved_by: str | None = None) -> dict[str, Any]:
    entity_type = approval["EntityType"]
    entity_id = approval["EntityId"]
    execute(
        """
        UPDATE ms.Approvals
        SET Status = ?, ApprovedBy = ?, UpdatedAtUtc = SYSUTCDATETIME()
        WHERE ApprovalId = ?
        """,
        ("Approved", approved_by or "Admin", approval["ApprovalId"]),
    )
    if entity_type == "quote":
        execute("UPDATE ms.Quotes SET ApprovalStatus = ?, Status = ? WHERE QuoteId = ?", ("Approved", "Approved", str(entity_id)))
        contract = fetch_one("SELECT TOP 1 * FROM ms.Contracts WHERE QuoteId = ? AND IsDeleted = 0", (str(entity_id),))
        if not contract:
            quote = get_quote(uuid.UUID(str(entity_id)))
            opportunity = get_opportunity(uuid.UUID(str(quote["OpportunityId"])))
            contract_id = str(uuid.uuid4())
            execute(
                """
                INSERT INTO ms.Contracts
                (ContractId, ContractNumber, OpportunityId, QuoteId, ContractName, Status, TermsJson, SignedDate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    contract_id,
                    f"CON-{contract_id[:4].upper()}",
                    str(quote["OpportunityId"]),
                    str(entity_id),
                    f"{opportunity['OpportunityName']} contract",
                    "Generated",
                    jdump({"sourceQuote": str(entity_id), "termMonths": 36, "approvalBy": approved_by or "Admin"}),
                    None,
                ),
            )
            execute(
                """
                INSERT INTO ms.ContractHistory
                (ContractHistoryId, ContractId, EventType, Notes, CreatedBy)
                VALUES (?, ?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), contract_id, "Generated", "Contract generated after approval.", approved_by or "Admin"),
            )
    elif entity_type == "custom_pricing":
        execute("UPDATE ms.CustomPricingRequests SET Status = ?, ApprovedAtUtc = SYSUTCDATETIME() WHERE CustomPricingRequestId = ?", ("Approved", str(entity_id)))
    return get_approval(uuid.UUID(str(approval["ApprovalId"])))


def reject_entity(approval: dict[str, Any], rejected_by: str | None = None) -> dict[str, Any]:
    execute(
        """
        UPDATE ms.Approvals
        SET Status = ?, ApprovedBy = ?, UpdatedAtUtc = SYSUTCDATETIME()
        WHERE ApprovalId = ?
        """,
        ("Rejected", rejected_by or "Admin", approval["ApprovalId"]),
    )
    if approval["EntityType"] == "quote":
        execute("UPDATE ms.Quotes SET ApprovalStatus = ?, Status = ? WHERE QuoteId = ?", ("Rejected", "Draft", str(approval["EntityId"])))
    elif approval["EntityType"] == "custom_pricing":
        execute("UPDATE ms.CustomPricingRequests SET Status = ?, RejectedAtUtc = SYSUTCDATETIME() WHERE CustomPricingRequestId = ?", ("Rejected", str(approval["EntityId"])))
    return get_approval(uuid.UUID(str(approval["ApprovalId"])))


@router.post("/approvals/{approval_id}/approve")
def approve_approval(approval_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    approval = get_approval(approval_id)
    return approve_entity(approval, trim(payload.get("approvedBy")) or "Admin")


@router.post("/approvals/{approval_id}/reject")
def reject_approval(approval_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    approval = get_approval(approval_id)
    return reject_entity(approval, trim(payload.get("approvedBy")) or "Admin")


@router.post("/approvals/{approval_id}/request-changes")
def request_changes_approval(approval_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    approval = get_approval(approval_id)
    execute(
        "UPDATE ms.Approvals SET Status = ?, RequestedChanges = ?, UpdatedAtUtc = SYSUTCDATETIME() WHERE ApprovalId = ?",
        ("Changes Requested", trim(payload.get("requestedChanges")), str(approval_id)),
    )
    return get_approval(approval_id)


@router.get("/contracts")
def list_contracts():
    ensure_sales_storage()
    return fetch_all("SELECT * FROM ms.vContractDetail ORDER BY CreatedAtUtc DESC")


@router.get("/contracts/{contract_id}")
def get_contract(contract_id: uuid.UUID):
    ensure_sales_storage()
    return get_view_row("ms.vContractDetail", "ContractId", str(contract_id))


@router.post("/contracts")
def create_contract(payload: dict[str, Any]):
    ensure_sales_storage()
    contract_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO ms.Contracts
        (ContractId, ContractNumber, OpportunityId, QuoteId, ContractName, Status, TermsJson, SignedDate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            contract_id,
            payload.get("contractNumber") or f"CON-{contract_id[:4].upper()}",
            payload.get("opportunityId"),
            payload.get("quoteId"),
            trim(payload.get("contractName")) or "Contract",
            trim(payload.get("status")) or "Open",
            json_field(payload, "terms", payload.get("terms") or {}),
            payload.get("signedDate"),
        ),
    )
    return get_contract(uuid.UUID(contract_id))


@router.put("/contracts/{contract_id}")
def update_contract(contract_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    current = get_contract(contract_id)
    execute(
        """
        UPDATE ms.Contracts
        SET OpportunityId = ?, QuoteId = ?, ContractName = ?, Status = ?, TermsJson = ?, SignedDate = ?, UpdatedAtUtc = SYSUTCDATETIME()
        WHERE ContractId = ?
        """,
        (
            payload.get("opportunityId", current.get("OpportunityId")),
            payload.get("quoteId", current.get("QuoteId")),
            trim(payload.get("contractName", current.get("ContractName"))),
            trim(payload.get("status", current.get("Status"))),
            json_field(payload, "terms", current.get("TermsJson")),
            payload.get("signedDate", current.get("SignedDate")),
            str(contract_id),
        ),
    )
    return get_contract(contract_id)


@router.delete("/contracts/{contract_id}")
def delete_contract(contract_id: uuid.UUID):
    ensure_sales_storage()
    soft_delete("ms.Contracts", "ContractId", str(contract_id))
    return {"ok": True}


@router.get("/contracts/{contract_id}/files")
def get_contract_files(contract_id: uuid.UUID):
    ensure_sales_storage()
    return fetch_all("SELECT * FROM ms.ContractFiles WHERE ContractId = ? AND IsDeleted = 0 ORDER BY CreatedAtUtc DESC", (str(contract_id),))


@router.post("/contracts/{contract_id}/files")
def create_contract_file(contract_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    execute(
        """
        INSERT INTO ms.ContractFiles
        (ContractFileId, ContractId, FileName, FileType, StorageUrl, FileSizeBytes)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            str(contract_id),
            trim(payload.get("fileName")) or "ContractFile.pdf",
            trim(payload.get("fileType")) or "application/pdf",
            trim(payload.get("storageUrl")) or "",
            payload.get("fileSizeBytes") or 0,
        ),
    )
    execute(
        """
        INSERT INTO ms.ContractHistory
        (ContractHistoryId, ContractId, EventType, Notes, CreatedBy)
        VALUES (?, ?, ?, ?, ?)
        """,
        (str(uuid.uuid4()), str(contract_id), "FileUploaded", trim(payload.get("notes")) or "File metadata uploaded.", trim(payload.get("createdBy")) or "Admin"),
    )
    return get_contract_files(contract_id)


@router.delete("/contracts/{contract_id}/files/{file_id}")
def delete_contract_file(contract_id: uuid.UUID, file_id: uuid.UUID):
    ensure_sales_storage()
    execute("UPDATE ms.ContractFiles SET IsDeleted = 1 WHERE ContractFileId = ? AND ContractId = ?", (str(file_id), str(contract_id)))
    return {"ok": True}


@router.get("/contracts/{contract_id}/history")
def get_contract_history(contract_id: uuid.UUID):
    ensure_sales_storage()
    return fetch_all("SELECT * FROM ms.ContractHistory WHERE ContractId = ? ORDER BY CreatedAtUtc DESC", (str(contract_id),))


@billing_router.get("/customers")
def billing_customers():
    ensure_sales_storage()
    return fetch_all("SELECT * FROM billing.vCustomerLookup ORDER BY CustomerNumber")


@billing_router.get("/customers/{customer_number}")
def billing_customer(customer_number: str):
    ensure_sales_storage()
    return require_row("SELECT TOP 1 * FROM billing.vCustomerLookup WHERE CustomerNumber = ?", (customer_number,))


@billing_router.get("/customer-lookup/{customer_number}")
def billing_customer_lookup(customer_number: str):
    ensure_sales_storage()
    return billing_customer(customer_number)


@billing_router.get("/products")
def billing_products():
    ensure_sales_storage()
    return fetch_all("SELECT * FROM billing.Products WHERE IsDeleted = 0 ORDER BY ProductName")


@billing_router.get("/products/{product_id}")
def billing_product(product_id: uuid.UUID):
    ensure_sales_storage()
    return require_row("SELECT TOP 1 * FROM billing.Products WHERE ProductId = ? AND IsDeleted = 0", (str(product_id),))


@billing_router.get("/product-hierarchy")
def billing_product_hierarchy():
    ensure_sales_storage()
    return fetch_all("SELECT * FROM billing.vProductBillingHierarchy ORDER BY DisplayOrder, ProductName")


@billing_router.get("/billing-codes")
def billing_codes():
    ensure_sales_storage()
    return fetch_all("SELECT * FROM billing.BillingCodes WHERE IsDeleted = 0 ORDER BY Code")


@billing_router.get("/billing-elements")
def billing_elements():
    ensure_sales_storage()
    return fetch_all("SELECT * FROM billing.BillingElements WHERE IsDeleted = 0 ORDER BY ElementName")


@billing_router.get("/offers")
def billing_offers():
    ensure_sales_storage()
    return fetch_all("SELECT * FROM billing.Offers WHERE IsDeleted = 0 ORDER BY OfferName")


@billing_router.get("/promotions")
def billing_promotions():
    ensure_sales_storage()
    return fetch_all("SELECT * FROM billing.Promotions WHERE IsDeleted = 0 ORDER BY PromotionName")


@billing_router.get("/rate-plans")
def billing_rate_plans():
    ensure_sales_storage()
    return fetch_all("SELECT * FROM billing.RatePlans WHERE IsDeleted = 0 ORDER BY PlanName")


@router.post("/serviceability/check")
def serviceability_check(payload: dict[str, Any]):
    ensure_sales_storage()
    customer_number = trim(payload.get("customerNumber"))
    location_name = trim(payload.get("locationName")) or "Primary Site"
    address_line1 = trim(payload.get("addressLine1")) or ""
    city = trim(payload.get("city")) or ""
    state = trim(payload.get("stateProvince")) or ""
    postal_code = trim(payload.get("postalCode")) or ""
    opportunity_id = payload.get("opportunityId")
    lead_id = payload.get("leadId")
    seeded_match = None
    if customer_number:
        seeded_match = fetch_one(
            """
            SELECT TOP 1 * FROM billing.ServiceLocations
            WHERE CustomerNumber = ? AND IsDeleted = 0
            ORDER BY CreatedAtUtc
            """,
            (customer_number,),
        )
    if seeded_match:
        result_status = seeded_match["ServiceabilityType"]
        notes = "Matched seeded service location"
    elif city or state:
        result_status = "Review" if state in {"CA", "FL"} else "Near-net"
        notes = "Derived from seeded geography and manual test logic"
    else:
        result_status = "Review"
        notes = "TODO: integrate real network serviceability service"
    check_id = str(uuid.uuid4())
    result = {
        "resultStatus": result_status,
        "locationName": location_name,
        "addressLine1": address_line1,
        "city": city,
        "stateProvince": state,
        "postalCode": postal_code,
        "notes": notes,
    }
    execute(
        """
        INSERT INTO ms.ServiceabilityChecks
        (ServiceabilityCheckId, LeadId, OpportunityId, CustomerNumber, LocationName, AddressLine1, City, StateProvince, PostalCode, ResultStatus, ResultJson)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            check_id,
            lead_id,
            opportunity_id,
            customer_number,
            location_name,
            address_line1,
            city,
            state,
            postal_code,
            result_status,
            jdump(result),
        ),
    )
    return {"serviceabilityCheckId": check_id, **result}


def init_sales() -> None:
    ensure_sales_storage()
    seed_if_empty()
