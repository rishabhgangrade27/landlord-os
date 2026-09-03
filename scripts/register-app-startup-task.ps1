# One-time setup: registers a Windows Scheduled Task that starts the
# LandlordOS server automatically whenever this Windows user logs in, so
# the app survives a PC restart without anyone remembering to double-click
# start.bat. This is what keeps the 2 AM backup / 8 AM overdue-check tasks
# reliable (see register-daily-backup-task.ps1 / register-daily-overdue-task.ps1).
#
# Run this once, as the same Windows user the app should run under:
#   powershell -ExecutionPolicy Bypass -File scripts\register-app-startup-task.ps1
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'run-app.ps1'
$taskName = 'LandlordOS App Server'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force

Write-Output "Registered scheduled task '$taskName' - starts the app automatically at login."
Write-Output "You can still use start.bat any time to start it manually (e.g. right after this setup, without logging out first)."
