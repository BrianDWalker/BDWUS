import os
from uuid import UUID

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.database import SQL_DATABASE, SQL_SERVER, get_sql_connection
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
from app.services.assistant import (
    approve_change_request,
    chat,
    ensure_ai_storage,
    get_change_request,
    get_github_branches,
    get_github_commits,
    get_github_file,
    get_github_tree,
    list_ui_overrides,
    reject_change_request,
)
from app.services.context import BILLING_CONTEXT_OBJECT, get_customer_metadata_options, lookup_customer_profile
from app.services.customer_service import router as customer_service_router
from app.services.ops import admin_router, billing_workflow_router, ensure_ops_storage, ops_router
from app.services.ops_write import admin_write_router, billing_write_router, ops_write_router
from app.services.platform import router as platform_router
from app.services.quotes import (
    create_quote,
    get_opportunity_details,
    get_opportunity_latest,
    get_quote_history,
    list_opportunities,
    reprice_opportunity,
    revise_quote,
)
from app.services.sales import billing_router, init_sales, router as sales_router, sales_dashboard
from app.services.sales_compat import router as sales_compat_router
from app.services.smoke_data import smoke_mode_enabled


SERVICE_NAME = os.getenv("PLATFORM_API_SERVICE_NAME", "BDWUS Platform API")
SERVICE_VERSION = os.getenv("PLATFORM_API_VERSION", "5.0.0")
DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


app = FastAPI(
    title=SERVICE_NAME,
    version=SERVICE_VERSION,
    description="Telecom platform API for pricing, assistant workflows, sales storage, and Azure SQL-backed portal services.",
)


def parse_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS)
    if raw.strip() == "*":
        return ["*"]
    return [item.strip() for item in raw.split(",") if item.strip()]


allowed_origins = parse_allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False if allowed_origins == ["*"] else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compatibility routes must be registered before the full sales router because they preserve
# migrated UI flows for routes that existed conceptually before the API-backed sales module.
app.include_router(sales_compat_router)
app.include_router(sales_router)
app.include_router(billing_router)
app.include_router(platform_router)
app.include_router(customer_service_router)
app.include_router(ops_router)
app.include_router(admin_router)
app.include_router(billing_workflow_router)
app.include_router(ops_write_router)
app.include_router(admin_write_router)
app.include_router(billing_write_router)


@app.on_event("startup")
def startup_assistant_storage():
    if smoke_mode_enabled():
        return
    ensure_ai_storage()
    init_sales()
    ensure_ops_storage()


@app.get("/")
def root():
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "status": "ok",
        "sqlServer": SQL_SERVER,
        "sqlDatabase": SQL_DATABASE,
        "billingContextObject": BILLING_CONTEXT_OBJECT,
        "modules": {
            "assistant": True,
            "sales": True,
            "pricing": True,
            "billing": True,
            "platform": True,
            "customerService": True,
            "operations": True,
            "administration": True,
            "billingWorkflows": True,
        },
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "allowedOrigins": allowed_origins,
    }


@app.get("/health/ready")
def ready():
    if smoke_mode_enabled():
        return {
            "status": "healthy",
            "checks": {
                "sql": True,
                "pricingContext": True,
                "assistantStorage": True,
                "salesStorage": True,
                "opsStorage": True,
            },
            "details": {
                "mode": "PLATFORM_RUNTIME_SMOKE_MODE",
                "sqlServer": SQL_SERVER,
                "sqlDatabase": SQL_DATABASE,
                "billingContextObject": BILLING_CONTEXT_OBJECT,
                "errors": [],
            },
        }
    checks = {
        "sql": False,
        "pricingContext": False,
        "assistantStorage": False,
        "salesStorage": False,
        "opsStorage": False,
    }
    details = {
        "sqlServer": SQL_SERVER,
        "sqlDatabase": SQL_DATABASE,
        "billingContextObject": BILLING_CONTEXT_OBJECT,
        "errors": [],
    }

    try:
        conn = get_sql_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 AS Healthy")
            cursor.fetchone()
            checks["sql"] = True

            cursor.execute(f"SELECT TOP 1 1 AS Healthy FROM {BILLING_CONTEXT_OBJECT}")
            checks["pricingContext"] = cursor.fetchone() is not None

            cursor.execute("SELECT 1 AS Healthy FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'ai' AND TABLE_NAME = 'ChangeRequests'")
            checks["assistantStorage"] = cursor.fetchone() is not None

            cursor.execute("SELECT 1 AS Healthy FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'ms' AND TABLE_NAME = 'Leads'")
            checks["salesStorage"] = cursor.fetchone() is not None

            cursor.execute("SELECT 1 AS Healthy FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'ops' AND TABLE_NAME = 'Orders'")
            checks["opsStorage"] = cursor.fetchone() is not None
        finally:
            conn.close()
    except Exception as exc:
        details["errors"].append(str(exc))

    return {
        "status": "healthy" if all(checks.values()) else "degraded",
        "checks": checks,
        "details": details,
    }


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


@app.post("/opportunities/{opportunity_id}/reprice", response_model=QuoteCreateResponse)
def opportunity_reprice(opportunity_id: UUID):
    return reprice_opportunity(opportunity_id)


@app.get("/customers/options", response_model=CustomerMetadataOptionsResponse)
def customer_options():
    return get_customer_metadata_options()


@app.get("/customers/{customer_number}", response_model=CustomerProfileResponse)
def customer_lookup(customer_number: str):
    customer = lookup_customer_profile(customer_number)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found in context view")
    return customer


@app.post("/assistant/chat", response_model=AssistantChatResponse)
def assistant_chat(request: AssistantChatRequest):
    return chat(request)


@app.get("/assistant/ui-overrides", response_model=list[AssistantUiOverride])
def assistant_ui_overrides(page: str | None = None, slot: str | None = None):
    return list_ui_overrides(page=page, slot=slot)


@app.post("/assistant/change-requests")
def assistant_change_request(request: AssistantChangeRequest):
    return get_change_request(request)


@app.post("/assistant/change-requests/{change_id}/approve")
def assistant_approve_change(change_id: UUID, request: AssistantApprovalRequest):
    return approve_change_request(change_id, request)


@app.post("/assistant/change-requests/{change_id}/reject")
def assistant_reject_change(change_id: UUID, request: AssistantApprovalRequest):
    return reject_change_request(change_id, request)


@app.get("/assistant/github/branches")
def assistant_github_branches():
    return get_github_branches()


@app.get("/assistant/github/tree")
def assistant_github_tree(ref: str = "main"):
    return get_github_tree(ref)


@app.get("/assistant/github/file")
def assistant_github_file(path: str, ref: str = "main"):
    return get_github_file(path, ref)


@app.get("/assistant/github/commits")
def assistant_github_commits(branch: str = "main", limit: int = 20):
    return get_github_commits(branch, limit)
