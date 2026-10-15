#Requires -Version 7.0
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('DFB_ZipTest_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$validator = Join-Path $PSScriptRoot 'Test-IisPackage.ps1'
$validEntries = @{
    'web.config' = '<configuration><system.webServer><handlers><add name="aspNetCore" modules="AspNetCoreModuleV2" /></handlers><aspNetCore processPath="dotnet" arguments=".\VranjicReact.Server.dll" stdoutLogEnabled="false" hostingModel="inprocess" /></system.webServer></configuration>'
    'VranjicReact.Server.dll' = 'fixture only, not an executable'
    'VranjicReact.Server.deps.json' = '{}'
    'VranjicReact.Server.runtimeconfig.json' = '{"runtimeOptions":{"frameworks":[{"name":"Microsoft.AspNetCore.App","version":"8.0.0"}]}}'
    'wwwroot/index.html' = '<html></html>'
}

function Test-Fixture([string]$Name, [hashtable]$Entries, [string]$ExpectedError = '') {
    $archivePath = Join-Path $testRoot ($Name + '.zip')
    $archive = [IO.Compression.ZipFile]::Open($archivePath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($entryName in $Entries.Keys) {
            $writer = [IO.StreamWriter]::new($archive.CreateEntry($entryName).Open())
            try { $writer.Write($Entries[$entryName]) } finally { $writer.Dispose() }
        }
    } finally { $archive.Dispose() }
    $caught = $null
    try { & $validator -ArchivePath $archivePath } catch { $caught = $_.Exception.Message }
    if ($ExpectedError) {
        if (-not $caught -or -not $caught.Contains($ExpectedError)) { throw "Fixture '$Name' did not fail as expected." }
    } elseif ($caught) { throw "Valid fixture '$Name' was rejected." }
    Write-Host "PASS $Name"
}

try {
    Test-Fixture 'valid' $validEntries
    foreach ($forbidden in @('.env', 'wwwroot/.env.production', 'private/key-test.xml', 'app_offline.htm',
        'Properties/launchSettings.json', 'private/cert.pfx', 'database.sql', 'database.bak', '.git/config',
        'appsettings.json', 'appsettings.Development.json', 'appsettings.Production.json', 'wwwroot/appsettings.json')) {
        $entries = $validEntries.Clone()
        $entries[$forbidden] = 'non-secret fixture'
        Test-Fixture ('forbidden-' + $forbidden.Replace('/', '-')) $entries 'Private, operational, or development-only'
    }
    foreach ($unsafePath in @('../outside.txt', '/absolute.txt', 'C:/absolute.txt', 'wwwroot\..\outside.txt')) {
        $entries = $validEntries.Clone()
        $entries[$unsafePath] = 'fixture'
        Test-Fixture ('unsafe-' + [guid]::NewGuid().ToString('N')) $entries 'Unsafe archive path'
    }
    $entries = @{}
    foreach ($entryName in $validEntries.Keys) { $entries['app/' + $entryName] = $validEntries[$entryName] }
    Test-Fixture 'enclosing-folder' $entries 'Missing package entry'
    $entries = $validEntries.Clone()
    $entries.Remove('VranjicReact.Server.dll')
    Test-Fixture 'missing-dll' $entries 'Missing package entry'
    $entries = $validEntries.Clone()
    $entries['web.config'] = $entries['web.config'].Replace('stdoutLogEnabled="false"', 'stdoutLogEnabled="true"')
    Test-Fixture 'stdout-enabled' $entries 'Expected framework-dependent IIS configuration'
    $entries = $validEntries.Clone()
    $entries['web.config'] = $entries['web.config'].Replace('AspNetCoreModuleV2', 'UnsupportedModule')
    Test-Fixture 'wrong-handler' $entries 'Expected framework-dependent IIS configuration'
    $entries = $validEntries.Clone()
    $entries['web.config'] = $entries['web.config'].Replace('hostingModel="inprocess"', 'hostingModel="outofprocess"')
    Test-Fixture 'wrong-hosting-model' $entries 'Expected framework-dependent IIS configuration'
    $entries = $validEntries.Clone()
    $entries['web.config'] = $entries['web.config'].Replace('hostingModel="inprocess" />', 'hostingModel="inprocess"><environmentVariables><environmentVariable name="TEST" value="fixture" /></environmentVariables></aspNetCore>')
    Test-Fixture 'embedded-environment' $entries 'must not embed hosting environment values'
    $entries = $validEntries.Clone()
    $entries['VranjicReact.Server.runtimeconfig.json'] = $entries['VranjicReact.Server.runtimeconfig.json'].Replace('8.0.0', '9.0.0')
    Test-Fixture 'wrong-framework' $entries 'Expected ASP.NET Core 8'
    Write-Host 'All 25 package-validator scenarios passed. No application or database was started.'
} finally {
    # Remove only the unique fixture directory created by this script.
    $resolvedTestRoot = (Resolve-Path -LiteralPath $testRoot).Path
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if ($resolvedTestRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetFileName($resolvedTestRoot) -match '^DFB_ZipTest_[a-f0-9]{32}$') {
        Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
    } else { throw 'Refusing fixture cleanup outside the allocated temporary directory.' }
}
