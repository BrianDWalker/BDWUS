import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from uuid import UUID

from app.database import SQL_DATABASE, SQL_SERVER
from app.models import (
    CustomerMetadataOptionsResponse,
    CustomerProfileResponse,
    OpportunityDetailsResponse,
    OpportunityListItem,
    QuoteCreateRequest,
    QuoteCreateResponse,
    QuoteReviseRequest,
)
from app.services.context import BILLING_CONTEXT_OBJECT, get_customer_metadata_options, lookup_customer_profile
from app.services.quotes import (
    create_quote,
    get_opportunity_details,
    get_opportunity_latest,
    get_quote_history,
    list_opportunities,
    reprice_opportunity,
    revise_quote,
)


app = FastAPI(
    title="Billing Pricing Microservice",
    version="4.0.0",
    description="Quote pricing API backed by Azure SQL using billing-style query history data.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "Billing Pricing Microservice",
        "version": "4.0.0",
        "status": "ok",
        "sqlServer": SQL_SERVER,
        "sqlDatabase": SQL_DATABASE,
        "billingContextObject": BILLING_CONTEXT_OBJECT,
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/health/pricing-context")
def health_pricing_context():
    from app.database import get_sql_connection

    conn = get_sql_connection()
    try:
        row = conn.cursor().execute(f"SELECT TOP 1 * FROM {BILLING_CONTEXT_OBJECT}").fetchone()
        return {
            "status": "healthy",
            "billingContextObject": BILLING_CONTEXT_OBJECT,
            "sampleRowFound": row is not None,
        }
    finally:
        conn.close()


@app.post("/quotes", response_model=QuoteCreateResponse)
def post_quote(request: QuoteCreateRequest):
    return create_quote(request)


@app.post("/quotes/{quote_id}/reprice", response_model=QuoteCreateResponse)
def post_quote_reprice(quote_id: UUID, request: QuoteReviseRequest):
    return revise_quote(quote_id, request)


@app.get("/quotes/{quote_id}/history")
def quote_history(quote_id: UUID):
    return get_quote_history(quote_id)


@app.get("/opportunities/{opportunity_id}")
def opportunity_latest(opportunity_id: UUID):
    return get_opportunity_latest(opportunity_id)


@app.get("/opportunities", response_model=list[OpportunityListItem])
def opportunities():
    return list_opportunities()


@app.get("/opportunities/{opportunity_id}/details", response_model=OpportunityDetailsResponse)
def opportunity_details(opportunity_id: UUID):
    return get_opportunity_details(opportunity_id)


@app.get("/customers/{customer_number}", response_model=CustomerProfileResponse)
def customer_profile(customer_number: str):
    profile = lookup_customer_profile(customer_number)
    if not profile:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return profile


@app.get("/accounts/{account_id}", response_model=CustomerProfileResponse)
def account_profile(account_id: str):
    return customer_profile(account_id)


@app.get("/billing/lookup-options", response_model=CustomerMetadataOptionsResponse)
def billing_lookup_options():
    return get_customer_metadata_options()


@app.post("/opportunities/{opportunity_id}/reprice", response_model=QuoteCreateResponse)
def opportunity_reprice(opportunity_id: UUID, request: QuoteReviseRequest):
    return reprice_opportunity(opportunity_id, request)
