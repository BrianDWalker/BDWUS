from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


ChangeType = Literal["Created", "Modified", "Repriced", "Submitted", "Approved", "Rejected", "Copied"]


class OpportunityPayload(BaseModel):
    opportunityId: Optional[UUID] = None
    opportunityNumber: Optional[str] = None
    opportunityName: str
    accountId: Optional[str] = None
    accountName: Optional[str] = None
    status: str = "Open"
    changedBy: Optional[str] = None
    # Customer metadata fields (auto-filled from lookup or manual entry)
    customerType: Optional[str] = None
    industryType: Optional[str] = None
    customerRegion: Optional[str] = None
    countryCode: Optional[str] = None
    customerStatus: Optional[str] = None
    creditRating: Optional[int] = None
    # Service metadata fields (user-entered)
    serviceCategory: Optional[str] = None
    planTier: Optional[str] = None
    planName: Optional[str] = None
    serviceName: Optional[str] = None
    subscriptionQuantity: Optional[int] = Field(default=None, ge=0)


class BillingContextInput(BaseModel):
    queryType: Optional[str] = None
    executionCount: Optional[int] = Field(default=None, ge=0)
    avgDurationMinutes: Optional[Decimal] = Field(default=None, ge=0)
    avgCpuSeconds: Optional[Decimal] = Field(default=None, ge=0)
    avgRowCount: Optional[Decimal] = Field(default=None, ge=0)
    rowsQueried: Optional[int] = Field(default=None, ge=0)
    rowsInserted: Optional[int] = Field(default=None, ge=0)
    rowsUpdated: Optional[int] = Field(default=None, ge=0)
    rowsDeleted: Optional[int] = Field(default=None, ge=0)
    rowsMerged: Optional[int] = Field(default=None, ge=0)


class PricingInput(BaseModel):
    targetMarginPctInput: Decimal = Field(..., ge=0, le=100)
    manualAdjustmentPctInput: Decimal = Field(default=Decimal("0"), ge=-100, le=100)
    competitorPriceInput: Optional[Decimal] = Field(default=None, ge=0)
    demandIndexInput: Optional[Decimal] = Field(default=None, ge=0)
    inventoryQtyInput: Optional[int] = Field(default=None, ge=0)


class QuoteCreateRequest(BaseModel):
    opportunity: OpportunityPayload
    billingContext: BillingContextInput
    pricingInput: PricingInput


class QuoteReviseRequest(BaseModel):
    changeType: ChangeType = "Modified"
    billingContext: BillingContextInput
    pricingInput: PricingInput
    changedBy: Optional[str] = None


class CustomerProfileResponse(BaseModel):
    """Customer profile returned from ms.vCustomerLookup view.
    
    Used for Web UI auto-fill when account number is looked up.
    These 8 fields allow the UI to pre-populate customer context.
    """
    customerNumber: str
    customerName: Optional[str] = None
    customerType: Optional[str] = None
    industryType: Optional[str] = None
    customerRegion: Optional[str] = None
    countryCode: Optional[str] = None
    customerStatus: Optional[str] = None
    creditRating: Optional[int] = None


class CustomerMetadataOptionsResponse(BaseModel):
    customerRegions: list[str] = []
    countryCodes: list[str] = []
    customerStatuses: list[str] = []


class PricingResult(BaseModel):
    recommendedPrice: Decimal
    expectedMarginPct: Decimal
    priceFloor: Decimal
    priceCeiling: Decimal
    finalPrice: Decimal
    score: Decimal
    pricingMessage: str
    pricingExplanation: str
    dbLookupUsed: bool
    inputsSummary: dict


class QuoteHistoryRecord(BaseModel):
    quoteHistoryId: int
    quoteId: UUID
    opportunityId: UUID
    versionNo: int
    changeType: str
    isCurrentVersion: bool
    changedBy: Optional[str] = None
    changedAtUtc: datetime
    finalPrice: Optional[Decimal] = None
    expectedMarginPct: Optional[Decimal] = None
    score: Optional[Decimal] = None
    pricingMessage: Optional[str] = None


class QuoteCreateResponse(BaseModel):
    opportunityId: UUID
    quoteId: UUID
    versionNo: int
    pricing: PricingResult


class OpportunityLatestResponse(BaseModel):
    opportunityId: UUID
    opportunityName: str
    status: str
    quoteId: Optional[UUID] = None
    versionNo: Optional[int] = None
    finalPrice: Optional[Decimal] = None
    recommendedPrice: Optional[Decimal] = None
    expectedMarginPct: Optional[Decimal] = None
    score: Optional[Decimal] = None
    changedBy: Optional[str] = None
    changedAtUtc: Optional[datetime] = None

    customerType: Optional[str] = None
    industryType: Optional[str] = None
    customerRegion: Optional[str] = None
    countryCode: Optional[str] = None
    customerStatus: Optional[str] = None
    creditRating: Optional[int] = None
    planTier: Optional[str] = None
    serviceCategory: Optional[str] = None
    planName: Optional[str] = None
    serviceName: Optional[str] = None
    subscriptionQuantity: Optional[int] = None


class OpportunityListItem(BaseModel):
    opportunityId: UUID
    opportunityName: str
    createdAtUtc: datetime


class OpportunityDetailsResponse(BaseModel):
    opportunity: OpportunityLatestResponse
    createdAtUtc: datetime
    quoteHistory: list[QuoteHistoryRecord]
