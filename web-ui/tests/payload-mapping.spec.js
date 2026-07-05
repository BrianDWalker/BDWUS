import { expect, test } from "@playwright/test";
import {
  arrayField,
  normalizeCustomer,
  normalizeInvoice,
  normalizeNetworkEvent,
  normalizeOrder,
  normalizeProvisioningJob,
  normalizeSettlement,
  normalizeTicket
} from "../src/utils/payloadMapping";

test("arrayField accepts alternate collection names", () => {
  expect(arrayField({ provisioningJobs: [1] }, "provisioningJobs", "ProvisioningJobs")).toEqual([1]);
  expect(arrayField({ ProvisioningJobs: [2] }, "provisioningJobs", "ProvisioningJobs")).toEqual([2]);
  expect(arrayField({ carrierSettlements: [3] }, "settlements", "carrierSettlements")).toEqual([3]);
  expect(arrayField({}, "missing")).toEqual([]);
});

test("normalizers map camelCase and PascalCase payloads into stable UI fields", () => {
  expect(normalizeCustomer({ customerNumber: "CUST-1", customerName: "Apex", mrr: 100, status: "Active" })).toMatchObject({ CustomerNumber: "CUST-1", CustomerName: "Apex", Mrr: 100, Status: "Active" });
  expect(normalizeOrder({ orderId: "order-1", orderNumber: "ORD-1", accountName: "Apex", lifecycleStage: "Design", overallStatus: "Draft" })).toMatchObject({ OrderId: "order-1", OrderNumber: "ORD-1", AccountName: "Apex", LifecycleStage: "Design", OverallStatus: "Draft" });
  expect(normalizeProvisioningJob({ provisioningJobId: "job-1", jobNumber: "JOB-1", ownerName: "Ops" })).toMatchObject({ ProvisioningJobId: "job-1", JobNumber: "JOB-1", OwnerName: "Ops" });
  expect(normalizeNetworkEvent({ eventId: "event-1", eventNumber: "NE-1", slaExposure: 2500, severity: "Major" })).toMatchObject({ EventId: "event-1", EventNumber: "NE-1", SlaExposure: 2500, Severity: "Major" });
  expect(normalizeSettlement({ settlementId: "set-1", settlementNumber: "SET-1", exposureAmount: 1000 })).toMatchObject({ SettlementId: "set-1", SettlementNumber: "SET-1", ExposureAmount: 1000 });
  expect(normalizeInvoice({ invoiceId: "inv-1", invoiceNumber: "INV-1", amount: 50, balance: 10 })).toMatchObject({ InvoiceId: "inv-1", InvoiceNumber: "INV-1", Amount: 50, Balance: 10 });
  expect(normalizeTicket({ ticketId: "ticket-1", ticketNumber: "TKT-1", issueType: "Billing", ageHours: 3 })).toMatchObject({ TicketId: "ticket-1", TicketNumber: "TKT-1", IssueType: "Billing", AgeHours: 3 });
});
