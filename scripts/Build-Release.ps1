#Requires -Version 7.0
[CmdletBinding()]
param(
    [switch]$SqlTests,
    [switch]$PackageForIis,
    # Omit for same-origin hosting; for a separate static site use the public HTTPS API origin.
    [string]$ApiBaseUrl = '/'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$clientRoot = Join-Path $repoRoot 'vranjicreact.client'
$releaseRoot = Join-Path $repoRoot ('artifacts/releases/' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$publishRoot = Join-Path $releaseRoot 'app'
$webRoot = Join-Path $publishRoot 'wwwroot'

foreach ($parent in @((Join-Path $repoRoot 'artifacts'), (Join-Path $repoRoot 'artifacts/releases'))) {
    if ((Test-Path -LiteralPath $parent) -and ((Get-Item -LiteralPath $parent).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Release parents must not be symbolic links or junctions.'
    }
}

# Never clean/reuse a deployment directory or the source tree's wwwroot.
if (-not $webRoot.StartsWith((Join-Path $repoRoot 'artifacts/releases') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
    (Test-Path -LiteralPath $releaseRoot)) {
    throw 'Release output must be a new directory inside artifacts/releases.'
}
if ($ApiBaseUrl -ne '/') {
    $apiUri = $null
    if (-not [Uri]::TryCreate($ApiBaseUrl, [UriKind]::Absolute, [ref]$apiUri) -or
        $apiUri.Scheme -ne 'https' -or $apiUri.UserInfo -or $apiUri.Query -or $apiUri.Fragment) {
        throw 'ApiBaseUrl must be / or an absolute HTTPS API URL without credentials, query or fragment.'
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $clientRoot 'node_modules'))) {
    throw 'Frontend dependencies are missing. Run npm.cmd ci in vranjicreact.client first.'
}

function Invoke-CheckedCommand([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed (exit code $LASTEXITCODE). Release is not ready." }
}

function Invoke-EfCommand([string[]]$Arguments) {
    Push-Location (Join-Path $repoRoot 'VranjicReact.Server')
    try { Invoke-CheckedCommand -Executable dotnet -Arguments (@('ef') + $Arguments) }
    finally { Pop-Location }
}

$previousSqlFlag = [Environment]::GetEnvironmentVariable('DFB_RUN_SQL_TESTS', 'Process')
$previousSeedFlag = [Environment]::GetEnvironmentVariable('SeedAdminUser__Enabled', 'Process')
$previousApiBase = [Environment]::GetEnvironmentVariable('VITE_API_BASE_URL', 'Process')
Push-Location $repoRoot
try {
    $env:SeedAdminUser__Enabled = 'false'
    $env:DFB_RUN_SQL_TESTS = if ($SqlTests) { '1' } else { '0' }
    $env:VITE_API_BASE_URL = $ApiBaseUrl
    if (-not $SqlTests) { Write-Warning 'SQL integration tests are explicitly skipped; pass -SqlTests for disposable LocalDB tests.' }
    if ($PackageForIis) { & (Join-Path $PSScriptRoot 'Test-IisPackage.Tests.ps1') }
    Push-Location (Join-Path $repoRoot 'VranjicReact.Server')
    try { Invoke-CheckedCommand -Executable dotnet -Arguments @('tool', 'restore') }
    finally { Pop-Location }
    Invoke-CheckedCommand -Executable dotnet -Arguments @('test', 'VranjicReact.Server.Tests', '-c', 'Release', '--verbosity', 'minimal')
    Invoke-EfCommand -Arguments @('migrations', 'has-pending-model-changes', '--configuration', 'Release', '--no-build')
    Push-Location $clientRoot
    try {
        Invoke-CheckedCommand -Executable node -Arguments @('node_modules/typescript/bin/tsc', '--noEmit')
        Invoke-CheckedCommand -Executable node -Arguments @('node_modules/eslint/bin/eslint.js', 'src', '--max-warnings', '0')
        Invoke-CheckedCommand -Executable node -Arguments @('node_modules/vitest/vitest.mjs', 'run')
    } finally { Pop-Location }

    New-Item -ItemType Directory -Path $releaseRoot | Out-Null
    $operatorRoot = Join-Path $releaseRoot 'operator-files'
    New-Item -ItemType Directory -Path $operatorRoot | Out-Null
    $migrationPath = Join-Path $operatorRoot 'migrations-idempotent.sql'
    Invoke-EfCommand -Arguments @('migrations', 'script', '--idempotent', '--configuration', 'Release', '--no-build', '--output', $migrationPath)
    Copy-Item -LiteralPath (Join-Path $repoRoot 'docs/RELEASE_AND_LOCAL_TEST.md') -Destination $operatorRoot
    Invoke-CheckedCommand -Executable dotnet -Arguments @('publish', 'VranjicReact.Server', '-c', 'Release', '--no-restore', '-o', $publishRoot)
    Push-Location $clientRoot
    try {
        # Vite empties only the newly created artifact wwwroot, never the repository wwwroot.
        Invoke-CheckedCommand -Executable node -Arguments @('node_modules/vite/bin/vite.js', 'build', '--outDir', $webRoot, '--emptyOutDir')
    } finally { Pop-Location }

    $secretFiles = @(Get-ChildItem -LiteralPath $publishRoot -File -Recurse -Force | Where-Object {
        $_.Name -like '.env*' -or $_.Name -like 'appsettings*.json' -or $_.Extension -in '.pfx', '.pem', '.key'
    })
    if ($secretFiles.Count -gt 0) { throw 'Potential secret files found in release output. Do not deploy. File contents were not logged.' }
    if (-not (Test-Path -LiteralPath (Join-Path $webRoot 'index.html'))) { throw 'Frontend output is missing.' }
    $assembly = Join-Path $publishRoot 'VranjicReact.Server.dll'
    $manifest = [ordered]@{
        builtAtUtc = [DateTime]::UtcNow.ToString('O')
        sqlIntegrationTests = [bool]$SqlTests
        apiHosting = if ($ApiBaseUrl -eq '/') { 'same-origin' } else { 'separate-origin' }
        configurationMode = 'Preserve hosting appsettings.json; local configuration excluded'
        migrationsSha256 = (Get-FileHash -LiteralPath $migrationPath -Algorithm SHA256).Hash
        latestMigration = (Get-ChildItem -LiteralPath (Join-Path $repoRoot 'VranjicReact.Server/Migrations') -Filter '*.cs' |
            Where-Object { $_.BaseName -match '^\d{14}_' -and $_.Name -notlike '*.Designer.cs' } |
            Sort-Object Name | Select-Object -Last 1).BaseName
        assemblySha256 = (Get-FileHash -LiteralPath $assembly -Algorithm SHA256).Hash
        frontendIndexSha256 = (Get-FileHash -LiteralPath (Join-Path $webRoot 'index.html') -Algorithm SHA256).Hash
    }
    if ($PackageForIis) {
        # ZIP root is the app root; operator templates remain outside the public upload archive.
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archivePath = Join-Path $releaseRoot 'iis-upload.zip'
        [IO.Compression.ZipFile]::CreateFromDirectory($publishRoot, $archivePath)
        & (Join-Path $PSScriptRoot 'Test-IisPackage.ps1') -ArchivePath $archivePath
        Copy-Item -LiteralPath (Join-Path $repoRoot 'deploy/windows/app_offline.htm') -Destination $operatorRoot
        Copy-Item -LiteralPath (Join-Path $repoRoot 'docs/WINDOWS_PANEL_DEPLOYMENT.md') -Destination $operatorRoot
        $manifest['iisPackageSha256'] = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
        $manifest['deploymentMode'] = 'IIS framework-dependent; requires ASP.NET Core 8 Hosting Bundle'
    }
    # A manifest is written only after every check and both builds succeed.
    $manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $releaseRoot 'release-manifest.json') -Encoding utf8
    Write-Host "Validated release: $releaseRoot"
    Write-Host 'Hosting appsettings.json must be preserved. SQL was generated, not applied. No deployment or database update was performed.'
} finally {
    [Environment]::SetEnvironmentVariable('DFB_RUN_SQL_TESTS', $previousSqlFlag, 'Process')
    [Environment]::SetEnvironmentVariable('SeedAdminUser__Enabled', $previousSeedFlag, 'Process')
    [Environment]::SetEnvironmentVariable('VITE_API_BASE_URL', $previousApiBase, 'Process')
    Pop-Location
}
