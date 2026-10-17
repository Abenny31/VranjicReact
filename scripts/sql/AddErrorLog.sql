-- EF migration 20261016151133_AddErrorLog, with target guards and rollback on failure.
-- Run this entire file in SSMS as the same database user used by the application.
-- Back up the target database first. For development, use dotnet ef database update instead.
-- Only ErrorLog and the EF migration history are written.
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF @@TRANCOUNT <> 0
    THROW 51000, 'Run in a session without an existing transaction.', 1;
IF DB_NAME() <> N'powerhousehr_vranjic'
    THROW 51000, 'Select the powerhousehr_vranjic database before running this script.', 1;
IF SCHEMA_NAME() <> N'powerhousehr_admin'
    THROW 51000, 'The current database user must have powerhousehr_admin as its default schema.', 1;
IF OBJECT_ID(N'__EFMigrationsHistory', N'U') IS NULL
    THROW 51000, 'EF migration history was not found. Verify the selected database and user.', 1;

BEGIN TRY
BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261016151133_AddErrorLog'
)
BEGIN
    CREATE TABLE [ErrorLog] (
        [Id] bigint NOT NULL IDENTITY,
        [CreatedAtUtc] datetimeoffset NOT NULL,
        [TraceId] nvarchar(128) NOT NULL,
        [RequestMethod] nvarchar(16) NOT NULL,
        [Path] nvarchar(1024) NOT NULL,
        [UserId] nvarchar(450) NULL,
        [StatusCode] int NOT NULL,
        [ExceptionType] nvarchar(512) NOT NULL,
        [Message] nvarchar(4000) NOT NULL,
        [ExceptionDetails] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_ErrorLog] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261016151133_AddErrorLog'
)
BEGIN
    CREATE INDEX [IX_ErrorLog_CreatedAtUtc] ON [ErrorLog] ([CreatedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261016151133_AddErrorLog'
)
BEGIN
    CREATE INDEX [IX_ErrorLog_TraceId] ON [ErrorLog] ([TraceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261016151133_AddErrorLog'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261016151133_AddErrorLog', N'9.0.6');
END;

COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH;
GO

