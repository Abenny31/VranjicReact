#Requires -Version 7.0
[CmdletBinding()]
param([Parameter(Mandatory)][string]$ReleasePath)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseRoot = (Resolve-Path -LiteralPath $ReleasePath).Path
$appRoot = Join-Path $releaseRoot 'app'
$manifest = Get-Content -LiteralPath (Join-Path $releaseRoot 'release-manifest.json') -Raw | ConvertFrom-Json
if ($manifest.apiHosting -ne 'same-origin') { throw 'Local release testing requires a same-origin build.' }
$assembly = Join-Path $appRoot 'VranjicReact.Server.dll'
if ((Get-FileHash -LiteralPath $assembly -Algorithm SHA256).Hash -ne $manifest.assemblySha256 -or
    (Get-FileHash -LiteralPath (Join-Path $appRoot 'wwwroot/index.html') -Algorithm SHA256).Hash -ne $manifest.frontendIndexSha256) {
    throw 'Release files do not match the validated manifest. Rebuild the release.'
}
if (@(Get-ChildItem -LiteralPath $appRoot -Force -File | Where-Object { $_.Name -like '.env*' -or $_.Name -like 'appsettings*.json' }).Count -gt 0) {
    throw 'Use the original release without added configuration files. Local settings are supplied by this script.'
}
$settings = Get-Content -LiteralPath (Join-Path $repoRoot 'VranjicReact.Server/appsettings.json') -Raw | ConvertFrom-Json
# The release excludes appsettings; forward only the explicitly public display/contact settings.
# Explicit process variables retain precedence over the local JSON values.
$publicContactArguments = @()
$publicContactSection = $settings.PSObject.Properties['PublicContact']
if ($null -ne $publicContactSection -and $null -ne $publicContactSection.Value) {
    foreach ($name in @('Address', 'Email', 'SupportEmail', 'Phone', 'FacebookUrl')) {
        $property = $publicContactSection.Value.PSObject.Properties[$name]
        if ($null -ne $property -and $null -eq [Environment]::GetEnvironmentVariable("PublicContact__$name", 'Process')) {
            $publicContactArguments += "--PublicContact:$name=$($property.Value)"
        }
    }
}
$connectionString = $settings.ConnectionStrings.DefaultConnection
$displaySection = $settings.PSObject.Properties['PublicDisplay']
if ($null -ne $displaySection -and $null -ne $displaySection.Value -and
    $null -eq [Environment]::GetEnvironmentVariable('PublicDisplay__InitialAreaCount', 'Process')) {
    $initialAreaCount = $displaySection.Value.PSObject.Properties['InitialAreaCount']
    if ($null -ne $initialAreaCount) { $publicContactArguments += "--PublicDisplay:InitialAreaCount=$($initialAreaCount.Value)" }
}
if ($null -ne $displaySection -and $null -ne $displaySection.Value) {
    foreach ($mapName in @('AreaTagSlugs', 'ContentTagSlugs')) {
        $map = $displaySection.Value.PSObject.Properties[$mapName]
        if ($null -eq $map -or $null -eq $map.Value) { continue }
        foreach ($entry in $map.Value.PSObject.Properties) {
            $values = @($entry.Value)
            for ($index = 0; $index -lt $values.Count; $index++) {
                $key = "PublicDisplay:${mapName}:$($entry.Name):$index"
                if ($null -eq [Environment]::GetEnvironmentVariable($key.Replace(':', '__'), 'Process')) {
                    $publicContactArguments += "--$key=$($values[$index])"
                }
            }
        }
    }
}
$connection = [System.Data.SqlClient.SqlConnectionStringBuilder]::new($connectionString)
if ($connection.DataSource -ine '(localdb)\mssqllocaldb' -or $connection.InitialCatalog -ine 'VranjicDb' -or
    -not $connection.IntegratedSecurity -or $connection.AttachDBFilename) {
    throw 'Local testing requires the existing VranjicDb on (localdb)\mssqllocaldb with Windows authentication.'
}

# Override inherited host/.env settings only for this process and restore them on exit.
$localEnvironment = @{
    DOTENV_PATH = $null
    ASPNETCORE_ENVIRONMENT = 'Production'
    DOTNET_ENVIRONMENT = 'Production'
    ASPNETCORE_HTTPS_PORT = $null
    ASPNETCORE_HTTPS_PORTS = $null
    ASPNETCORE_HOSTINGSTARTUPASSEMBLIES = $null
}
$previousEnvironment = @{}
foreach ($name in $localEnvironment.Keys) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $localEnvironment[$name], 'Process')
}
Push-Location $appRoot
try {
    Write-Host 'Local release: http://localhost:5268 | Database: LocalDB / VranjicDb | Stop: Ctrl+C'
    Write-Host 'Uses the published frontend/backend. No migrations or user seeding are performed.'
    & dotnet $assembly --contentRoot $appRoot --urls 'http://localhost:5268' `
        --ConnectionStrings:DefaultConnection $connectionString --AllowedHosts 'localhost;127.0.0.1;[::1]' `
        --SeedAdminUser:Enabled false --Logging:LogLevel:Default Information --Logging:LogLevel:Microsoft.AspNetCore Warning @publicContactArguments
    if ($LASTEXITCODE -ne 0) { throw "Local release exited with code $LASTEXITCODE." }
} finally {
    Pop-Location
    foreach ($name in $previousEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
    }
}
