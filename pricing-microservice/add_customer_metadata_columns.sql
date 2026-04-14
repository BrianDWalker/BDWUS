-- ============================================================================
-- SCHEMA UPDATES: Add customer metadata columns to ms schema
-- ============================================================================
-- This migration extends the ms.Opportunity table to store customer lookup fields
-- so that opportunity details pages can display the auto-filled customer context
-- without requiring a fresh database lookup on every page view.
--
-- NEW COLUMNS:
--   - CustomerType (VARCHAR(50)): auto-filled from lookup
--   - IndustryType (VARCHAR(50)): auto-filled from lookup
--   - CustomerRegion (VARCHAR(50)): auto-filled from lookup
--   - CountryCode (VARCHAR(2)): auto-filled from lookup
--   - CustomerStatus (VARCHAR(50)): auto-filled from lookup
--   - CreditRating (INT): auto-filled from lookup
--
-- These columns allow the UI to display the full customer context on the
-- opportunity details and reprice pages without additional API calls.
-- ============================================================================

-- Add customer metadata columns to ms.Opportunity table if they don't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Opportunity' AND COLUMN_NAME = 'CustomerType')
BEGIN
    ALTER TABLE ms.Opportunity ADD CustomerType VARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Opportunity' AND COLUMN_NAME = 'IndustryType')
BEGIN
    ALTER TABLE ms.Opportunity ADD IndustryType VARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Opportunity' AND COLUMN_NAME = 'CustomerRegion')
BEGIN
    ALTER TABLE ms.Opportunity ADD CustomerRegion VARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Opportunity' AND COLUMN_NAME = 'CountryCode')
BEGIN
    ALTER TABLE ms.Opportunity ADD CountryCode VARCHAR(2) NULL;
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Opportunity' AND COLUMN_NAME = 'CustomerStatus')
BEGIN
    ALTER TABLE ms.Opportunity ADD CustomerStatus VARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Opportunity' AND COLUMN_NAME = 'CreditRating')
BEGIN
    ALTER TABLE ms.Opportunity ADD CreditRating INT NULL;
END;

-- Add service metadata columns to ms.Opportunity so Details/Reprice pages
-- can always pull full context from ms schema.
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Opportunity' AND COLUMN_NAME = 'PlanTier')
BEGIN
    ALTER TABLE ms.Opportunity ADD PlanTier VARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Opportunity' AND COLUMN_NAME = 'ServiceCategory')
BEGIN
    ALTER TABLE ms.Opportunity ADD ServiceCategory VARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Opportunity' AND COLUMN_NAME = 'PlanName')
BEGIN
    ALTER TABLE ms.Opportunity ADD PlanName VARCHAR(200) NULL;
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Opportunity' AND COLUMN_NAME = 'ServiceName')
BEGIN
    ALTER TABLE ms.Opportunity ADD ServiceName VARCHAR(200) NULL;
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Opportunity' AND COLUMN_NAME = 'SubscriptionQuantity')
BEGIN
    ALTER TABLE ms.Opportunity ADD SubscriptionQuantity INT NULL;
END;

PRINT 'Customer and service metadata columns verified on ms.Opportunity table.';
