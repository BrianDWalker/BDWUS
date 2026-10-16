-- PROPOSAL ONLY. Owner must approve before applying to dev or prod.
-- Additive: no existing order rows are rewritten or inferred/backfilled.
-- Historical duplicates cannot be safely matched without owner reconciliation.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('ops.Orders', 'SourceQuoteId') IS NULL
    ALTER TABLE ops.Orders ADD SourceQuoteId UNIQUEIDENTIFIER NULL;
-- Compile after the new column exists.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('ops.Orders') AND name = 'UX_Orders_SourceQuoteId')
    EXEC('CREATE UNIQUE INDEX UX_Orders_SourceQuoteId ON ops.Orders(SourceQuoteId) WHERE SourceQuoteId IS NOT NULL');
COMMIT;
