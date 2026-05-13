from uuid import UUID, uuid4

from fastapi import HTTPException

from app.database import get_sql_connection
from app.models import (
    OpportunityDetailsResponse,
    OpportunityListItem,
    OpportunityLatestResponse,
    QuoteCreateRequest,
    QuoteCreateResponse,
    QuoteHistoryRecord,
    QuoteReviseRequest,
)
from app.services.context import fetch_billing_context, lookup_customer_profile
from app.services.pricing import calculate_price


def _normalize_customer_status(status_value: str | None) -> str:
    value = (status_value or "").strip()
    if not value:
        return "New Customer"
    if value.lower() in {"churn", "churned"}:
        return "Returning Customer"
    return value


def _get_opportunity_table_columns(conn) -> set[str]:
    rows = conn.cursor().execute(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'ms' AND TABLE_NAME = 'Opportunity'
        """
    ).fetchall()
    return {str(row.COLUMN_NAME) for row in rows}


def _get_quote_history_table_columns(conn) -> set[str]:
    rows = conn.cursor().execute(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'ms' AND TABLE_NAME = 'QuoteHistory'
        """
    ).fetchall()
    return {str(row.COLUMN_NAME) for row in rows}


def _first_non_empty(*values):
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _build_opportunity_insert_data(request: QuoteCreateRequest, quote_id: UUID) -> dict[str, object]:
    profile = lookup_customer_profile(request.opportunity.accountId) if request.opportunity.accountId else None

    return {
        "OpportunityId": str(request.opportunity.opportunityId or uuid4()),
        "OpportunityNumber": request.opportunity.opportunityNumber,
        "OpportunityName": request.opportunity.opportunityName,
        "AccountId": request.opportunity.accountId,
        "AccountName": request.opportunity.accountName,
        "Status": request.opportunity.status,
        "CurrentQuoteId": str(quote_id),
        "CurrentQuoteVersionNo": 1,
        "LatestPriceAmount": None,  # populated later in create_quote
        "LatestMarginPct": None,    # populated later in create_quote
        "LatestScore": None,        # populated later in create_quote
        "CreatedBy": request.opportunity.changedBy,
        "ModifiedBy": request.opportunity.changedBy,
        "CustomerType": _first_non_empty(request.opportunity.customerType, profile.get("customerType") if profile else None),
        "IndustryType": _first_non_empty(request.opportunity.industryType, profile.get("industryType") if profile else None),
        "CustomerRegion": _first_non_empty(request.opportunity.customerRegion, profile.get("customerRegion") if profile else None),
        "CountryCode": _first_non_empty(request.opportunity.countryCode, profile.get("countryCode") if profile else None),
        "CustomerStatus": _normalize_customer_status(
            _first_non_empty(request.opportunity.customerStatus, profile.get("customerStatus") if profile else None)
        ),
        "CreditRating": _first_non_empty(request.opportunity.creditRating, profile.get("creditRating") if profile else None),
        "PlanTier": _first_non_empty(request.opportunity.planTier),
        "PlanName": _first_non_empty(request.opportunity.planName),
        "ServiceName": _first_non_empty(request.opportunity.serviceName),
        "ServiceCategory": _first_non_empty(request.opportunity.serviceCategory),
        "ContractTermMonths": _first_non_empty(
            request.opportunity.contractTermMonths,
            request.pricingInput.contractTermMonthsInput,
        ),
        "SubscriptionQuantity": _first_non_empty(
            request.opportunity.subscriptionQuantity,
            request.pricingInput.inventoryQtyInput,
        ),
    }


