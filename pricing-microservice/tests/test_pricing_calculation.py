from decimal import Decimal
import pytest
from pydantic import ValidationError
from app.models import PricingInput, QuoteCreateRequest
from app.services.pricing import calculate_price, q


def price(**overrides):
    args = dict(context={}, target_margin_pct=Decimal(25), manual_adjustment_pct=Decimal(0), competitor_price=None, demand_index=None, inventory_qty=10, cost_per_unit=Decimal(10))
    args.update(overrides)
    return calculate_price(**args)


def test_target_margin_price_and_rounding():
    result = price()
    assert result.finalPrice == Decimal("133.33")
    assert result.priceFloor == Decimal("101.00")
    assert q(Decimal("1.005")) == Decimal("1.01")


def test_discount_cannot_price_below_cost_floor():
    result = price(manual_adjustment_pct=Decimal(-100))
    assert result.finalPrice == result.priceFloor == Decimal("101.00")


def test_large_volume_discount_changes_price():
    result = price(inventory_qty=500)
    assert result.finalPrice == Decimal("5866.67")


@pytest.mark.parametrize("fields", [
    {"targetMarginPctInput": -1}, {"targetMarginPctInput": 101},
    {"targetMarginPctInput": 25, "costPerUnitInput": -1},
    {"targetMarginPctInput": 25, "contractTermMonthsInput": 121},
])
def test_invalid_pricing_requests_are_rejected(fields):
    with pytest.raises(ValidationError):
        PricingInput(**fields)


def test_quote_request_requires_opportunity_and_context():
    with pytest.raises(ValidationError):
        QuoteCreateRequest(pricingInput={"targetMarginPctInput": 25})
