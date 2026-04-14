#!/usr/bin/env python3
"""
Seed coordinated billing-side source data into Azure SQL Database.

What this script does
---------------------
- Generates internally linked billing data across:
    billing.Customers
    billing.Services
    billing.RatePlans
    billing.Subscriptions
    billing.Invoices
    billing.InvoiceLines
    billing.Payments
    billing.UsageEvents
- Inserts directly into Azure SQL Database using pyodbc + fast_executemany
- Optionally exports CSV files locally
- Optionally uploads those CSV files to Azure Blob Storage

Design goals
------------
- Realistic, coherent billing data instead of unrelated random rows
- Customer/service/plan/subscription relationships stay consistent
- Invoice lines and usage events roll up from the same subscriptions/services
- Operational metrics such as query type, execution count, durations, CPU, and row
  counts are generated consistently enough to support pricing-algorithm testing

Environment variables
---------------------
Required for Azure SQL direct insert:
    AZURE_SQL_SERVER=your-server.database.windows.net
    AZURE_SQL_DATABASE=your_database
    AZURE_SQL_USERNAME=your_sql_user
    AZURE_SQL_PASSWORD=your_sql_password

Optional controls:
    BILLING_SCHEMA=billing
    SEED_SCALE=small|medium|large            (default: medium)
    TRUNCATE_FIRST=true|false                (default: false)
    BATCH_SIZE=5000                          (default: 5000)
    RANDOM_SEED=42                           (default: 42)

Optional CSV export:
    EXPORT_CSV=true|false                    (default: false)
    EXPORT_DIR=./seed_output

Optional Azure Blob upload:
    UPLOAD_TO_BLOB=true|false                (default: false)
    AZURE_BLOB_CONNECTION_STRING=...
    AZURE_BLOB_CONTAINER=billing-seed

Optional mode:
    WRITE_TO_SQL=true|false                  (default: true)

Install:
    pip install pyodbc azure-storage-blob

macOS ODBC note:
    You need an ODBC Driver for SQL Server installed (e.g. ODBC Driver 18).
"""

from __future__ import annotations

import csv
import os
import random
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

try:
    import pyodbc
except ImportError:
    pyodbc = None

try:
    from azure.storage.blob import BlobServiceClient
except ImportError:
    BlobServiceClient = None


# -----------------------------
# Helpers
# -----------------------------

def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    return int(value) if value is not None and value != "" else default