def _build_quote_history_insert_data(
    quote_id: UUID,
    opportunity_id: UUID,
    change_type: str,
    context: dict,
    request: QuoteCreateRequest | QuoteReviseRequest,
    pricing,
    changed_by: str | None,
) -> dict[str, object]:
    return {
        "QuoteId": str(quote_id),
        "OpportunityId": str(opportunity_id),
        "VersionNo": 1,
        "ChangeType": change_type,
        "IsCurrentVersion": 1,
        "ExecutionCount": context.get("executionCount"),
        "AvgDurationMinutes": context.get("avgDurationMinutes"),
        "AvgCpuSeconds": context.get("avgCpuSeconds"),
        "AvgRowCount": context.get("avgRowCount"),
        "RowsQueried": context.get("rowsQueried"),
        "RowsInserted": context.get("rowsInserted"),
        "RowsUpdated": context.get("rowsUpdated"),
        "RowsDeleted": context.get("rowsDeleted"),
        "RowsMerged": context.get("rowsMerged"),
        "TargetMarginPctInput": request.pricingInput.targetMarginPctInput,
        "ManualAdjustmentPctInput": request.pricingInput.manualAdjustmentPctInput,
        "CompetitorPriceInput": request.pricingInput.competitorPriceInput,
        "DemandIndexInput": request.pricingInput.demandIndexInput,
        "InventoryQtyInput": request.pricingInput.inventoryQtyInput,
        "CostPerUnitInput": request.pricingInput.costPerUnitInput,
        "CustomerTypeInput": request.pricingInput.customerTypeInput,
        "ContractTermMonthsInput": request.pricingInput.contractTermMonthsInput,
        "RecommendedPrice": pricing.recommendedPrice,
        "ExpectedMarginPct": pricing.expectedMarginPct,
        "PriceFloor": pricing.priceFloor,
        "PriceCeiling": pricing.priceCeiling,
        "FinalPrice": pricing.finalPrice,
        "Score": pricing.score,
        "PricingMessage": pricing.pricingMessage,
        "PricingExplanation": pricing.pricingExplanation,
        "ChangedBy": changed_by,
    }


def _insert_quote_history_row(conn, payload: dict[str, object]):
    available_columns = _get_quote_history_table_columns(conn)
    preferred_columns = [
        "QuoteId",
        "OpportunityId",
        "VersionNo",
        "ChangeType",
        "IsCurrentVersion",
        "ExecutionCount",
        "AvgDurationMinutes",
        "AvgCpuSeconds",
        "AvgRowCount",
        "RowsQueried",
        "RowsInserted",
        "RowsUpdated",
        "RowsDeleted",
        "RowsMerged",
        "TargetMarginPctInput",
        "ManualAdjustmentPctInput",
        "CompetitorPriceInput",
        "DemandIndexInput",
        "InventoryQtyInput",
        "CostPerUnitInput",
        "CustomerTypeInput",
        "ContractTermMonthsInput",
        "RecommendedPrice",
        "ExpectedMarginPct",
        "PriceFloor",
        "PriceCeiling",
        "FinalPrice",
        "Score",
        "PricingMessage",
        "PricingExplanation",
        "ChangedBy",
    ]
    selected_columns = [column for column in preferred_columns if column in available_columns]
    values = [payload.get(column) for column in selected_columns]

    conn.cursor().execute(
        f"""
        INSERT INTO ms.QuoteHistory
        (
            {", ".join(selected_columns)}
        )
        VALUES ({", ".join(["?"] * len(selected_columns))})
        """,
        *values,
    )


# Connection Management Notes:
# - Each function manages its own connection lifecycle (open in function, close in finally)
# - Functions that call other functions with DB queries pass the connection to avoid multiple opens
# - This pattern reduces lock timeout risk from repeated connection open/close cycles
# - See get_opportunity_latest() and get_opportunity_details() for the connection reuse pattern


