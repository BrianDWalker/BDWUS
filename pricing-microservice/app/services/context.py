import os
import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

import pyodbc

from app.database import get_sql_connection
from app.models import BillingContextInput


CUSTOMER_LOOKUP_VIEW = os.getenv("CUSTOMER_LOOKUP_VIEW", "ms.vCustomerLookup")
PRICING_CONTEXT_VIEW = os.getenv("PRICING_CONTEXT_VIEW", "ms.vPricingContext")
BILLING_CONTEXT_OBJECT = os.getenv("BILLING_CONTEXT_OBJECT", PRICING_CONTEXT_VIEW)

MERGED_KEYS = [
    "queryType",
    "executionCount",
    "avgDurationMinutes",
    "avgCpuSeconds",
    "avgRowCount",
    "rowsQueried",
    "rowsInserted",
    "rowsUpdated",
    "rowsDeleted",
    "rowsMerged",
]


def _as_decimal(value: Any) -> Decimal | None:
    """Convert any value to Decimal safely, handling None."""
    if value is None:
        return None
    return Decimal(str(value))


def _extract_numeric_portion(customer_number: str) -> str:
    """Extract only digits from a customer number string.
    
    Supports flexible formats:
      "CUST-000001" -> "000001"
      "000001"      -> "000001"
      "1"           -> "1"
    
    Returns the consecutive digit sequence from the input.
    """
    digits = re.findall(r"\d+", str(customer_number or ""))
    return "".join(digits) if digits else str(customer_number or "").strip()


def lookup_customer_profile(account_id: str) -> dict[str, Any] | None:
    """
    Lookup customer profile from the ms.vCustomerLookup view.
    
    Uses flexible matching:
    1. First tries exact match on CustomerNumber
    2. Then tries numeric portion matching (wildcard LIKE pattern)
    
    Supports input formats:
      - CUST-000001 (alpha-numeric with delimiter)
      - 000001      (numeric string)
      - 1           (simple numeric)
    
    Returns customer attributes for Web UI auto-fill:
      - customerNumber
      - customerName
      - customerType
      - industryType
      - customerRegion
      - countryCode
      - customerStatus
      - creditRating
    
    If no match found, returns None.
    """
    if not account_id:
        return None

    account_id = str(account_id).strip()
    numeric_portion = _extract_numeric_portion(account_id)
    
    if not numeric_portion:
        return None

    conn = get_sql_connection()
    try:
        cursor = conn.cursor()
        
        # Try exact match first, then fall back to pattern with numeric extraction
        row = cursor.execute(
            f"""
            SELECT TOP 1
                CustomerNumber,
                CustomerName,
                CustomerType,
                IndustryType,
                CustomerRegion,
                CountryCode,
                CustomerStatus,
                CreditRating
            FROM {CUSTOMER_LOOKUP_VIEW}
            WHERE CustomerNumber = ? OR CustomerNumber LIKE ?
            ORDER BY CASE WHEN CustomerNumber = ? THEN 0 ELSE 1 END, CustomerNumber DESC
            """,
            account_id,
            f"%{numeric_portion}%",
            account_id,
        ).fetchone()

        if not row:
            return None

        return {
            "customerNumber": row.CustomerNumber,
            "customerName": row.CustomerName,
            "customerType": row.CustomerType,
            "industryType": row.IndustryType,
            "customerRegion": row.CustomerRegion,
            "countryCode": row.CountryCode,
            "customerStatus": row.CustomerStatus,
            "creditRating": row.CreditRating,
        }
    except Exception as e:
        # Log the error for debugging, but don't fail the entire lookup
        print(f"Customer lookup error: {e}")
        return None
    finally:
        conn.close()


def get_customer_metadata_options() -> dict[str, list[str]]:
    """Return distinct billing metadata values for dropdowns in the Web UI."""
    conn = get_sql_connection()
    try:
        cursor = conn.cursor()
        regions = [row.CustomerRegion for row in cursor.execute(
            f"SELECT DISTINCT CustomerRegion FROM {CUSTOMER_LOOKUP_VIEW} WHERE CustomerRegion IS NOT NULL ORDER BY CustomerRegion"
        ).fetchall() if row.CustomerRegion]

        country_codes = [row.CountryCode for row in cursor.execute(
            f"SELECT DISTINCT CountryCode FROM {CUSTOMER_LOOKUP_VIEW} WHERE CountryCode IS NOT NULL ORDER BY CountryCode"
        ).fetchall() if row.CountryCode]

        customer_statuses = [row.CustomerStatus for row in cursor.execute(
            f"SELECT DISTINCT CustomerStatus FROM {CUSTOMER_LOOKUP_VIEW} WHERE CustomerStatus IS NOT NULL ORDER BY CustomerStatus"
        ).fetchall() if row.CustomerStatus]

        return {
            "customerRegions": regions,
            "countryCodes": country_codes,
            "customerStatuses": customer_statuses,
        }
    except Exception as e:
        print(f"Lookup options error: {e}")
        return {
            "customerRegions": [],
            "countryCodes": [],
            "customerStatuses": []
        }
    finally:
        conn.close()


