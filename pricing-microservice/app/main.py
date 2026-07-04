import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from uuid import UUID

from app.database import SQL_DATABASE, SQL_SERVER
from app.models import (
    AssistantApprovalRequest,
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantChangeRequest,
    AssistantUiOverride,
    CustomerMetadataOptionsResponse,
    CustomerProfileResponse,
    OpportunityDetailsResponse,
    OpportunityListItem,
    QuoteCreateRequest,
    QuoteCreateResponse,
    QuoteReviseRequest,
)
from app.services.context import BILLING_CONTEXT_OBJECT, get_customer_metadata_options, lookup_customer_profile
from app.services.assistant import (
    approve_change_request,
    chat,
    ensure_ai_storage,
    get_github_branches,
    get_github_file,
    get_github_tree,
    get_change_request,
    list_ui_overrides,
    reject_change_request,
)
from app.services.sales import billing_router, init_sales, router as sales_router
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

app.include_router(sales_router)
app.include_router(billing_router)


@app.on_event("startup")
def startup_assistant_storage():
    ensure_ai_storage()
    init_sales()


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


@app.get("/health/assistant")
def health_assistant():
    return {
        "status": "healthy",
        "sqlServer": SQL_SERVER,
        "sqlDatabase": SQL_DATABASE,
        "assistantStorage": "ready",
    }


@app.get("/health/sales")
def health_sales():
    from app.services.sales import sales_dashboard

    dashboard = sales_dashboard()
    return {
        "status": "healthy",
        "sqlServer": SQL_SERVER,
        "sqlDatabase": SQL_DATABASE,
        "salesStorage": "ready",
        "leadCount": dashboard.get("LeadCount", 0),
        "opportunityCount": dashboard.get("OpportunityCount", 0),
        "quoteCount": dashboard.get("QuoteCount", 0),
    }


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


@app.post("/api/assistant/chat", response_model=AssistantChatResponse)
def assistant_chat(request: AssistantChatRequest):
    return chat(request)


@app.get("/api/assistant/change-requests/{change_request_id}", response_model=AssistantChangeRequest)
def assistant_change_request(change_request_id: UUID):
    record = get_change_request(change_request_id)
    if not record:
        raise HTTPException(status_code=404, detail="Change request not found.")
    return record


@app.post("/api/assistant/change-requests/{change_request_id}/approve", response_model=AssistantChangeRequest)
def assistant_approve_change_request(change_request_id: UUID, request: AssistantApprovalRequest):
    try:
        return approve_change_request(change_request_id, request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/assistant/change-requests/{change_request_id}/reject", response_model=AssistantChangeRequest)
def assistant_reject_change_request(change_request_id: UUID, request: AssistantApprovalRequest):
    try:
        return reject_change_request(change_request_id, request.approvedBy or "admin")
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/api/assistant/ui-overrides", response_model=list[AssistantUiOverride])
def assistant_ui_overrides(scope: str = "knowledge"):
    return list_ui_overrides(scope)


@app.get("/api/assistant/github/branches")
def assistant_github_branches(repository: str):
    try:
        return get_github_branches(repository)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/assistant/github/tree")
def assistant_github_tree(repository: str, branch: str, path: str = ""):
    try:
        return get_github_tree(repository, branch, path)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/assistant/github/file")
def assistant_github_file(repository: str, branch: str, path: str):
    try:
        return get_github_file(repository, branch, path)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
