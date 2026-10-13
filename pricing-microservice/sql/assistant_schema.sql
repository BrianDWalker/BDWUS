-- Extracted from runtime DDL; review before applying.

    IF SCHEMA_ID('ai') IS NULL EXEC('CREATE SCHEMA ai');

    IF OBJECT_ID('ai.Conversations', 'U') IS NULL
    BEGIN
      CREATE TABLE ai.Conversations (
        ConversationId NVARCHAR(64) NOT NULL PRIMARY KEY,
        Mode NVARCHAR(32) NOT NULL,
        Page NVARCHAR(64) NOT NULL,
        CreatedBy NVARCHAR(128) NULL,
        CreatedAtUtc DATETIME2 NOT NULL,
        LastMessageAtUtc DATETIME2 NULL
      );
    END;

    IF OBJECT_ID('ai.Messages', 'U') IS NULL
    BEGIN
      CREATE TABLE ai.Messages (
        MessageId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ConversationId NVARCHAR(64) NOT NULL,
        Role NVARCHAR(20) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        MetadataJson NVARCHAR(MAX) NULL,
        CreatedAtUtc DATETIME2 NOT NULL
      );
      CREATE INDEX IX_ai_Messages_ConversationId ON ai.Messages (ConversationId, CreatedAtUtc);
    END;

    IF OBJECT_ID('ai.ChangeRequests', 'U') IS NULL
    BEGIN
      CREATE TABLE ai.ChangeRequests (
        ChangeRequestId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ConversationId NVARCHAR(64) NOT NULL,
        RequestedBy NVARCHAR(128) NULL,
        Mode NVARCHAR(32) NOT NULL,
        Page NVARCHAR(64) NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Summary NVARCHAR(MAX) NOT NULL,
        Target NVARCHAR(200) NOT NULL,
        Kind NVARCHAR(50) NOT NULL,
        PatchJson NVARCHAR(MAX) NOT NULL,
        Status NVARCHAR(32) NOT NULL,
        CreatedAtUtc DATETIME2 NOT NULL,
        ApprovedAtUtc DATETIME2 NULL,
        ApprovedBy NVARCHAR(128) NULL,
        AppliedAtUtc DATETIME2 NULL,
        AppliedBy NVARCHAR(128) NULL
      );
      CREATE INDEX IX_ai_ChangeRequests_Status ON ai.ChangeRequests (Status, CreatedAtUtc DESC);
    END;

    IF OBJECT_ID('ai.UiOverrides', 'U') IS NULL
    BEGIN
      CREATE TABLE ai.UiOverrides (
        OverrideId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ChangeRequestId UNIQUEIDENTIFIER NOT NULL,
        Scope NVARCHAR(64) NOT NULL,
        TargetKey NVARCHAR(200) NOT NULL,
        ValueJson NVARCHAR(MAX) NOT NULL,
        Active BIT NOT NULL,
        CreatedAtUtc DATETIME2 NOT NULL
      );
      CREATE INDEX IX_ai_UiOverrides_Scope ON ai.UiOverrides (Scope, Active, CreatedAtUtc DESC);
    END;

    IF OBJECT_ID('ai.AuditLog', 'U') IS NULL
    BEGIN
      CREATE TABLE ai.AuditLog (
        AuditId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventType NVARCHAR(100) NOT NULL,
        EntityType NVARCHAR(100) NOT NULL,
        EntityId NVARCHAR(100) NOT NULL,
        DetailsJson NVARCHAR(MAX) NULL,
        CreatedAtUtc DATETIME2 NOT NULL
      );
    END;
    
GO
