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


def calculate_price(
    context: dict[str, Any],
    target_margin_pct: Decimal,
    manual_adjustment_pct: Decimal,
    competitor_price: Decimal | None,
    demand_index: Decimal | None,
    inventory_qty: int | None,
    cost_per_unit: Decimal | None = None,
    customer_type_input: str | None = None,
    contract_term_months: int | None = None,
) -> PricingResult:
    def add_step(name: str, before: Decimal, after: Decimal, note: str, pct: Decimal | None = None):
        breakdown.append(
            {
                "step": name,
                "before": q(before),
                "after": q(after),
                "delta": q(after - before),
                "adjustmentPct": q((pct or Decimal("0")) * Decimal("100"), "0.0001"),
                "note": note,
            }
        )

    def apply_pct_step(name: str, current_price: Decimal, pct: Decimal, note: str) -> Decimal:
        updated_price = current_price * (ONE + pct)
        add_step(name, current_price, updated_price, note, pct)
        return updated_price

    def fallback_cost_per_unit_from_context() -> Decimal:
        base_list_price = _as_decimal(context.get("baseListPrice"))
        if base_list_price and base_list_price > 0:
            return base_list_price

        avg_duration = _as_decimal(context.get("avgDurationMinutes")) or ZERO
        avg_cpu = _as_decimal(context.get("avgCpuSeconds")) or ZERO
        avg_row_count = _as_decimal(context.get("avgRowCount")) or ZERO
        rows_queried = _as_decimal(context.get("rowsQueried")) or ZERO
        rows_inserted = _as_decimal(context.get("rowsInserted")) or ZERO
        rows_updated = _as_decimal(context.get("rowsUpdated")) or ZERO
        rows_deleted = _as_decimal(context.get("rowsDeleted")) or ZERO
        rows_merged = _as_decimal(context.get("rowsMerged")) or ZERO
        execution_count = _as_decimal(context.get("executionCount")) or ZERO

        workload_units = rows_queried + (rows_inserted * Decimal("1.15")) + (rows_updated * Decimal("1.10")) + (rows_deleted * Decimal("1.05")) + (rows_merged * Decimal("1.20"))
        if workload_units == ZERO and avg_row_count > ZERO:
            workload_units = avg_row_count

        inferred_cost = (
            avg_duration * Decimal("4.50")
            + avg_cpu * Decimal("0.80")
            + workload_units * Decimal("0.0025")
            + execution_count * Decimal("0.03")
        )
        return inferred_cost if inferred_cost > ZERO else Decimal("1.00")

    breakdown: list[dict[str, str | Decimal]] = []

    qty = inventory_qty if inventory_qty is not None and inventory_qty >= 0 else int(context.get("subscriptionQuantity") or 1)
    qty = max(1, qty)
    target_margin = (_as_decimal(target_margin_pct) or Decimal("0.25")) / Decimal("100")
    target_margin = clamp(target_margin, Decimal("0"), Decimal("0.95"))
    manual_adj = (_as_decimal(manual_adjustment_pct) or ZERO) / Decimal("100")

    normalized_demand = _as_decimal(demand_index) if demand_index is not None else None
    if normalized_demand is not None:
        normalized_demand = clamp(normalized_demand, Decimal("0"), Decimal("300"))

    normalized_cost_per_unit = _as_decimal(cost_per_unit)
    if normalized_cost_per_unit is None or normalized_cost_per_unit < ZERO:
        normalized_cost_per_unit = fallback_cost_per_unit_from_context()

    if contract_term_months is None:
        fallback_term = context.get("contractTermMonths")
        contract_term_months = int(fallback_term) if fallback_term else 1
    contract_term_months = max(1, min(120, int(contract_term_months)))

    effective_customer_type = (customer_type_input or context.get("customerType") or "").strip().lower()

    cost_basis = normalized_cost_per_unit * Decimal(qty)
    add_step(
        "Cost Basis",
        ZERO,
        cost_basis,
        f"Cost per unit {q(normalized_cost_per_unit)} × quantity {qty}",
        None,
    )

    if target_margin >= ONE:
        target_margin = Decimal("0.95")
    price = cost_basis / (ONE - target_margin)
    add_step(
        "Target Margin",
        cost_basis,
        price,
        f"Applied target margin {q(target_margin * Decimal('100'), '0.0001')}%",
        None,
    )

    volume_adj = ZERO
    if qty >= 500:
        volume_adj = Decimal("-0.12")
    elif qty >= 200:
        volume_adj = Decimal("-0.08")
    elif qty >= 100:
        volume_adj = Decimal("-0.05")
    elif qty >= 50:
        volume_adj = Decimal("-0.03")
    elif qty < 10:
        volume_adj = Decimal("0.05")
    price = apply_pct_step("Volume Tier", price, volume_adj, f"Quantity tier adjustment for {qty} units")

    customer_adj = ZERO
    if effective_customer_type in {"enterprise"}:
        customer_adj = Decimal("-0.04")
    elif effective_customer_type in {"mid-market", "midmarket"}:
        customer_adj = Decimal("-0.02")
    elif effective_customer_type in {"smb", "smallbusiness", "small business"}:
        customer_adj = Decimal("0.02")
    price = apply_pct_step("Customer Type", price, customer_adj, f"Customer type '{effective_customer_type or 'unknown'}'")

    contract_adj = ZERO
    if contract_term_months >= 36:
        contract_adj = Decimal("-0.06")
    elif contract_term_months >= 24:
        contract_adj = Decimal("-0.04")
    elif contract_term_months >= 12:
        contract_adj = Decimal("-0.02")
    price = apply_pct_step("Contract Term", price, contract_adj, f"{contract_term_months} month commitment")

    if competitor_price is not None and _as_decimal(competitor_price) and _as_decimal(competitor_price) > ZERO:
        competitor = _as_decimal(competitor_price) or ZERO
        before = price
        high_band = competitor * Decimal("1.15")
        low_band = competitor * Decimal("0.85")
        if price > high_band:
            price = high_band + ((price - high_band) * Decimal("0.40"))
        elif price < low_band:
            price = low_band - ((low_band - price) * Decimal("0.40"))
        add_step("Competitor Reference", before, price, f"Soft alignment toward competitor price {q(competitor)}")
    else:
        add_step("Competitor Reference", price, price, "No competitor price provided")

    demand_adj = ZERO
    if normalized_demand is not None:
        demand_adj = (normalized_demand - Decimal("100")) / Decimal("500")
        demand_adj = clamp(demand_adj, Decimal("-0.20"), Decimal("0.20"))
    price = apply_pct_step(
        "Demand Index",
        price,
        demand_adj,
        f"Demand index {q(normalized_demand, '0.0001') if normalized_demand is not None else 'N/A'}",
    )

    price = apply_pct_step(
        "Manual Adjustment",
        price,
        manual_adj,
        f"Manual adjustment {q(manual_adj * Decimal('100'), '0.0001')}%",
    )

    recommended_price = price
    price_floor = q(max(cost_basis * Decimal("1.01"), Decimal("0.50")))
    price_ceiling = q(max(recommended_price, price_floor) * Decimal("1.60"))
    final_price = clamp(recommended_price, price_floor, price_ceiling)
    add_step("Price Guardrails", recommended_price, final_price, f"Applied floor {price_floor} and ceiling {price_ceiling}")

    expected_margin_pct = ZERO
    if final_price > ZERO:
        expected_margin_pct = ((final_price - cost_basis) / final_price) * Decimal("100")

    score = Decimal("0.70")
    if expected_margin_pct >= (target_margin * Decimal("100")):
        score += Decimal("0.10")
    if customer_adj < ZERO:
        score += Decimal("0.03")
    if contract_adj < ZERO:
        score += Decimal("0.02")
    if normalized_demand is not None:
        score += Decimal("0.04")
    if competitor_price is not None:
        score += Decimal("0.03")
    if context.get("dbLookupUsed"):
        score += Decimal("0.03")
    score = clamp(score, ZERO, Decimal("0.99"))

    explanation = (
        f"Pricing starts from cost per unit ({q(normalized_cost_per_unit)}) and quantity ({qty}), "
        f"then applies target margin, volume tier, customer type ({effective_customer_type or 'unknown'}), "
        f"contract term ({contract_term_months} months), competitor reference, demand index, and manual adjustment in sequence."
    )

    return PricingResult(
        recommendedPrice=q(recommended_price),
        expectedMarginPct=q(expected_margin_pct, "0.0001"),
        priceFloor=q(price_floor),
        priceCeiling=q(price_ceiling),
        finalPrice=q(final_price),
        score=q(score, "0.0001"),
        pricingMessage="Business-driven pricing recommendation generated successfully.",
        pricingExplanation=explanation,
        pricingBreakdown=breakdown,
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
            "inventoryQtyInput": qty,
            "costPerUnitInput": str(normalized_cost_per_unit),
            "customerTypeInput": effective_customer_type or None,
            "contractTermMonthsInput": contract_term_months,
        },
    )
