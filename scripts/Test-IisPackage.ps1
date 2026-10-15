#Requires -Version 7.0
[CmdletBinding()]
param([Parameter(Mandatory)][string]$ArchivePath)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ArchivePath).Path)
try {
    $entries = @($archive.Entries)
    foreach ($entry in $entries) {
        $name = $entry.FullName.Replace('\', '/')
        $leaf = [IO.Path]::GetFileName($name)
        if ($name.StartsWith('/') -or $name.Contains(':') -or $name.Split('/') -contains '..') { throw 'Unsafe archive path.' }
        if ($leaf -like '.env*' -or $leaf -like 'appsettings*.json' -or $leaf -like 'key-*.xml' -or $leaf -eq 'app_offline.htm' -or $leaf -eq 'launchSettings.json' -or
            [IO.Path]::GetExtension($leaf) -in '.pfx', '.pem', '.key', '.sql', '.bak' -or
            $name.Split('/') -contains '.git') {
            throw 'Private, operational, or development-only files must not be included in the upload ZIP.'
        }
    }
    foreach ($required in @('web.config', 'VranjicReact.Server.dll', 'VranjicReact.Server.runtimeconfig.json', 'VranjicReact.Server.deps.json', 'wwwroot/index.html')) {
        if ($null -eq $archive.GetEntry($required)) { throw "Missing package entry: $required. ZIP must contain app contents, not an enclosing folder." }
    }
    function Read-Entry([string]$Name) {
        $reader = [IO.StreamReader]::new($archive.GetEntry($Name).Open())
        try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
    }
    [xml]$config = Read-Entry 'web.config'
    $aspNet = $config.SelectSingleNode('/configuration/system.webServer/aspNetCore')
    $handler = $config.SelectSingleNode('/configuration/system.webServer/handlers/add[@name="aspNetCore"]')
    if ($null -eq $aspNet -or $null -eq $handler -or $handler.GetAttribute('modules') -ne 'AspNetCoreModuleV2' -or
        $aspNet.GetAttribute('processPath') -ne 'dotnet' -or $aspNet.GetAttribute('arguments') -ne '.\VranjicReact.Server.dll' -or
        $aspNet.GetAttribute('hostingModel') -ne 'inprocess' -or
        $aspNet.GetAttribute('stdoutLogEnabled') -ne 'false') {
        throw 'Expected framework-dependent IIS configuration with stdout logging disabled.'
    }
    if ($null -ne $config.SelectSingleNode('//environmentVariable')) {
        throw 'Upload ZIP must not embed hosting environment values in web.config. Configure them separately.'
    }
    $runtime = Read-Entry 'VranjicReact.Server.runtimeconfig.json' | ConvertFrom-Json
    $framework = @($runtime.runtimeOptions.frameworks | Where-Object { $_.name -eq 'Microsoft.AspNetCore.App' -and $_.version -like '8.*' })
    if ($framework.Count -ne 1) { throw 'Expected ASP.NET Core 8 framework-dependent runtime configuration.' }
    Write-Host "IIS upload ZIP validated ($($entries.Count) entries). Hosting Bundle and server permissions still require provider confirmation."
} finally { $archive.Dispose() }
