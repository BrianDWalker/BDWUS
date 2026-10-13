export function field(row, ...keys) {
  if (!row) return undefined;
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return undefined;
}

export function textField(row, ...keys) {
  return String(field(row, ...keys) ?? "");
}

export function numberField(row, ...keys) {
  const value = Number(field(row, ...keys) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function arrayField(payload, ...keys) {
  for (const key of keys) {
    const value = payload?.[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function normalizeCustomer(row = {}) {
  return {
    ...row,
    CustomerNumber: textField(row, "CustomerNumber", "customerNumber", "id"),
    CustomerName: textField(row, "CustomerName", "customerName", "name", "AccountName", "accountName"),
    CustomerType: textField(row, "CustomerType", "customerType", "type"),
    Segment: textField(row, "Segment", "segment", "CustomerType", "customerType"),
    Region: textField(row, "Region", "region", "CustomerRegion", "customerRegion"),
    Status: textField(row, "Status", "status"),
    Mrr: numberField(row, "Mrr", "MRR", "mrr"),
    CreditRating: field(row, "CreditRating", "creditRating"),
    BillingProfile: textField(row, "BillingProfile", "billingProfile"),
    PrimaryContact: textField(row, "PrimaryContact", "primaryContact", "ContactName", "contactName"),
    SupportTier: textField(row, "SupportTier", "supportTier"),
    AccountManager: textField(row, "AccountManager", "accountManager", "OwnerName", "ownerName")
  };
}

export function normalizeOrder(row = {}) {
  return {
    ...row,
    OrderId: textField(row, "OrderId", "orderId", "id"),
    OrderNumber: textField(row, "OrderNumber", "orderNumber", "number"),
    CustomerNumber: textField(row, "CustomerNumber", "customerNumber"),
    AccountName: textField(row, "AccountName", "accountName", "customer", "CustomerName"),
    ServiceName: textField(row, "ServiceName", "serviceName", "service"),
    LifecycleStage: textField(row, "LifecycleStage", "lifecycleStage", "stage"),
    OverallStatus: textField(row, "OverallStatus", "overallStatus", "status"),
    SlaStatus: textField(row, "SlaStatus", "slaStatus", "sla"),
    DueDate: textField(row, "DueDate", "dueDate", "due"),
    AssignedTeam: textField(row, "AssignedTeam", "assignedTeam", "ownerName", "OwnerName")
  };
}

export function normalizeProvisioningJob(row = {}) {
  return {
    ...row,
    ProvisioningJobId: textField(row, "ProvisioningJobId", "provisioningJobId", "id"),
    JobNumber: textField(row, "JobNumber", "jobNumber", "number"),
    JobType: textField(row, "JobType", "jobType", "type"),
    OwnerName: textField(row, "OwnerName", "ownerName", "owner"),
    Status: textField(row, "Status", "status"),
    DueDate: textField(row, "DueDate", "dueDate", "due")
  };
}

export function normalizeNetworkEvent(row = {}) {
  return {
    ...row,
    EventId: textField(row, "EventId", "eventId", "id"),
    EventNumber: textField(row, "EventNumber", "eventNumber", "number"),
    Market: textField(row, "Market", "market", "Region", "region"),
    Type: textField(row, "Type", "type", "IssueType", "issueType"),
    Impacted: textField(row, "Impacted", "impacted", "AccountName", "accountName"),
    Severity: textField(row, "Severity", "severity", "Priority", "priority"),
    Status: textField(row, "Status", "status"),
    SlaExposure: numberField(row, "SlaExposure", "slaExposure", "exposureAmount", "ExposureAmount")
  };
}

export function normalizeSettlement(row = {}) {
  return {
    ...row,
    SettlementId: textField(row, "SettlementId", "settlementId", "id"),
    SettlementNumber: textField(row, "SettlementNumber", "settlementNumber", "number"),
    PartnerName: textField(row, "PartnerName", "partnerName", "partner"),
    BillingPeriod: textField(row, "BillingPeriod", "billingPeriod", "period"),
    ExposureAmount: numberField(row, "ExposureAmount", "exposureAmount", "amount"),
    Status: textField(row, "Status", "status"),
    ClaimType: textField(row, "ClaimType", "claimType", "claim")
  };
}

export function normalizeInvoice(row = {}) {
  return {
    ...row,
    InvoiceId: textField(row, "InvoiceId", "invoiceId", "id"),
    InvoiceNumber: textField(row, "InvoiceNumber", "invoiceNumber", "number"),
    AccountName: textField(row, "AccountName", "accountName", "CustomerName", "customerName"),
    Amount: numberField(row, "Amount", "amount"),
    Balance: numberField(row, "Balance", "balance"),
    Status: textField(row, "Status", "status"),
    DueDate: textField(row, "DueDate", "dueDate", "due")
  };
}

export function normalizeTicket(row = {}) {
  return {
    ...row,
    TicketId: textField(row, "TicketId", "ticketId", "id"),
    TicketNumber: textField(row, "TicketNumber", "ticketNumber", "number"),
    CustomerNumber: textField(row, "CustomerNumber", "customerNumber"),
    AccountName: textField(row, "AccountName", "accountName", "CustomerName", "customerName"),
    IssueType: textField(row, "IssueType", "issueType", "type"),
    Category: textField(row, "Category", "category"),
    Priority: textField(row, "Priority", "priority"),
    Status: textField(row, "Status", "status"),
    AgeHours: numberField(row, "AgeHours", "ageHours", "age"),
    OwnerName: textField(row, "OwnerName", "ownerName", "owner")
  };
}
