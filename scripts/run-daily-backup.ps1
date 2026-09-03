# Called once a day by a Windows Scheduled Task (see scripts/register-daily-backup-task.ps1
# for how to set that up). Reads CRON_SECRET out of .env.local so it's never hardcoded
# into the Task Scheduler action itself, and hits the local app's cron endpoint.
$ErrorActionPreference = 'Stop'

$envPath = Join-Path $PSScriptRoot '..\.env.local'
$secretLine = Get-Content $envPath | Where-Object { $_ -like 'CRON_SECRET=*' }
if (-not $secretLine) {
    Write-Error 'CRON_SECRET not found in .env.local'
    exit 1
}
$secret = $secretLine.Substring('CRON_SECRET='.Length)

try {
    $response = Invoke-RestMethod -Uri 'http://localhost:3000/api/cron/daily-backup' `
        -Method Post `
        -Headers @{ Authorization = "Bearer $secret" }
    Write-Output ("Daily backup done: file={0} prunedOldSnapshots={1}" -f `
        $response.filename, $response.prunedOldSnapshots)
} catch {
    Write-Error "Daily backup failed: $_"
    exit 1
}
