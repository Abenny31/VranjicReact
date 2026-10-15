#Requires -Version 7.0
[CmdletBinding()]
param([Parameter(Mandatory)][Uri]$BaseUrl)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $BaseUrl.IsAbsoluteUri -or $BaseUrl.UserInfo -or $BaseUrl.Query -or $BaseUrl.Fragment -or
    ($BaseUrl.Scheme -ne 'https' -and -not ($BaseUrl.IsLoopback -and $BaseUrl.Scheme -eq 'http'))) {
    throw 'Use an absolute HTTPS application URL without credentials (HTTP is allowed only on loopback).'
}
$base = $BaseUrl.AbsoluteUri.TrimEnd('/')
$checks = @(
    @{ Path = '/health/live'; Status = 200; Kind = 'health' },
    @{ Path = '/health/ready'; Status = 200; Kind = 'health' },
    @{ Path = '/api/updates?pageSize=1'; Status = 200; Kind = 'feed' },
    @{ Path = '/api/areas'; Status = 200; Kind = 'array' },
    @{ Path = '/api/gallery/albums?limit=1'; Status = 200; Kind = 'paged' },
    @{ Path = '/api/gallery?limit=1&imagesOnly=true'; Status = 200; Kind = 'paged' },
    @{ Path = '/api/news?limit=1'; Status = 200; Kind = 'paged' },
    @{ Path = '/api/blog?limit=1'; Status = 200; Kind = 'paged' },
    @{ Path = '/api/announcements?limit=1'; Status = 200; Kind = 'paged' },
    @{ Path = '/api/moderation/queue'; Status = 401; Kind = 'private' },
    @{ Path = '/api/updates/editorial'; Status = 401; Kind = 'private' },
    @{ Path = '/api/account/users'; Status = 401; Kind = 'private' },
    @{ Path = '/api/contact/messages'; Status = 401; Kind = 'private' },
    @{ Path = '/api/moderator-assignments'; Status = 401; Kind = 'private' },
    @{ Path = '/aktualno'; Status = 200; Kind = 'html' }
)
$failures = 0
foreach ($check in $checks) {
    try {
        # Anonymous GET only: no cookies, tokens, content writes or redirects to another host.
        $response = Invoke-WebRequest -Uri ($base + $check.Path) -Method Get -TimeoutSec 15 -MaximumRedirection 0 -SkipHttpErrorCheck -NoProxy:$BaseUrl.IsLoopback
        if ([int]$response.StatusCode -ne $check.Status) { throw 'Unexpected HTTP status.' }
        if ($check.Kind -eq 'health' -and $response.Content.Trim() -ne 'Healthy') { throw 'Health check failed.' }
        if ($check.Kind -in 'feed', 'array', 'paged') {
            if ([string]$response.Headers['Content-Type'] -notlike 'application/json*') { throw 'Expected JSON response.' }
            $json = $response.Content | ConvertFrom-Json -NoEnumerate
            if ($check.Kind -eq 'feed' -and ($null -eq $json.items -or $null -eq $json.hasMore)) { throw 'Invalid feed contract.' }
            if ($check.Kind -in 'array', 'paged' -and $json -isnot [Array]) { throw 'Expected array contract.' }
            if ($check.Kind -eq 'paged' -and [string]$response.Headers['X-Has-More'] -notin 'true', 'false') { throw 'Pagination header missing.' }
        }
        if ($check.Kind -eq 'html' -and [string]$response.Headers['Content-Type'] -notlike 'text/html*') { throw 'SPA fallback is unavailable.' }
        Write-Host "PASS $($check.Path) ($($check.Status))"
    } catch {
        # Never print response bodies, exception details, URLs with credentials, or configuration.
        Write-Warning "FAIL $($check.Path): connection, status or response contract check failed."
        $failures++
    }
}
if ($failures -gt 0) { throw "$failures smoke checks failed. No application data was changed." }
Write-Host 'All anonymous read-only checks passed. Login and editorial writes must be tested on staging/disposable data.'
