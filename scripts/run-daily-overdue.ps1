# Called once a day by a Windows Scheduled Task (see scripts/register-daily-overdue-task.ps1
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
    $response = Invoke-RestMethod -Uri 'http://localhost:3000/api/cron/daily-overdue' `
        -Method Post `
        -Headers @{ Authorization = "Bearer $secret" }
    Write-Output ("Daily overdue check done: checked={0} flagged={1} drafted={2} skipped={3}" -f `
        $response.checked, $response.flagged, $response.drafted.Count, $response.skipped.Count)
} catch {
    Write-Error "Daily overdue check failed: $_"
    exit 1
}
