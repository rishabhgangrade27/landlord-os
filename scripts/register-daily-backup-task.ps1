# One-time setup: registers a Windows Scheduled Task that runs
# scripts/run-daily-backup.ps1 every day at 2 AM (quiet hours, before the
# 8 AM daily-overdue check), as long as the app (npm run dev / npm run
# start) is already running on localhost:3000.
#
# Run this once, as the same Windows user the app runs under:
#   powershell -ExecutionPolicy Bypass -File scripts\register-daily-backup-task.ps1
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'run-daily-backup.ps1'
$taskName = 'LandlordOS Daily Backup'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force

Write-Output "Registered scheduled task '$taskName' - runs daily at 2 AM."
Write-Output "Note: this only works while the LandlordOS server is running on localhost:3000."
