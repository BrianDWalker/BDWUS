"""Read real billing facts through reviewed SQL views; never fabricate data."""
import logging
from fastapi import APIRouter, HTTPException, Query
import pyodbc
from app.services.sql_access import fetch_all

router = APIRouter(prefix="/api/billing-facts", tags=["billing-facts"])
VIEWS = {"subscriptions": "billing.vPortalSubscriptions", "payments": "billing.vPortalPayments", "usage": "billing.vPortalUsage"}


@router.get("/{resource}")
def list_facts(resource: str, limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)):
    view = VIEWS.get(resource)
    if view is None:
        raise HTTPException(status_code=404, detail="Unknown billing resource")
    try:
        return fetch_all(f"SELECT * FROM {view} ORDER BY RecordId OFFSET ? ROWS FETCH NEXT ? ROWS ONLY", (offset, limit))
    except pyodbc.Error:
        logging.getLogger(__name__).warning("Billing facts query unavailable: %s", resource)
        raise HTTPException(status_code=503, detail=f"{resource.title()} data is unavailable. The billing schema needs owner review or the database is paused.") from None
