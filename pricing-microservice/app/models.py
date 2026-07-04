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
    contractTermMonths: Optional[int] = Field(default=None, ge=1, le=120)
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
    costPerUnitInput: Optional[Decimal] = Field(default=None, ge=0)
    customerTypeInput: Optional[str] = None
    contractTermMonthsInput: Optional[int] = Field(default=None, ge=1, le=120)


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
    customerTypes: list[str] = []
    industryTypes: list[str] = []
    customerRegions: list[str] = []
    countryCodes: list[str] = []
    customerStatuses: list[str] = []
    serviceCategories: list[str] = []
    planTiers: list[str] = []
    planNames: list[str] = []
    serviceNames: list[str] = []
    serviceCatalog: list[dict[str, str]] = []
    contractTermOptions: list[int] = []


class PricingResult(BaseModel):
    recommendedPrice: Decimal
    expectedMarginPct: Decimal
    priceFloor: Decimal
    priceCeiling: Decimal
    finalPrice: Decimal
    score: Decimal
    pricingMessage: str
    pricingExplanation: str
    pricingBreakdown: list[dict[str, str | Decimal]]
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
    contractTermMonths: Optional[int] = None
    subscriptionQuantity: Optional[int] = None


class OpportunityListItem(BaseModel):
    opportunityId: UUID
    opportunityName: str
    createdAtUtc: datetime


class OpportunityDetailsResponse(BaseModel):
    opportunity: OpportunityLatestResponse
    createdAtUtc: datetime
    quoteHistory: list[QuoteHistoryRecord]


AssistantMode = Literal["knowledge", "agent", "dev"]
AssistantProposalKind = Literal["ui_override", "ui_patch", "note", "lead_create", "github_update"]


class AssistantContext(BaseModel):
    route: Optional[str] = None
    pageTitle: Optional[str] = None
    pageSummary: Optional[str] = None
    knowledgeDocuments: list[dict[str, Any]] = Field(default_factory=list)
    knowledgeTopics: list[dict[str, Any]] = Field(default_factory=list)
    selectedText: Optional[str] = None
    githubRepo: Optional[str] = None
    githubBranch: Optional[str] = None
    githubFilePath: Optional[str] = None
    salesDefaults: dict[str, Any] = Field(default_factory=dict)


class AssistantChatRequest(BaseModel):
    conversationId: Optional[str] = None
    mode: AssistantMode = "knowledge"
    message: str
    context: AssistantContext = Field(default_factory=AssistantContext)
    userName: Optional[str] = None


class AssistantProposal(BaseModel):
    title: str
    summary: str
    target: str
    kind: AssistantProposalKind = "note"
    patch: dict[str, Any] = Field(default_factory=dict)
    requiresApproval: bool = True


class AssistantChatResponse(BaseModel):
    conversationId: str
    assistantMessage: str
    mode: AssistantMode
    proposals: list[AssistantProposal] = Field(default_factory=list)
    changeRequestIds: list[UUID] = Field(default_factory=list)


class AssistantUiOverride(BaseModel):
    scope: str
    targetKey: str
    value: Any
    sourceChangeRequestId: UUID
    createdAtUtc: datetime


class AssistantChangeRequest(BaseModel):
    changeRequestId: UUID
    conversationId: str
    mode: AssistantMode
    page: str
    title: str
    summary: str
    target: str
    kind: AssistantProposalKind
    patch: dict[str, Any]
    status: str
    createdAtUtc: datetime
    approvedAtUtc: Optional[datetime] = None
    appliedAtUtc: Optional[datetime] = None
    approvedBy: Optional[str] = None
    appliedBy: Optional[str] = None


class AssistantApprovalRequest(BaseModel):
    approvedBy: Optional[str] = "admin"
