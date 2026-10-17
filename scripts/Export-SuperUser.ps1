#Requires -Version 7.0
<#
.SYNOPSIS
Exports only admin@vranjic.local and its Identity memberships/claims to a portable SQL file.
.DESCRIPTION
Reads the source database only. Never connects to production. Set
ConnectionStrings__DefaultConnection in this process to the DEVELOPMENT connection string.
The generated file contains a password hash; keep it private and outside source control.
.EXAMPLE
pwsh -File scripts/Export-SuperUser.ps1
#>
[CmdletBinding()]
param(
    [ValidateNotNullOrEmpty()][string]$TargetDatabase = 'PRODUKCIJA',
    [string]$OutputPath = (Join-Path $PSScriptRoot '../artifacts/private/Import-SuperUser.sql')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($env:ConnectionStrings__DefaultConnection)) {
    throw 'Set ConnectionStrings__DefaultConnection to the DEVELOPMENT connection string before exporting.'
}
if ($TargetDatabase.Length -gt 128) { throw 'Target database name exceeds 128 characters.' }
$fullOutputPath = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $fullOutputPath) { throw 'Output already exists. Choose a new OutputPath.' }

$connection = [System.Data.SqlClient.SqlConnection]::new($env:ConnectionStrings__DefaultConnection)
try {
    $connection.Open()
    $command = $connection.CreateCommand()
    $command.CommandText = @'
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @UserId nvarchar(450);
    IF (SELECT COUNT(*) FROM dbo.AspNetUsers WHERE NormalizedEmail = N'ADMIN@VRANJIC.LOCAL') <> 1
        THROW 51000, 'Expected exactly one development admin@vranjic.local account.', 1;
    SELECT @UserId = Id FROM dbo.AspNetUsers WHERE NormalizedEmail = N'ADMIN@VRANJIC.LOCAL';
    IF NOT EXISTS (SELECT 1 FROM dbo.AspNetUserRoles ur JOIN dbo.AspNetRoles r ON r.Id = ur.RoleId
        WHERE ur.UserId = @UserId AND r.Name = N'SuperUser' AND r.NormalizedName = N'SUPERUSER')
        THROW 51000, 'The source account is not a SuperUser.', 1;
    IF EXISTS (SELECT 1 FROM dbo.AspNetUsers WHERE Id = @UserId AND
        (EmailConfirmed = 0 OR NULLIF(PasswordHash, N'') IS NULL OR TwoFactorEnabled = 1
        OR (LockoutEnabled = 1 AND LockoutEnd > SYSDATETIMEOFFSET())))
        THROW 51000, 'Source must be confirmed, have a password, be unlocked and have 2FA disabled. No tokens are exported.', 1;
    DECLARE @Payload nvarchar(max) = (
        SELECT
            JSON_QUERY((SELECT Id, UserName, NormalizedUserName, Email, NormalizedEmail, EmailConfirmed,
                PasswordHash, PhoneNumber, PhoneNumberConfirmed, TwoFactorEnabled, LockoutEnd,
                LockoutEnabled, AccessFailedCount FROM dbo.AspNetUsers WHERE Id = @UserId
                FOR JSON PATH, INCLUDE_NULL_VALUES)) AS [Users],
            JSON_QUERY((SELECT r.Id, r.Name, r.NormalizedName FROM dbo.AspNetRoles r
                JOIN dbo.AspNetUserRoles ur ON ur.RoleId = r.Id WHERE ur.UserId = @UserId
                FOR JSON PATH, INCLUDE_NULL_VALUES)) AS Roles,
            JSON_QUERY((SELECT ClaimType, ClaimValue FROM dbo.AspNetUserClaims WHERE UserId = @UserId
                FOR JSON PATH, INCLUDE_NULL_VALUES)) AS UserClaims,
            JSON_QUERY((SELECT rc.RoleId, rc.ClaimType, rc.ClaimValue FROM dbo.AspNetRoleClaims rc
                JOIN dbo.AspNetUserRoles ur ON ur.RoleId = rc.RoleId WHERE ur.UserId = @UserId
                FOR JSON PATH, INCLUDE_NULL_VALUES)) AS RoleClaims
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );
    COMMIT;
    SELECT @Payload;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH;
'@
    # ExecuteScalar avoids sqlcmd column-width truncation and never prints the hash.
    $payload = [string]$command.ExecuteScalar()
    if ([string]::IsNullOrWhiteSpace($payload)) { throw 'Source export was empty.' }
    $sourceDatabase = $connection.Database
} finally {
    $connection.Dispose()
}

$template = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'sql/Import-SuperUser.template.sql')
# Insert values as Unicode SQL literals, never as executable identifiers or SQL fragments.
$header = "DECLARE @ExpectedDatabase sysname = N'$($TargetDatabase.Replace("'", "''"))';`n" +
    "DECLARE @SourceDatabase sysname = N'$($sourceDatabase.Replace("'", "''"))';`n" +
    "DECLARE @Payload nvarchar(max) = N'$($payload.Replace("'", "''"))';`n"
[void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($fullOutputPath))
# CreateNew also prevents an accidental overwrite if another export completes concurrently.
$stream = [IO.File]::Open($fullOutputPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
$writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($true))
try { $writer.Write($header + $template) } finally { $writer.Dispose() }
Write-Output "Created private SQL export: $fullOutputPath"
Write-Output 'Default is preview with ROLLBACK. Edit PRODUKCIJA, inspect results, then set @Apply = 1 to commit.'
