-- Owner-approved additive migration, 12 October 2026.
-- Production catalog confirmed these three tables/views do not exist.
-- This file is included after the schema-only production baseline for dev.
-- These views support the new UI tabs without fabricated billing facts.
-- No stored procedures are needed for these read-only pages. Future mutations
-- need approved procedures enforcing invoice/customer relationships and audit.
IF OBJECT_ID('billing.Subscriptions', 'U') IS NULL
CREATE TABLE billing.Subscriptions (
  SubscriptionId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  CustomerNumber NVARCHAR(32) NOT NULL REFERENCES billing.Customers(CustomerNumber),
  ServiceId UNIQUEIDENTIFIER NOT NULL REFERENCES billing.Services(ServiceId),
  RatePlanId UNIQUEIDENTIFIER NULL REFERENCES billing.RatePlans(RatePlanId),
  Quantity INT NOT NULL CHECK (Quantity > 0),
  Status NVARCHAR(30) NOT NULL,
  StartedAtUtc DATETIME2 NOT NULL,
  EndedAtUtc DATETIME2 NULL
);
GO
IF OBJECT_ID('billing.Payments', 'U') IS NULL
CREATE TABLE billing.Payments (
  PaymentId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  CustomerNumber NVARCHAR(32) NOT NULL REFERENCES billing.Customers(CustomerNumber),
  InvoiceId UNIQUEIDENTIFIER NOT NULL REFERENCES billingops.Invoices(InvoiceId),
  Amount DECIMAL(18,2) NOT NULL,
  Currency CHAR(3) NOT NULL,
  Status NVARCHAR(30) NOT NULL,
  PaidAtUtc DATETIME2 NOT NULL
);
GO
IF OBJECT_ID('billing.UsageEvents', 'U') IS NULL
CREATE TABLE billing.UsageEvents (
  UsageEventId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  SubscriptionId UNIQUEIDENTIFIER NOT NULL REFERENCES billing.Subscriptions(SubscriptionId),
  Quantity DECIMAL(18,4) NOT NULL CHECK (Quantity >= 0),
  Unit NVARCHAR(30) NOT NULL,
  OccurredAtUtc DATETIME2 NOT NULL
);
GO
CREATE OR ALTER VIEW billing.vPortalSubscriptions AS
SELECT s.SubscriptionId AS RecordId, s.CustomerNumber, c.CustomerName,
       svc.ServiceName, rp.PlanName, s.Quantity, s.Status, s.StartedAtUtc
FROM billing.Subscriptions s
JOIN billing.Customers c ON c.CustomerNumber = s.CustomerNumber
JOIN billing.Services svc ON svc.ServiceId = s.ServiceId
LEFT JOIN billing.RatePlans rp ON rp.RatePlanId = s.RatePlanId;
GO
CREATE OR ALTER VIEW billing.vPortalPayments AS
SELECT p.PaymentId AS RecordId, p.CustomerNumber, c.CustomerName,
       i.InvoiceNumber, p.Amount, p.Currency, p.Status, p.PaidAtUtc
FROM billing.Payments p
JOIN billing.Customers c ON c.CustomerNumber = p.CustomerNumber
JOIN billingops.Invoices i ON i.InvoiceId = p.InvoiceId;
GO
CREATE OR ALTER VIEW billing.vPortalUsage AS
SELECT u.UsageEventId AS RecordId, s.CustomerNumber, c.CustomerName,
       svc.ServiceName, u.Quantity, u.Unit, u.OccurredAtUtc
FROM billing.UsageEvents u
JOIN billing.Subscriptions s ON s.SubscriptionId = u.SubscriptionId
JOIN billing.Customers c ON c.CustomerNumber = s.CustomerNumber
JOIN billing.Services svc ON svc.ServiceId = s.ServiceId;
GO