def create_quote(request: QuoteCreateRequest) -> QuoteCreateResponse:
    quote_id = uuid4()
    opportunity_seed = _build_opportunity_insert_data(request, quote_id)
    opportunity_id = UUID(str(opportunity_seed["OpportunityId"]))

    # Use the entered account/customer number when building the pricing context.
    # This makes the pricing algorithm customer-aware by using the numeric portion
    # of the account number and looking up matching billing metadata.
    context = fetch_billing_context(request.billingContext, request.opportunity.accountId)
    pricing = calculate_price(
        context=context,
        target_margin_pct=request.pricingInput.targetMarginPctInput,
        manual_adjustment_pct=request.pricingInput.manualAdjustmentPctInput,
        competitor_price=request.pricingInput.competitorPriceInput,
        demand_index=request.pricingInput.demandIndexInput,
        inventory_qty=request.pricingInput.inventoryQtyInput,
        cost_per_unit=request.pricingInput.costPerUnitInput,
        customer_type_input=request.opportunity.customerType,
        contract_term_months=request.pricingInput.contractTermMonthsInput,
    )

    conn = get_sql_connection()
    try:
        cursor = conn.cursor()

        opportunity_seed["LatestPriceAmount"] = str(pricing.finalPrice)
        opportunity_seed["LatestMarginPct"] = str(pricing.expectedMarginPct)
        opportunity_seed["LatestScore"] = str(pricing.score)

        available_columns = _get_opportunity_table_columns(conn)
        requested_columns = [
            "OpportunityId",
            "OpportunityNumber",
            "OpportunityName",
            "AccountId",
            "AccountName",
            "Status",
            "CurrentQuoteId",
            "CurrentQuoteVersionNo",
            "LatestPriceAmount",
            "LatestMarginPct",
            "LatestScore",
            "CreatedBy",
            "ModifiedBy",
            "CustomerType",
            "IndustryType",
            "CustomerRegion",
            "CountryCode",
            "CustomerStatus",
            "CreditRating",
            "PlanTier",
            "PlanName",
            "ServiceName",
            "ServiceCategory",
            "ContractTermMonths",
            "SubscriptionQuantity",
        ]
        columns_to_write = [column for column in requested_columns if column in available_columns]
        values = [opportunity_seed[column] for column in columns_to_write]
        column_sql_parts = list(columns_to_write)
        value_sql_parts = ["?"] * len(columns_to_write)

        if "LastPricedAtUtc" in available_columns:
            column_sql_parts.append("LastPricedAtUtc")
            value_sql_parts.append("SYSUTCDATETIME()")

        column_sql = ", ".join(column_sql_parts)
        value_sql = ", ".join(value_sql_parts)

        cursor.execute(
            f"""
            INSERT INTO ms.Opportunity
            (
                {column_sql}
            )
            VALUES ({value_sql})
            """,
            *values,
        )

        cursor.execute(
            """
            INSERT INTO ms.QuoteRequest
            (
                QuoteId, OpportunityId, QuoteStatus, CreatedBy, ModifiedBy
            )
            VALUES (?, ?, 'Draft', ?, ?)
            """,
            str(quote_id),
            str(opportunity_id),
            request.opportunity.changedBy,
            request.opportunity.changedBy,
        )

        _insert_quote_history_row(
            conn,
            _build_quote_history_insert_data(
                quote_id=quote_id,
                opportunity_id=opportunity_id,
                change_type="Created",
                context=context,
                request=request,
                pricing=pricing,
                changed_by=request.opportunity.changedBy,
            ),
        )

        conn.commit()
        return QuoteCreateResponse(
            opportunityId=opportunity_id,
            quoteId=quote_id,
            versionNo=1,
            pricing=pricing,
        )
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _get_opportunity_account_id_by_quote_id(quote_id: UUID, conn=None) -> str | None:
    """
    Lookup the account ID associated with a quote.
    
    Args:
        quote_id: The quote identifier
        conn: Optional existing connection to reuse. If None, creates a new one.
              Caller is responsible for closing passed connections.
    """
    should_close = conn is None
    if conn is None:
        conn = get_sql_connection()
    
    try:
        row = conn.cursor().execute(
            "SELECT AccountId FROM ms.Opportunity WHERE CurrentQuoteId = ?",
            str(quote_id),
        ).fetchone()
        return row.AccountId if row else None
    finally:
        if should_close:
            conn.close()