def fetch_billing_context_for_pricing(account_id: str | None = None) -> dict[str, Any] | None:
    """
    Fetch comprehensive pricing context from ms.vPricingContext view.
    
    This enriches the pricing algorithm with real billing data:
      - Customer attributes (type, industry, region, credit rating, status)
      - Service details (tier, name, category, included units)
      - Plan structure (recurring fees, overage pricing)
      - Billing signals (payment reliability, invoice health, discounts)
      - Usage patterns (recent volume, intensity)
    
    Returns dictionary with all billing context factors, or None if no match.
    """
    if not account_id:
        return None

    conn = get_sql_connection()
    try:
        numeric_portion = _extract_numeric_portion(account_id)
        if not numeric_portion:
            return None

        # Query the comprehensive pricing context view
        row = conn.cursor().execute(
            f"""
            SELECT TOP 1
                CustomerNumber,
                CustomerName,
                CustomerType,
                Industry,
                Region,
                CountryCode,
                CustomerStatus,
                CreditRating,
                SubscriptionNumber,
                DiscountPercent,
                SubscriptionQuantity,
                PlanTier,
                PlanName,
                IncludedUnits,
                OveragePricePerUnit,
                MonthlyBaseFee,
                MinimumCommitment,
                ServiceCode,
                ServiceName,
                ServiceCategory,
                IsUsageBased,
                IsRecurring,
                BaseListPrice,
                PaidInvoiceCount,
                TotalInvoiceCount,
                OverdueInvoiceCount,
                FailedPaymentCount,
                TotalPaymentCount,
                TotalDiscountGiven,
                TotalInvoiceAmount,
                RecentUsageVolume30Days,
                RecentUsageEventCount30Days
            FROM {PRICING_CONTEXT_VIEW}
            WHERE CustomerNumber LIKE ?
            ORDER BY CustomerNumber DESC
            """,
            f"%{numeric_portion}%",
        ).fetchone()

        if not row:
            return None

        # Calculate derived billing signals
        invoice_health_score = Decimal("1.0")
        total_invoices = int(row.TotalInvoiceCount or 0)
        if total_invoices > 0:
            paid_invoices = int(row.PaidInvoiceCount or 0)
            invoice_health_score = Decimal(paid_invoices) / Decimal(total_invoices)

        payment_reliability_score = Decimal("1.0")
        total_payments = int(row.TotalPaymentCount or 0)
        if total_payments > 0:
            failed_payments = int(row.FailedPaymentCount or 0)
            payment_reliability_score = max(
                Decimal("0"),
                (Decimal(total_payments - failed_payments) / Decimal(total_payments)),
            )

        average_discount_pct = Decimal("0")
        total_invoice_amount = _as_decimal(row.TotalInvoiceAmount) or Decimal("0")
        if total_invoice_amount > 0:
            total_discount = _as_decimal(row.TotalDiscountGiven) or Decimal("0")
            average_discount_pct = (total_discount / total_invoice_amount) * Decimal("100")

        recent_usage_volume = _as_decimal(row.RecentUsageVolume30Days) or Decimal("0")
        included_units = _as_decimal(row.IncludedUnits) or Decimal("0")

        # Calculate usage intensity
        usage_intensity = Decimal("0")
        if included_units > 0:
            usage_intensity = min(Decimal("1.0"), recent_usage_volume / included_units)

        return {
            "customerType": row.CustomerType,
            "industryType": row.Industry,
            "customerRegion": row.Region,
            "countryCode": row.CountryCode,
            "customerStatus": row.CustomerStatus,
            "creditRating": int(row.CreditRating or 0),
            "planTier": row.PlanTier,
            "planName": row.PlanName,
            "serviceName": row.ServiceName,
            "serviceCategory": row.ServiceCategory,
            "subscriptionQuantity": int(row.SubscriptionQuantity or 0),
            "discountPercent": _as_decimal(row.DiscountPercent),
            "monthlyBaseFee": _as_decimal(row.MonthlyBaseFee),
            "minimumCommitment": _as_decimal(row.MinimumCommitment),
            "includedUnits": included_units,
            "overagePricePerUnit": _as_decimal(row.OveragePricePerUnit),
            "baseListPrice": _as_decimal(row.BaseListPrice),
            "invoiceHealthScore": invoice_health_score,
            "paymentReliabilityScore": payment_reliability_score,
            "averageDiscountPct": average_discount_pct,
            "recentUsageVolume": recent_usage_volume,
            "usageIntensity": usage_intensity,
            "overdueInvoiceCount": int(row.OverdueInvoiceCount or 0),
            "totalPaymentCount": total_payments,
            "failedPaymentCount": int(row.FailedPaymentCount or 0),
            "isUsageBased": bool(row.IsUsageBased),
            "isRecurring": bool(row.IsRecurring),
        }
    except Exception:
        return None
    finally:
        conn.close()


def fetch_billing_context(payload: BillingContextInput, account_id: str | None = None) -> dict[str, Any]:
    """
    Fetch billing context for pricing algorithm.
    
    First tries to fetch comprehensive billing context from account_id.
    Falls back to query-based context if account lookup doesn't find data.
    """
    result: dict[str, Any] = {
        "dbLookupUsed": False,
        "queryType": payload.queryType,
        "executionCount": payload.executionCount,
        "avgDurationMinutes": payload.avgDurationMinutes,
        "avgCpuSeconds": payload.avgCpuSeconds,
        "avgRowCount": payload.avgRowCount,
        "rowsQueried": payload.rowsQueried,
        "rowsInserted": payload.rowsInserted,
        "rowsUpdated": payload.rowsUpdated,
        "rowsDeleted": payload.rowsDeleted,
        "rowsMerged": payload.rowsMerged,
    }

    # Try to fetch billing context from customer lookup
    if account_id:
        billing_context = fetch_billing_context_for_pricing(account_id)
        if billing_context:
            result.update(billing_context)
            result["dbLookupUsed"] = True
            return result

    # Fall back to basic payload if customer lookup didn't return data
    can_price_from_payload = any(result.get(key) is not None for key in MERGED_KEYS)
    if can_price_from_payload:
        return result

    return result
