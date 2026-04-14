from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from app.models import PricingResult


ZERO = Decimal("0")
ONE = Decimal("1")


def _as_decimal(value: Any) -> Decimal | None:
    """Convert any value to a Decimal, handling None and strings."""
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def q(value: Decimal | float | int | None, places: str = "0.01") -> Decimal:
    if value is None:
        return ZERO
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(Decimal(places), rounding=ROUND_HALF_UP)


def clamp(value: Decimal, min_value: Decimal, max_value: Decimal) -> Decimal:
    return max(min_value, min(value, max_value))


def calculate_price(context: dict[str, Any], target_margin_pct: Decimal, manual_adjustment_pct: Decimal,
                    competitor_price: Decimal | None, demand_index: Decimal | None,
                    inventory_qty: int | None) -> PricingResult:
    # Extract query/performance metrics
    avg_duration = _as_decimal(context.get("avgDurationMinutes")) or Decimal("0")
    avg_cpu = _as_decimal(context.get("avgCpuSeconds")) or Decimal("0")
    avg_row_count = _as_decimal(context.get("avgRowCount")) or Decimal("0")
    rows_inserted = _as_decimal(context.get("rowsInserted")) or Decimal("0")
    rows_updated = _as_decimal(context.get("rowsUpdated")) or Decimal("0")
    rows_deleted = _as_decimal(context.get("rowsDeleted")) or Decimal("0")
    rows_merged = _as_decimal(context.get("rowsMerged")) or Decimal("0")
    rows_queried = _as_decimal(context.get("rowsQueried")) or Decimal("0")
    execution_count = _as_decimal(context.get("executionCount")) or Decimal("0")
    
    # Extract billing context signals
    invoice_health_score = _as_decimal(context.get("invoiceHealthScore")) or Decimal("1.0")
    payment_reliability_score = _as_decimal(context.get("paymentReliabilityScore")) or Decimal("1.0")
    average_discount_pct = _as_decimal(context.get("averageDiscountPct")) or Decimal("0")
    recent_usage_volume = _as_decimal(context.get("recentUsageVolume")) or Decimal("0")
    usage_intensity = _as_decimal(context.get("usageIntensity")) or Decimal("0")
    overdueInvoiceCount = context.get("overdueInvoiceCount") or 0
    failedPaymentCount = context.get("failedPaymentCount") or 0

    workload_units = rows_queried + (rows_inserted * Decimal("1.15")) + (rows_updated * Decimal("1.10")) + (rows_deleted * Decimal("1.05")) + (rows_merged * Decimal("1.20"))
    if workload_units == 0 and avg_row_count > 0:
        workload_units = avg_row_count

    base_cost = (
        avg_duration * Decimal("4.50")
        + avg_cpu * Decimal("0.80")
        + workload_units * Decimal("0.0025")
        + execution_count * Decimal("0.03")
    )

    duration_adj = Decimal("0")
    if avg_duration >= Decimal("10"):
        duration_adj += Decimal("0.10")
    elif avg_duration >= Decimal("3"):
        duration_adj += Decimal("0.04")
    elif avg_duration <= Decimal("0.50"):
        duration_adj -= Decimal("0.03")

    demand_adj = Decimal("0")
    if demand_index is not None:
        demand_index = Decimal(str(demand_index))
        if demand_index >= Decimal("120"):
            demand_adj += Decimal("0.06")
        elif demand_index >= Decimal("105"):
            demand_adj += Decimal("0.03")
        elif demand_index <= Decimal("80"):
            demand_adj -= Decimal("0.05")
        elif demand_index <= Decimal("95"):
            demand_adj -= Decimal("0.02")

    inventory_adj = Decimal("0")
    if inventory_qty is not None:
        if inventory_qty <= 10:
            inventory_adj += Decimal("0.05")
        elif inventory_qty <= 25:
            inventory_adj += Decimal("0.02")
        elif inventory_qty >= 250:
            inventory_adj -= Decimal("0.03")
        elif inventory_qty >= 100:
            inventory_adj -= Decimal("0.01")

    query_type_adj = Decimal("0")
    query_type = (context.get("queryType") or "").upper()
    if query_type in {"MERGE", "BULK INSERT"}:
        query_type_adj += Decimal("0.06")
    elif query_type in {"INSERT", "UPDATE", "DELETE"}:
        query_type_adj += Decimal("0.03")
    elif query_type == "SELECT":
        query_type_adj -= Decimal("0.01")

    customer_adj = Decimal("0")
    customer_status = (context.get("customerStatus") or "").lower()
    if customer_status == "active":
        credit_rating = Decimal(str(context.get("creditRating") or 0))
        if credit_rating >= Decimal("750"):
            customer_adj -= Decimal("0.05")
        elif credit_rating >= Decimal("700"):
            customer_adj -= Decimal("0.02")
        elif credit_rating < Decimal("620"):
            customer_adj += Decimal("0.06")
    elif customer_status in {"suspended", "churned"}:
        customer_adj += Decimal("0.12")

    customer_type = (context.get("customerType") or "").lower()
    if customer_type == "enterprise":
        customer_adj -= Decimal("0.02")
    elif customer_type == "smallbusiness":
        customer_adj += Decimal("0.01")

    service_adj = Decimal("0")
    service_category = (context.get("serviceCategory") or "").lower()
    if service_category in {"ai", "analytics", "dataops"}:
        service_adj += Decimal("0.05")
    elif service_category == "storage":
        service_adj += Decimal("0.02")

    plan_adj = Decimal("0")
    plan_tier = (context.get("planTier") or "").lower()
    if plan_tier in {"enterprise", "pro"}:
        plan_adj += Decimal("0.06")
    elif plan_tier == "standard":
        plan_adj += Decimal("0.02")
    elif plan_tier == "basic":
        plan_adj -= Decimal("0.02")

    discount_adj = Decimal("0")
    if average_discount_pct >= Decimal("20"):
        discount_adj += Decimal("0.08")
    elif average_discount_pct >= Decimal("15"):
        discount_adj += Decimal("0.05")
    elif average_discount_pct >= Decimal("10"):
        discount_adj += Decimal("0.03")
    elif average_discount_pct <= Decimal("2"):
        discount_adj -= Decimal("0.02")

    payment_adj = Decimal("0")
    if payment_reliability_score < Decimal("0.70"):
        payment_adj += Decimal("0.08")
    elif payment_reliability_score < Decimal("0.85"):
        payment_adj += Decimal("0.04")
    elif payment_reliability_score >= Decimal("0.95"):
        payment_adj -= Decimal("0.02")
    
    # Risk adjustment based on overdue invoices
    if overdueInvoiceCount > 2:
        payment_adj += Decimal("0.05")
    elif overdueInvoiceCount > 0:
        payment_adj += Decimal("0.02")
    
    # Risk adjustment based on failed payments
    if failedPaymentCount > 1:
        payment_adj += Decimal("0.04")
    elif failedPaymentCount > 0:
        payment_adj += Decimal("0.02")

    usage_adj = Decimal("0")
    if recent_usage_volume >= Decimal("100000"):
        usage_adj += Decimal("0.06")
    elif recent_usage_volume >= Decimal("50000"):
        usage_adj += Decimal("0.04")
    elif recent_usage_volume >= Decimal("25000"):
        usage_adj += Decimal("0.03")
    elif recent_usage_volume <= Decimal("5000") and recent_usage_volume > 0:
        usage_adj -= Decimal("0.02")
    
    # Intensity adjustment - higher intensity means higher compute demands
    if usage_intensity >= Decimal("0.8"):
        usage_adj += Decimal("0.04")
    elif usage_intensity >= Decimal("0.5"):
        usage_adj += Decimal("0.02")
    
    # Invoice health adjustment - reflects customer's billing payment consistency  
    invoice_health_adj = Decimal("0")
    if invoice_health_score < Decimal("0.60"):
        invoice_health_adj += Decimal("0.06")
    elif invoice_health_score < Decimal("0.80"):
        invoice_health_adj += Decimal("0.03")
    elif invoice_health_score == Decimal("1.0"):
        invoice_health_adj -= Decimal("0.02")

    manual_adj = (_as_decimal(manual_adjustment_pct) or Decimal("0")) / Decimal("100")
    target_margin = _as_decimal(target_margin_pct) / Decimal("100")
    if target_margin >= Decimal("0.99"):
        target_margin = Decimal("0.99")

    multiplier = ONE + duration_adj + demand_adj + inventory_adj + query_type_adj + customer_adj + service_adj + plan_adj + discount_adj + payment_adj + usage_adj + invoice_health_adj + manual_adj
    estimated_cost = base_cost * multiplier
    recommended_price = estimated_cost / (ONE - target_margin) if target_margin < ONE else estimated_cost

    competitor_floor = ZERO
    competitor_cap = Decimal("999999999.99")
    if competitor_price is not None and Decimal(str(competitor_price)) > 0:
        competitor = Decimal(str(competitor_price))
        competitor_floor = competitor * Decimal("0.97")
        competitor_cap = competitor * Decimal("1.03")
        recommended_price = clamp(recommended_price, competitor_floor, competitor_cap)

    price_floor = max(q(base_cost * Decimal("1.05")), q(Decimal("1.00")))
    price_ceiling = q(max(recommended_price, price_floor) * Decimal("1.20"))
    final_price = clamp(recommended_price, price_floor, price_ceiling)

    expected_margin_pct = ZERO
    if final_price > 0:
        expected_margin_pct = ((final_price - base_cost) / final_price) * Decimal("100")

    score = Decimal("0.68")
    if expected_margin_pct >= Decimal(str(target_margin_pct)):
        score += Decimal("0.10")
    if avg_duration > 0:
        score += Decimal("0.03")
    if execution_count > 0:
        score += Decimal("0.03")
    if competitor_price is not None:
        score += Decimal("0.04")
    if demand_index is not None:
        score += Decimal("0.04")
    if inventory_qty is not None:
        score += Decimal("0.03")
    if context.get("dbLookupUsed"):
        score += Decimal("0.03")
    score = clamp(score, ZERO, Decimal("0.99"))

    explanation = (
        f"Calculated from billing customer context. "
        f"Customer '{context.get('customerName')}', type '{context.get('customerType')}', "
        f"industry '{context.get('industryType')}', region '{context.get('customerRegion')}', "
        f"status '{context.get('customerStatus')}' (credit rating {context.get('creditRating')}). "
        f"Service '{context.get('serviceName')}' category '{context.get('serviceCategory')}', "
        f"plan '{context.get('planName')}' tier '{context.get('planTier')}'. "
        f"Query type '{context.get('queryType')}' with {q(execution_count, '0.01')} executions, "
        f"avg duration {q(avg_duration, '0.0001')} min, avg CPU {q(avg_cpu, '0.0001')} sec, "
        f"rows queried {q(rows_queried, '0.01')}, inserted {q(rows_inserted, '0.01')}, "
        f"updated {q(rows_updated, '0.01')}, deleted {q(rows_deleted, '0.01')}, merged {q(rows_merged, '0.01')}. "
        f"Billing signals: Invoice health {q(invoice_health_score, '0.01')}, "
        f"payment reliability {q(payment_reliability_score, '0.01')}, avg discount {q(average_discount_pct, '0.01')}%, "
        f"recent usage {q(recent_usage_volume, '0.01')} units, usage intensity {q(usage_intensity, '0.01')}. "
        f"Market signals: demand index {demand_index}, inventory {inventory_qty}."
    )

    return PricingResult(
        recommendedPrice=q(recommended_price),
        expectedMarginPct=q(expected_margin_pct, "0.0001"),
        priceFloor=q(price_floor),
        priceCeiling=q(price_ceiling),
        finalPrice=q(final_price),
        score=q(score, "0.0001"),
        pricingMessage="Billing-based pricing recommendation generated successfully.",
        pricingExplanation=explanation,
        dbLookupUsed=bool(context.get("dbLookupUsed")),
        inputsSummary={
            "queryType": context.get("queryType"),
            "executionCount": context.get("executionCount"),
            "avgDurationMinutes": context.get("avgDurationMinutes"),
            "avgCpuSeconds": context.get("avgCpuSeconds"),
            "avgRowCount": context.get("avgRowCount"),
            "rowsQueried": context.get("rowsQueried"),
            "rowsInserted": context.get("rowsInserted"),
            "rowsUpdated": context.get("rowsUpdated"),
            "rowsDeleted": context.get("rowsDeleted"),
            "rowsMerged": context.get("rowsMerged"),
            "targetMarginPctInput": str(target_margin_pct),
            "manualAdjustmentPctInput": str(manual_adjustment_pct),
            "competitorPriceInput": None if competitor_price is None else str(competitor_price),
            "demandIndexInput": None if demand_index is None else str(demand_index),
            "inventoryQtyInput": inventory_qty,
        },
    )