def revise_quote(quote_id: UUID, request: QuoteReviseRequest) -> QuoteCreateResponse:
    opportunity_account_id = _get_opportunity_account_id_by_quote_id(quote_id)
    context = fetch_billing_context(request.billingContext, opportunity_account_id)
    pricing = calculate_price(
        context=context,
        target_margin_pct=request.pricingInput.targetMarginPctInput,
        manual_adjustment_pct=request.pricingInput.manualAdjustmentPctInput,
        competitor_price=request.pricingInput.competitorPriceInput,
        demand_index=request.pricingInput.demandIndexInput,
        inventory_qty=request.pricingInput.inventoryQtyInput,
        cost_per_unit=request.pricingInput.costPerUnitInput,
        customer_type_input=context.get("customerType"),
        contract_term_months=request.pricingInput.contractTermMonthsInput,
    )

    conn = get_sql_connection()
    try:
        cursor = conn.cursor()

        current = cursor.execute(
            """
            SELECT TOP 1 OpportunityId, VersionNo
            FROM ms.QuoteHistory
            WHERE QuoteId = ? AND IsCurrentVersion = 1
            ORDER BY VersionNo DESC
            """,
            str(quote_id),
        ).fetchone()

        if not current:
            raise HTTPException(status_code=404, detail="Quote not found.")

        opportunity_id = UUID(str(current.OpportunityId))
        new_quote_id = uuid4()

        cursor.execute(
            "UPDATE ms.QuoteHistory SET IsCurrentVersion = 0 WHERE QuoteId = ? AND IsCurrentVersion = 1",
            str(quote_id),
        )

        cursor.execute(
            """
            INSERT INTO ms.QuoteRequest
            (
                QuoteId, OpportunityId, QuoteStatus, CreatedBy, ModifiedBy
            )
            VALUES (?, ?, 'Draft', ?, ?)
            """,
            str(new_quote_id),
            str(opportunity_id),
            request.changedBy,
            request.changedBy,
        )

        _insert_quote_history_row(
            conn,
            _build_quote_history_insert_data(
                quote_id=new_quote_id,
                opportunity_id=opportunity_id,
                change_type=request.changeType,
                context=context,
                request=request,
                pricing=pricing,
                changed_by=request.changedBy,
            ),
        )

        available_columns = _get_opportunity_table_columns(conn)
        update_sql = """
            UPDATE ms.Opportunity
            SET CurrentQuoteId = ?, CurrentQuoteVersionNo = ?, LatestPriceAmount = ?,
                LatestMarginPct = ?, LatestScore = ?, LastPricedAtUtc = SYSUTCDATETIME(),
                ModifiedBy = ?, ModifiedAtUtc = SYSUTCDATETIME()
        """
        params = [
            str(new_quote_id),
            1,
            str(pricing.finalPrice),
            str(pricing.expectedMarginPct),
            str(pricing.score),
            request.changedBy,
        ]
        if "ContractTermMonths" in available_columns:
            update_sql += ", ContractTermMonths = ?"
            params.append(request.pricingInput.contractTermMonthsInput)

        update_sql += " WHERE OpportunityId = ?"
        params.append(str(opportunity_id))
        cursor.execute(update_sql, *params)

        conn.commit()
        return QuoteCreateResponse(
            opportunityId=opportunity_id,
            quoteId=new_quote_id,
            versionNo=1,
            pricing=pricing,
        )
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_quote_history(quote_id: UUID) -> list[QuoteHistoryRecord]:
    conn = get_sql_connection()
    try:
        rows = conn.cursor().execute(
            """
            SELECT
                QuoteHistoryId,
                QuoteId,
                OpportunityId,
                VersionNo,
                ChangeType,
                IsCurrentVersion,
                ChangedBy,
                ChangedAtUtc,
                FinalPrice,
                ExpectedMarginPct,
                Score,
                PricingMessage
            FROM ms.QuoteHistory
            WHERE QuoteId = ?
            ORDER BY VersionNo DESC, QuoteHistoryId DESC
            """,
            str(quote_id),
        ).fetchall()

        return [
            QuoteHistoryRecord(
                quoteHistoryId=row.QuoteHistoryId,
                quoteId=UUID(str(row.QuoteId)),
                opportunityId=UUID(str(row.OpportunityId)),
                versionNo=row.VersionNo,
                changeType=row.ChangeType,
                isCurrentVersion=bool(row.IsCurrentVersion),
                changedBy=row.ChangedBy,
                changedAtUtc=row.ChangedAtUtc,
                finalPrice=row.FinalPrice,
                expectedMarginPct=row.ExpectedMarginPct,
                score=row.Score,
                pricingMessage=row.PricingMessage,
            )
            for row in rows
        ]
    finally:
        conn.close()


