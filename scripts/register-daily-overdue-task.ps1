# One-time setup: registers a Windows Scheduled Task that runs
# scripts/run-daily-overdue.ps1 every day at 8 AM, as long as the app
# (npm run dev / npm run start) is already running on localhost:3000.
#
# Run this once, as the same Windows user the app runs under:
#   powershell -ExecutionPolicy Bypass -File scripts\register-daily-overdue-task.ps1
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'run-daily-overdue.ps1'
$taskName = 'LandlordOS Daily Overdue Check'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At 8am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force

Write-Output "Registered scheduled task '$taskName' - runs daily at 8 AM."
Write-Output "Note: this only works while the LandlordOS server is running on localhost:3000."