def money(value: float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def microseconds_from_minutes(minutes: float) -> int:
    return int(minutes * 60 * 1_000_000)


def seconds_from_microseconds(us: int) -> Decimal:
    return (Decimal(us) / Decimal("1000000")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def minutes_from_microseconds(us: int) -> Decimal:
    return (Decimal(us) / Decimal("60000000")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def today_utc() -> datetime:
    return datetime.utcnow().replace(microsecond=0)


def random_date(rng: random.Random, start_date: date, end_date: date) -> date:
    delta = (end_date - start_date).days
    return start_date + timedelta(days=rng.randint(0, max(delta, 0)))


def random_datetime(rng: random.Random, start_dt: datetime, end_dt: datetime) -> datetime:
    delta = int((end_dt - start_dt).total_seconds())
    return start_dt + timedelta(seconds=rng.randint(0, max(delta, 0)))


def chunked(seq: Sequence[Tuple], size: int) -> Iterable[Sequence[Tuple]]:
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


# -----------------------------
# Configuration
# -----------------------------

@dataclass(frozen=True)
class ScaleConfig:
    customers: int
    subscriptions_per_customer_min: int
    subscriptions_per_customer_max: int
    invoice_months: int
    max_usage_events_per_subscription_per_month: int


SCALE_MAP: Dict[str, ScaleConfig] = {
    "small": ScaleConfig(
        customers=250,
        subscriptions_per_customer_min=1,
        subscriptions_per_customer_max=3,
        invoice_months=6,
        max_usage_events_per_subscription_per_month=20,
    ),
    "medium": ScaleConfig(
        customers=1_500,
        subscriptions_per_customer_min=1,
        subscriptions_per_customer_max=4,
        invoice_months=12,
        max_usage_events_per_subscription_per_month=30,
    ),
    "large": ScaleConfig(
        customers=5_000,
        subscriptions_per_customer_min=1,
        subscriptions_per_customer_max=5,
        invoice_months=18,
        max_usage_events_per_subscription_per_month=40,
    ),
}


# -----------------------------
# Reference data
# -----------------------------

CUSTOMER_TYPES = ["SmallBusiness", "MidMarket", "Enterprise"]
INDUSTRIES = [
    "Healthcare", "Finance", "Retail", "Technology", "Education",
    "Manufacturing", "Logistics", "Energy", "Media"
]
REGIONS = ["East US", "West US", "Central US", "Canada Central", "UK South"]
COUNTRIES = {"East US": "US", "West US": "US", "Central US": "US", "Canada Central": "CA", "UK South": "GB"}
CUSTOMER_STATUS = ["Active", "Active", "Active", "Suspended", "Churned"]
PAYMENT_METHODS = ["ACH", "Card", "Wire", "Check"]
PAYMENT_STATUS = ["Settled", "Settled", "Settled", "Pending", "Failed", "Reversed"]

SERVICE_CATALOG = [
    ("QRY", "Query Analytics", "Analytics", "Execution", 1, 1, 149.00),
    ("API", "API Gateway Calls", "API", "Call", 1, 0, 0.00),
    ("RPT", "Scheduled Reports", "Reporting", "Execution", 1, 1, 49.00),
    ("ETL", "Data Pipeline Jobs", "DataOps", "Execution", 1, 1, 299.00),
    ("AIF", "AI Inference Requests", "AI", "Execution", 1, 0, 0.00),
    ("STR", "Hot Storage", "Storage", "GBMonth", 1, 1, 19.00),
]

PLAN_TIERS = {
    "Basic": {"included": 5_000, "overage": 0.020000, "fee_multiplier": 1.0, "commit": 0.0},
    "Standard": {"included": 25_000, "overage": 0.010000, "fee_multiplier": 1.8, "commit": 250.0},
    "Pro": {"included": 100_000, "overage": 0.006000, "fee_multiplier": 3.2, "commit": 750.0},
    "Enterprise": {"included": 500_000, "overage": 0.003000, "fee_multiplier": 6.5, "commit": 2_500.0},
}

QUERY_TYPES = ["SELECT", "INSERT", "UPDATE", "DELETE", "MERGE", "BULK INSERT", "EXECUTE"]
REQUEST_TYPES_BY_QUERY = {
    "SELECT": ["dashboard", "adhoc", "scheduled_report"],
    "INSERT": ["ingest", "upsert", "stream_load"],
    "UPDATE": ["correction", "reprice", "status_update"],
    "DELETE": ["retention", "cleanup", "rollback"],
    "MERGE": ["sync", "dimension_merge"],
    "BULK INSERT": ["bulk_load", "seed_load"],
    "EXECUTE": ["stored_proc", "workflow_step"],
}


# -----------------------------
# Data containers
# -----------------------------

@dataclass
class Service:
    service_id: int
    service_code: str
    service_name: str
    service_category: str
    unit_of_measure: str
    is_usage_based: int
    is_recurring: int
    base_list_price: Decimal
    is_active: int = 1


@dataclass
class RatePlan:
    rate_plan_id: int
    plan_code: str
    plan_name: str
    plan_tier: str
    service_id: int
    billing_frequency: str
    included_units: int
    overage_price_per_unit: Decimal
    monthly_base_fee: Decimal
    minimum_commitment: Decimal
    effective_start_date: date
    effective_end_date: Optional[date]
    is_active: int = 1


@dataclass
class Customer:
    customer_id: int
    customer_number: str
    customer_name: str
    customer_type: str
    industry: str
    region: str
    country_code: str
    status: str
    created_date: date
    go_live_date: date
    billing_currency: str
    default_tax_rate: Decimal
    credit_rating: int
    is_autopay: int


@dataclass
class Subscription:
    subscription_id: int
    customer_id: int
    rate_plan_id: int
    subscription_number: str
    start_date: date
    end_date: Optional[date]
    status: str
    quantity: int
    discount_percent: Decimal
    contract_term_months: int
    renewal_date: date
    sales_channel: str
    service_id: int


# -----------------------------
# Generator
# -----------------------------

class BillingSeedGenerator:
    def __init__(self, rng: random.Random, scale: ScaleConfig):
        self.rng = rng
        self.scale = scale

        self.services: List[Service] = []
        self.rate_plans: List[RatePlan] = []
        self.customers: List[Customer] = []
        self.subscriptions: List[Subscription] = []

        self.invoices: List[Tuple] = []
        self.invoice_lines: List[Tuple] = []
        self.payments: List[Tuple] = []
        self.usage_events: List[Tuple] = []

        self._next_rate_plan_id = 1
        self._next_invoice_id = 1
        self._next_invoice_line_id = 1
        self._next_payment_id = 1
        self._next_usage_event_id = 1

    def generate(self) -> None:
        self._build_services()
        self._build_rate_plans()
        self._build_customers()
        self._build_subscriptions()
        self._build_billing_history()

    def _build_services(self) -> None:
        for i, item in enumerate(SERVICE_CATALOG, start=1):
            code, name, category, unit, usage_based, recurring, base_price = item
            self.services.append(Service(
                service_id=i,
                service_code=f"SVC-{code}",
                service_name=name,
                service_category=category,
                unit_of_measure=unit,
                is_usage_based=usage_based,
                is_recurring=recurring,
                base_list_price=money(base_price),
            ))

    def _build_rate_plans(self) -> None:
        effective_start = date(2024, 1, 1)
        for service in self.services:
            for tier_name, tier in PLAN_TIERS.items():
                rp = RatePlan(
                    rate_plan_id=self._next_rate_plan_id,
                    plan_code=f"PLAN-{service.service_code}-{tier_name[:3].upper()}",
                    plan_name=f"{service.service_name} {tier_name}",
                    plan_tier=tier_name,
                    service_id=service.service_id,
                    billing_frequency="Monthly",
                    included_units=tier["included"],
                    overage_price_per_unit=Decimal(str(tier["overage"])).quantize(Decimal("0.000001")),
                    monthly_base_fee=money(float(service.base_list_price) * tier["fee_multiplier"]),
                    minimum_commitment=money(tier["commit"]),
                    effective_start_date=effective_start,
                    effective_end_date=None,
                )
                self.rate_plans.append(rp)
                self._next_rate_plan_id += 1

    def _build_customers(self) -> None:
        for i in range(1, self.scale.customers + 1):
            region = self.rng.choice(REGIONS)
            created_date = random_date(self.rng, date(2023, 1, 1), date(2025, 6, 30))
            go_live = created_date + timedelta(days=self.rng.randint(1, 60))
            self.customers.append(Customer(
                customer_id=i,
                customer_number=f"CUST-{i:06d}",
                customer_name=f"Customer {i:05d}",
                customer_type=self.rng.choices(CUSTOMER_TYPES, weights=[60, 28, 12], k=1)[0],
                industry=self.rng.choice(INDUSTRIES),
                region=region,
                country_code=COUNTRIES[region],
                status=self.rng.choices(CUSTOMER_STATUS, weights=[80, 0, 0, 12, 8], k=1)[0],
                created_date=created_date,
                go_live_date=go_live,
                billing_currency="USD",
                default_tax_rate=Decimal(str(self.rng.choice([0.0, 0.05, 0.065, 0.0725, 0.0825]))).quantize(Decimal("0.0001")),
                credit_rating=self.rng.randint(580, 840),
                is_autopay=1 if self.rng.random() < 0.68 else 0,
            ))

    def _pick_rate_plan_for_customer(self, customer: Customer) -> RatePlan:
        if customer.customer_type == "SmallBusiness":
            tier = self.rng.choices(["Basic", "Standard", "Pro"], weights=[65, 30, 5], k=1)[0]
        elif customer.customer_type == "MidMarket":
            tier = self.rng.choices(["Standard", "Pro", "Enterprise"], weights=[40, 50, 10], k=1)[0]
        else:
            tier = self.rng.choices(["Pro", "Enterprise"], weights=[30, 70], k=1)[0]
        service = self.rng.choice(self.services)
        candidates = [rp for rp in self.rate_plans if rp.service_id == service.service_id and rp.plan_tier == tier]
        return self.rng.choice(candidates)

    def _build_subscriptions(self) -> None:
        next_id = 1
        for customer in self.customers:
            count = self.rng.randint(
                self.scale.subscriptions_per_customer_min,
                self.scale.subscriptions_per_customer_max,
            )
            used_service_ids = set()
            for _ in range(count):
                rp = self._pick_rate_plan_for_customer(customer)
                # Prefer distinct services per customer, if possible
                available = [x for x in self.rate_plans if x.plan_tier == rp.plan_tier and x.service_id not in used_service_ids]
                if available:
                    rp = self.rng.choice(available)
                used_service_ids.add(rp.service_id)

                start_date = max(customer.go_live_date, random_date(self.rng, date(2024, 1, 1), date(2025, 9, 30)))
                term = self.rng.choice([12, 24, 36])
                renewal = start_date + timedelta(days=30 * term)
                ended = self.rng.random() < 0.08
                end_date = start_date + timedelta(days=self.rng.randint(90, 360)) if ended else None
                status = "Cancelled" if ended else ("Paused" if self.rng.random() < 0.04 else "Active")
                qty = self.rng.randint(1, 5 if customer.customer_type == "SmallBusiness" else 25)
                discount = Decimal(str(self.rng.choice([0, 0, 0, 2.5, 5, 7.5, 10, 12.5]))).quantize(Decimal("0.0001"))

                self.subscriptions.append(Subscription(
                    subscription_id=next_id,
                    customer_id=customer.customer_id,
                    rate_plan_id=rp.rate_plan_id,
                    subscription_number=f"SUB-{next_id:08d}",
                    start_date=start_date,
                    end_date=end_date,
                    status=status,
                    quantity=qty,
                    discount_percent=discount,
                    contract_term_months=term,
                    renewal_date=renewal,
                    sales_channel=self.rng.choice(["Direct", "Partner", "Marketplace"]),
                    service_id=rp.service_id,
                ))
                next_id += 1

    def _generate_usage_profile(self, sub: Subscription, rp: RatePlan, month_start: date) -> List[Tuple]:
        customer = self.customers[sub.customer_id - 1]
        service = next(s for s in self.services if s.service_id == sub.service_id)

        # Volume tied to tier/customer size
        tier_factor = {
            "Basic": 0.5,
            "Standard": 1.0,
            "Pro": 2.4,
            "Enterprise": 6.0,
        }[rp.plan_tier]

        customer_factor = {
            "SmallBusiness": 0.7,
            "MidMarket": 1.4,
            "Enterprise": 3.5,
        }[customer.customer_type]

        events = self.rng.randint(4, self.scale.max_usage_events_per_subscription_per_month)
        monthly_units_target = int(rp.included_units * tier_factor * customer_factor * self.rng.uniform(0.55, 1.35))
        monthly_units_target = max(monthly_units_target, events)

        remaining_units = monthly_units_target
        rows: List[Tuple] = []

        for idx in range(events):
            if idx == events - 1:
                units = remaining_units
            else:
                max_for_row = max(1, int(remaining_units / (events - idx) * self.rng.uniform(0.5, 1.5)))
                units = self.rng.randint(1, max_for_row)
            remaining_units = max(0, remaining_units - units)

            query_type = self.rng.choices(
                QUERY_TYPES,
                weights=[55, 8, 12, 4, 5, 6, 10],
                k=1,
            )[0]
            request_type = self.rng.choice(REQUEST_TYPES_BY_QUERY[query_type])

            execution_count = units if query_type in {"SELECT", "EXECUTE", "API", "BULK INSERT"} else max(1, int(units * self.rng.uniform(0.25, 1.0)))
            row_count = max(1, int(units * self.rng.uniform(1, 35)))
            avg_duration_minutes = round(self.rng.uniform(0.03, 12.0) * (1.0 if customer.customer_type != "Enterprise" else 1.8), 2)
            duration_us = microseconds_from_minutes(avg_duration_minutes)
            cpu_seconds = float(minutes_from_microseconds(duration_us)) * self.rng.uniform(6.0, 40.0)
            logical_reads = max(10, int(row_count * self.rng.uniform(0.8, 8.0)))
            physical_reads = int(logical_reads * self.rng.uniform(0.0, 0.18))
            max_memory = max(128, int(row_count * self.rng.uniform(0.2, 5.0)))
            log_bytes = max(256, int(row_count * self.rng.uniform(40, 400)))
            discounted = 1 if sub.discount_percent > 0 else 0

            # Pricing-algo-friendly amount: unit price reacts to service/tier/query type
            qtype_multiplier = {
                "SELECT": 1.00,
                "INSERT": 1.08,
                "UPDATE": 1.12,
                "DELETE": 0.92,
                "MERGE": 1.16,
                "BULK INSERT": 1.22,
                "EXECUTE": 1.05,
            }[query_type]
            unit_price = (rp.overage_price_per_unit * Decimal(str(qtype_multiplier))).quantize(Decimal("0.000001"))
            extended = (Decimal(execution_count) * unit_price).quantize(Decimal("0.0001"))

            day_offset = self.rng.randint(0, 27)
            event_dt = datetime.combine(month_start + timedelta(days=day_offset), datetime.min.time()) + timedelta(
                hours=self.rng.randint(0, 23),
                minutes=self.rng.randint(0, 59),
                seconds=self.rng.randint(0, 59),
            )

            correlation_id = f"CORR-{sub.subscription_id:08d}-{month_start.strftime('%Y%m')}-{idx + 1:03d}"
            resource_id = f"{service.service_code}-{customer.customer_number}-{idx + 1:03d}"

            rows.append((
                self._next_usage_event_id,
                sub.subscription_id,
                sub.customer_id,
                sub.service_id,
                event_dt,
                event_dt.date(),
                Decimal(execution_count).quantize(Decimal("0.0001")),
                unit_price,
                extended,
                customer.region,
                resource_id,
                query_type,
                discounted,
                correlation_id,
            ))
            self._next_usage_event_id += 1

        return rows

    def _build_billing_history(self) -> None:
        months_back = self.scale.invoice_months
        month_anchors = []
        today = date.today().replace(day=1)
        for i in range(months_back):
            anchor = (today - timedelta(days=30 * i)).replace(day=1)
            month_anchors.append(anchor)
        month_anchors = sorted(set(month_anchors))

        rate_plan_map = {rp.rate_plan_id: rp for rp in self.rate_plans}
        service_map = {s.service_id: s for s in self.services}

        for sub in self.subscriptions:
            rp = rate_plan_map[sub.rate_plan_id]
            service = service_map[sub.service_id]
            customer = self.customers[sub.customer_id - 1]

            for month_start in month_anchors:
                if month_start < sub.start_date.replace(day=1):
                    continue
                if sub.end_date and month_start > sub.end_date.replace(day=1):
                    continue

                month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
                invoice_date = month_end
                due_date = invoice_date + timedelta(days=30)

                usage_rows = self._generate_usage_profile(sub, rp, month_start)
                self.usage_events.extend(usage_rows)

                total_exec_units = sum(int(r[6]) for r in usage_rows)
                usage_amount = sum((r[8] for r in usage_rows), Decimal("0.0000"))

                recurring_qty = Decimal(sub.quantity).quantize(Decimal("0.0001"))
                recurring_unit_price = rp.monthly_base_fee
                recurring_amount = (recurring_qty * recurring_unit_price).quantize(Decimal("0.0001"))

                overage_units = max(0, total_exec_units - rp.included_units)
                overage_amount = (Decimal(overage_units) * rp.overage_price_per_unit).quantize(Decimal("0.0001"))

                subtotal = recurring_amount + usage_amount + overage_amount

                discount_amount = Decimal("0.0000")
                if sub.discount_percent > 0:
                    discount_amount = (subtotal * (sub.discount_percent / Decimal("100"))).quantize(Decimal("0.0001"))

                taxable = subtotal - discount_amount
                tax_amount = (taxable * customer.default_tax_rate).quantize(Decimal("0.0001"))
                total_amount = (taxable + tax_amount).quantize(Decimal("0.0001"))

                invoice_id = self._next_invoice_id
                invoice_number = f"INV-{invoice_id:09d}"

                pay_behavior = self.rng.random()
                if customer.status == "Churned":
                    invoice_status = "Overdue"
                    amount_paid = Decimal("0.0000")
                elif pay_behavior < 0.70:
                    invoice_status = "Paid"
                    amount_paid = total_amount
                elif pay_behavior < 0.88:
                    invoice_status = "Partial"
                    amount_paid = (total_amount * Decimal(str(self.rng.uniform(0.35, 0.90)))).quantize(Decimal("0.0001"))
                elif pay_behavior < 0.96:
                    invoice_status = "Issued"
                    amount_paid = Decimal("0.0000")
                else:
                    invoice_status = "Void"
                    amount_paid = Decimal("0.0000")

                balance_due = (total_amount - amount_paid).quantize(Decimal("0.0001"))

                self.invoices.append((
                    invoice_id,
                    sub.customer_id,
                    invoice_number,
                    invoice_date,
                    month_start,
                    month_end,
                    due_date,
                    invoice_status,
                    subtotal,
                    discount_amount,
                    tax_amount,
                    total_amount,
                    amount_paid,
                    balance_due,
                    datetime.combine(invoice_date, datetime.min.time()),
                ))
                self._next_invoice_id += 1

                # Invoice lines
                self.invoice_lines.append((
                    self._next_invoice_line_id,
                    invoice_id,
                    sub.subscription_id,
                    sub.service_id,
                    "Recurring",
                    f"{service.service_name} monthly base fee ({rp.plan_tier})",
                    recurring_qty,
                    recurring_unit_price.quantize(Decimal("0.000001")),
                    recurring_amount,
                    month_start,
                    month_end,
                ))
                self._next_invoice_line_id += 1

                self.invoice_lines.append((
                    self._next_invoice_line_id,
                    invoice_id,
                    sub.subscription_id,
                    sub.service_id,
                    "Usage",
                    f"{service.service_name} variable usage",
                    Decimal(total_exec_units).quantize(Decimal("0.0001")),
                    (usage_amount / Decimal(max(total_exec_units, 1))).quantize(Decimal("0.000001")),
                    usage_amount,
                    month_start,
                    month_end,
                ))
                self._next_invoice_line_id += 1

                if overage_units > 0:
                    self.invoice_lines.append((
                        self._next_invoice_line_id,
                        invoice_id,
                        sub.subscription_id,
                        sub.service_id,
                        "Overage",
                        f"{service.service_name} overage beyond included units",
                        Decimal(overage_units).quantize(Decimal("0.0001")),
                        rp.overage_price_per_unit.quantize(Decimal("0.000001")),
                        overage_amount,
                        month_start,
                        month_end,
                    ))
                    self._next_invoice_line_id += 1

                if discount_amount > 0:
                    self.invoice_lines.append((
                        self._next_invoice_line_id,
                        invoice_id,
                        sub.subscription_id,
                        sub.service_id,
                        "Discount",
                        f"Subscription discount {sub.discount_percent}%",
                        Decimal("1.0000"),
                        (-discount_amount).quantize(Decimal("0.000001")),
                        -discount_amount,
                        month_start,
                        month_end,
                    ))
                    self._next_invoice_line_id += 1

                self.invoice_lines.append((
                    self._next_invoice_line_id,
                    invoice_id,
                    sub.subscription_id,
                    sub.service_id,
                    "Tax",
                    f"Tax at {customer.default_tax_rate * Decimal('100'):.2f}%",
                    Decimal("1.0000"),
                    tax_amount.quantize(Decimal("0.000001")),
                    tax_amount,
                    month_start,
                    month_end,
                ))
                self._next_invoice_line_id += 1

                # Payments
                if amount_paid > 0:
                    payment_count = 1 if invoice_status == "Paid" else self.rng.choice([1, 2, 3])
                    remaining_paid = amount_paid
                    for p in range(payment_count):
                        if p == payment_count - 1:
                            pay_amt = remaining_paid
                        else:
                            pay_amt = (remaining_paid * Decimal(str(self.rng.uniform(0.2, 0.7)))).quantize(Decimal("0.0001"))
                        remaining_paid = (remaining_paid - pay_amt).quantize(Decimal("0.0001"))
                        payment_date = min(due_date, invoice_date + timedelta(days=self.rng.randint(1, 35)))

                        self.payments.append((
                            self._next_payment_id,
                            invoice_id,
                            sub.customer_id,
                            payment_date,
                            self.rng.choice(PAYMENT_METHODS),
                            "Settled" if invoice_status in {"Paid", "Partial"} else self.rng.choice(PAYMENT_STATUS),
                            pay_amt,
                            f"PAY-{self._next_payment_id:09d}",
                            self.rng.choice(["Stripe", "Fiserv", "Adyen", "Manual"]),
                        ))
                        self._next_payment_id += 1

    # -----------------------------
    # Row transforms
    # -----------------------------
    def customer_rows(self) -> List[Tuple]:
        return [(
            c.customer_id, c.customer_number, c.customer_name, c.customer_type, c.industry,
            c.region, c.country_code, c.status, c.created_date, c.go_live_date,
            c.billing_currency, c.default_tax_rate, c.credit_rating, c.is_autopay
        ) for c in self.customers]

    def service_rows(self) -> List[Tuple]:
        return [(
            s.service_id, s.service_code, s.service_name, s.service_category, s.unit_of_measure,
            s.is_usage_based, s.is_recurring, s.base_list_price, s.is_active
        ) for s in self.services]

    def rate_plan_rows(self) -> List[Tuple]:
        return [(
            rp.rate_plan_id, rp.plan_code, rp.plan_name, rp.plan_tier, rp.service_id,
            rp.billing_frequency, rp.included_units, rp.overage_price_per_unit,
            rp.monthly_base_fee, rp.minimum_commitment, rp.effective_start_date,
            rp.effective_end_date, rp.is_active
        ) for rp in self.rate_plans]

    def subscription_rows(self) -> List[Tuple]:
        return [(
            s.subscription_id, s.customer_id, s.rate_plan_id, s.subscription_number, s.start_date,
            s.end_date, s.status, s.quantity, s.discount_percent, s.contract_term_months,
            s.renewal_date, s.sales_channel
        ) for s in self.subscriptions]


# -----------------------------
# SQL writer
# -----------------------------

class SqlWriter:
    def __init__(self, schema: str, batch_size: int):
        self.schema = schema
        self.batch_size = batch_size

    def connect(self):
        if pyodbc is None:
            raise RuntimeError("pyodbc is not installed. Run: pip install pyodbc")

        # Required environment variables
        required = [
            "AZURE_SQL_SERVER",
            "AZURE_SQL_DATABASE",
            "AZURE_SQL_USERNAME",
            "AZURE_SQL_PASSWORD"
        ]
        missing = [x for x in required if not os.getenv(x)]
        if missing:
            raise RuntimeError(f"Missing environment variables: {', '.join(missing)}")

        server = os.environ["AZURE_SQL_SERVER"]
        database = os.environ["AZURE_SQL_DATABASE"]
        username = os.environ["AZURE_SQL_USERNAME"]
        password = os.environ["AZURE_SQL_PASSWORD"]

        conn_str = (
            "Driver={ODBC Driver 18 for SQL Server};"
            f"Server=tcp:{server},1433;"
            f"Database={database};"
            f"Uid={username};"
            f"Pwd={password};"
            "Encrypt=yes;"
            "TrustServerCertificate=no;"
            "Connection Timeout=30;"
        )

        return pyodbc.connect(conn_str)

    def truncate_tables(self, conn) -> None:
        schema = self.schema

        sql_list = [
            f"DELETE FROM {schema}.UsageEvents;",
            f"DELETE FROM {schema}.InvoiceLines;",
            f"DELETE FROM {schema}.Payments;",
            f"DELETE FROM {schema}.Invoices;",
            f"DELETE FROM {schema}.Subscriptions;",
            f"DELETE FROM {schema}.RatePlans;",
            f"DELETE FROM {schema}.Services;",
            f"DELETE FROM {schema}.Customers;",
        ]

        with conn.cursor() as cur:
            for sql in sql_list:
                print(f"Executing: {sql}")
                cur.execute(sql)
            conn.commit()

    def insert_many(self, conn, table: str, columns: list[str], rows) -> None:
        if not rows:
            print(f"Skipping {table}: 0 rows")
            return

        placeholders = ",".join(["?"] * len(columns))
        col_sql = ",".join(columns)
        sql = f"INSERT INTO {self.schema}.{table} ({col_sql}) VALUES ({placeholders})"

        with conn.cursor() as cur:
            cur.fast_executemany = True
            total = 0

            for i in range(0, len(rows), self.batch_size):
                batch = rows[i:i + self.batch_size]
                cur.executemany(sql, batch)
                total += len(batch)
                print(f"Inserted {total:,} rows into {self.schema}.{table}")

            conn.commit()


# -----------------------------
# CSV / Blob helpers
# -----------------------------

CSV_DEFS = {
    "Customers": [
        "CustomerId", "CustomerNumber", "CustomerName", "CustomerType", "Industry",
        "Region", "CountryCode", "Status", "CreatedDate", "GoLiveDate",
        "BillingCurrency", "DefaultTaxRate", "CreditRating", "IsAutoPay"
    ],
    "Services": [
        "ServiceId", "ServiceCode", "ServiceName", "ServiceCategory", "UnitOfMeasure",
        "IsUsageBased", "IsRecurring", "BaseListPrice", "IsActive"
    ],
    "RatePlans": [
        "RatePlanId", "PlanCode", "PlanName", "PlanTier", "ServiceId", "BillingFrequency",
        "IncludedUnits", "OveragePricePerUnit", "MonthlyBaseFee", "MinimumCommitment",
        "EffectiveStartDate", "EffectiveEndDate", "IsActive"
    ],
    "Subscriptions": [
        "SubscriptionId", "CustomerId", "RatePlanId", "SubscriptionNumber", "StartDate",
        "EndDate", "Status", "Quantity", "DiscountPercent", "ContractTermMonths",
        "RenewalDate", "SalesChannel"
    ],
    "Invoices": [
        "InvoiceId", "CustomerId", "InvoiceNumber", "InvoiceDate", "BillingPeriodStart",
        "BillingPeriodEnd", "DueDate", "InvoiceStatus", "SubtotalAmount", "DiscountAmount",
        "TaxAmount", "TotalAmount", "AmountPaid", "BalanceDue", "CreatedDateTime"
    ],
    "InvoiceLines": [
        "InvoiceLineId", "InvoiceId", "SubscriptionId", "ServiceId", "LineType",
        "LineDescription", "Quantity", "UnitPrice", "LineAmount", "UsagePeriodStart", "UsagePeriodEnd"
    ],
    "Payments": [
        "PaymentId", "InvoiceId", "CustomerId", "PaymentDate", "PaymentMethod",
        "PaymentStatus", "Amount", "ReferenceNumber", "ProcessorName"
    ],
    "UsageEvents": [
        "UsageEventId", "SubscriptionId", "CustomerId", "ServiceId", "EventTimestamp",
        "BillingDate", "UsageQuantity", "UnitPrice", "ExtendedAmount", "Region",
        "ResourceId", "RequestType", "WasDiscounted", "CorrelationId"
    ],
}


def export_csv(export_dir: Path, table_name: str, header: List[str], rows: Sequence[Tuple]) -> Path:
    export_dir.mkdir(parents=True, exist_ok=True)
    path = export_dir / f"{table_name.lower()}.csv"
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)
    print(f"Wrote CSV: {path}")
    return path


def upload_to_blob(paths: List[Path]) -> None:
    if BlobServiceClient is None:
        raise RuntimeError("azure-storage-blob is not installed. Run: pip install azure-storage-blob")

    connection_string = os.getenv("AZURE_BLOB_CONNECTION_STRING")
    container_name = os.getenv("AZURE_BLOB_CONTAINER")
    if not connection_string or not container_name:
        raise RuntimeError("AZURE_BLOB_CONNECTION_STRING and AZURE_BLOB_CONTAINER are required for blob upload.")

    svc = BlobServiceClient.from_connection_string(connection_string)
    container = svc.get_container_client(container_name)
    try:
        container.create_container()
    except Exception:
        pass

    for path in paths:
        blob = container.get_blob_client(path.name)
        with path.open("rb") as data:
            blob.upload_blob(data, overwrite=True)
        print(f"Uploaded to blob: {path.name}")


# -----------------------------
# Main
# -----------------------------

def main() -> int:
    random_seed = env_int("RANDOM_SEED", 42)
    rng = random.Random(random_seed)

    scale_name = os.getenv("SEED_SCALE", "medium").strip().lower()
    if scale_name not in SCALE_MAP:
        raise RuntimeError(f"Unsupported SEED_SCALE '{scale_name}'. Use one of: {', '.join(SCALE_MAP)}")

    scale = SCALE_MAP[scale_name]
    schema = os.getenv("BILLING_SCHEMA", "billing")
    batch_size = env_int("BATCH_SIZE", 5000)
    truncate_first = env_bool("TRUNCATE_FIRST", False)
    export_csv_enabled = env_bool("EXPORT_CSV", False)
    upload_blob_enabled = env_bool("UPLOAD_TO_BLOB", False)
    write_to_sql = env_bool("WRITE_TO_SQL", True)
    export_dir = Path(os.getenv("EXPORT_DIR", "./seed_output"))

    print(f"Generating coherent billing seed data | scale={scale_name} | seed={random_seed}")
    gen = BillingSeedGenerator(rng, scale)
    gen.generate()

    rows = {
        "Customers": gen.customer_rows(),
        "Services": gen.service_rows(),
        "RatePlans": gen.rate_plan_rows(),
        "Subscriptions": gen.subscription_rows(),
        "Invoices": gen.invoices,
        "InvoiceLines": gen.invoice_lines,
        "Payments": gen.payments,
        "UsageEvents": gen.usage_events,
    }

    print("Generated row counts:")
    for table_name, table_rows in rows.items():
        print(f"  {table_name:<14} {len(table_rows):>10,}")

    exported_paths: List[Path] = []
    if export_csv_enabled:
        for table_name, table_rows in rows.items():
            exported_paths.append(export_csv(export_dir, table_name, CSV_DEFS[table_name], table_rows))

    if upload_blob_enabled:
        if not exported_paths:
            for table_name, table_rows in rows.items():
                exported_paths.append(export_csv(export_dir, table_name, CSV_DEFS[table_name], table_rows))
        upload_to_blob(exported_paths)

    if write_to_sql:
        writer = SqlWriter(schema=schema, batch_size=batch_size)
        conn = writer.connect()
        try:
            if truncate_first:
                writer.truncate_tables(conn)

            writer.insert_many(conn, "Customers", CSV_DEFS["Customers"], rows["Customers"])
            writer.insert_many(conn, "Services", CSV_DEFS["Services"], rows["Services"])
            writer.insert_many(conn, "RatePlans", CSV_DEFS["RatePlans"], rows["RatePlans"])
            writer.insert_many(conn, "Subscriptions", CSV_DEFS["Subscriptions"], rows["Subscriptions"])
            writer.insert_many(conn, "Invoices", CSV_DEFS["Invoices"], rows["Invoices"])
            writer.insert_many(conn, "InvoiceLines", CSV_DEFS["InvoiceLines"], rows["InvoiceLines"])
            writer.insert_many(conn, "Payments", CSV_DEFS["Payments"], rows["Payments"])
            writer.insert_many(conn, "UsageEvents", CSV_DEFS["UsageEvents"], rows["UsageEvents"])
        finally:
            conn.close()

    print("Done.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