def get_opportunity_latest(opportunity_id: UUID, conn=None) -> OpportunityLatestResponse:
    """
    Fetch the latest pricing data for an opportunity.
    
    Args:
        opportunity_id: The opportunity identifier
        conn: Optional existing connection to reuse. If None, creates a new one.
              Caller is responsible for closing passed connections.
    """
    should_close = conn is None
    if conn is None:
        conn = get_sql_connection()
    
    try:
        available_columns = _get_opportunity_table_columns(conn)

        def _select_or_null(column: str, sql_type: str) -> str:
            if column in available_columns:
                return f"o.{column} AS {column}"
            return f"CAST(NULL AS {sql_type}) AS {column}"

        row = conn.cursor().execute(
            f"""
            SELECT TOP 1
                p.OpportunityId,
                p.OpportunityName,
                p.Status,
                p.QuoteId,
                p.VersionNo,
                p.RecommendedPrice,
                p.FinalPrice,
                p.ExpectedMarginPct,
                p.Score,
                p.ChangedBy,
                p.ChangedAtUtc,
                {_select_or_null("CustomerType", "NVARCHAR(100)")},
                {_select_or_null("IndustryType", "NVARCHAR(100)")},
                {_select_or_null("CustomerRegion", "NVARCHAR(100)")},
                {_select_or_null("CountryCode", "NVARCHAR(10)")},
                {_select_or_null("CustomerStatus", "NVARCHAR(100)")},
                {_select_or_null("CreditRating", "INT")},
                {_select_or_null("PlanTier", "NVARCHAR(100)")},
                {_select_or_null("PlanName", "NVARCHAR(200)")},
                {_select_or_null("ServiceName", "NVARCHAR(200)")},
                {_select_or_null("ServiceCategory", "NVARCHAR(100)")},
                {_select_or_null("ContractTermMonths", "INT")},
                {_select_or_null("SubscriptionQuantity", "INT")}
            FROM ms.vOpportunityLatestPrice AS p
            JOIN ms.Opportunity AS o
                ON p.OpportunityId = o.OpportunityId
            WHERE p.OpportunityId = ?
            """,
            str(opportunity_id),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Opportunity not found.")

        return OpportunityLatestResponse(
            opportunityId=UUID(str(row.OpportunityId)),
            opportunityName=row.OpportunityName,
            status=row.Status,
            quoteId=UUID(str(row.QuoteId)) if row.QuoteId else None,
            versionNo=row.VersionNo,
            finalPrice=row.FinalPrice,
            recommendedPrice=row.RecommendedPrice,
            expectedMarginPct=row.ExpectedMarginPct,
            score=row.Score,
            changedBy=row.ChangedBy,
            changedAtUtc=row.ChangedAtUtc,
            customerType=row.CustomerType,
            industryType=row.IndustryType,
            customerRegion=row.CustomerRegion,
            countryCode=row.CountryCode,
            customerStatus=_normalize_customer_status(row.CustomerStatus),
            creditRating=int(row.CreditRating) if row.CreditRating is not None else None,
            planTier=row.PlanTier,
            planName=row.PlanName,
            serviceName=row.ServiceName,
            serviceCategory=row.ServiceCategory,
            contractTermMonths=int(row.ContractTermMonths) if row.ContractTermMonths is not None else None,
            subscriptionQuantity=int(row.SubscriptionQuantity) if row.SubscriptionQuantity is not None else None,
        )
    finally:
        if should_close:
            conn.close()


def list_opportunities() -> list[OpportunityListItem]:
    conn = get_sql_connection()
    try:
        rows = conn.cursor().execute(
            """
            SELECT
                o.OpportunityId,
                o.OpportunityName,
                MIN(h.ChangedAtUtc) AS CreatedAtUtc
            FROM ms.Opportunity o
            LEFT JOIN ms.QuoteHistory h
                ON h.OpportunityId = o.OpportunityId
                AND h.VersionNo = 1
            GROUP BY o.OpportunityId, o.OpportunityName
            ORDER BY MIN(h.ChangedAtUtc) DESC
            """
        ).fetchall()

        return [
            OpportunityListItem(
                opportunityId=UUID(str(row.OpportunityId)),
                opportunityName=row.OpportunityName,
                createdAtUtc=row.CreatedAtUtc,
            )
            for row in rows
            if row.OpportunityId and row.OpportunityName and row.CreatedAtUtc
        ]
    finally:
        conn.close()


def get_opportunity_details(opportunity_id: UUID) -> OpportunityDetailsResponse:
    """
    Fetch comprehensive opportunity details including history.
    
    Uses a single connection for all queries to avoid lock timeout issues
    from repeated connection opens/closes.
    """
    conn = get_sql_connection()
    try:
        # Get the latest opportunity data using the same connection
        opportunity = get_opportunity_latest(opportunity_id, conn)
        
        # Fetch creation timestamp from history with same connection
        created_row = conn.cursor().execute(
            """
            SELECT MIN(ChangedAtUtc) AS CreatedAtUtc
            FROM ms.QuoteHistory
            WHERE OpportunityId = ? AND VersionNo = 1
            """,
            str(opportunity_id),
        ).fetchone()

        if not created_row or not created_row.CreatedAtUtc:
            raise HTTPException(status_code=404, detail="Opportunity history not found.")

        # Fetch all history records with same connection
        history_rows = conn.cursor().execute(
            """
            SELECT
                QuoteHistoryId,
                QuoteId,
                OpportunityId,
                VersionNo,
                ChangeType,
                IsCurrentVersion,
                ChangedBy,
                ChangedAtUtc,
                FinalPrice,
                ExpectedMarginPct,
                Score,
                PricingMessage
            FROM ms.QuoteHistory
            WHERE OpportunityId = ?
            ORDER BY QuoteId ASC, VersionNo DESC, QuoteHistoryId DESC
            """,
            str(opportunity_id),
        ).fetchall()

        quote_history = [
            QuoteHistoryRecord(
                quoteHistoryId=row.QuoteHistoryId,
                quoteId=UUID(str(row.QuoteId)),
                opportunityId=UUID(str(row.OpportunityId)),
                versionNo=row.VersionNo,
                changeType=row.ChangeType,
                isCurrentVersion=bool(row.IsCurrentVersion),
                changedBy=row.ChangedBy,
                changedAtUtc=row.ChangedAtUtc,
                finalPrice=row.FinalPrice,
                expectedMarginPct=row.ExpectedMarginPct,
                score=row.Score,
                pricingMessage=row.PricingMessage,
            )
            for row in history_rows
        ]

        return OpportunityDetailsResponse(
            opportunity=opportunity,
            createdAtUtc=created_row.CreatedAtUtc,
            quoteHistory=quote_history,
        )
    finally:
        conn.close()


def reprice_opportunity(opportunity_id: UUID, request: QuoteReviseRequest) -> QuoteCreateResponse:
    conn = get_sql_connection()
    try:
        row = conn.cursor().execute(
            """
            SELECT CurrentQuoteId
            FROM ms.Opportunity
            WHERE OpportunityId = ?
            """,
            str(opportunity_id),
        ).fetchone()

        if not row or not row.CurrentQuoteId:
            raise HTTPException(status_code=404, detail="Opportunity does not have a current quote to reprice.")

        current_quote_id = UUID(str(row.CurrentQuoteId))
    finally:
        conn.close()

    return revise_quote(current_quote_id, request)
