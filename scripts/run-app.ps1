# Starts (or confirms) PostgreSQL, then runs the LandlordOS server.
# Used by the "LandlordOS App Server" Scheduled Task so the app comes back
# up automatically after a PC restart, otherwise the 2 AM backup and 8 AM
# overdue-check tasks would silently do nothing (they only work while the
# app is actually running on localhost:3000).
$ErrorActionPreference = 'Stop'

$pgService = Get-Service -Name 'postgresql*' | Select-Object -First 1
if ($null -eq $pgService) {
    Write-Output "No PostgreSQL service found on this machine. See INSTALL-GUIDE.md."
    exit 1
}
if ($pgService.Status -ne 'Running') {
    Start-Service $pgService.Name
}

Set-Location (Join-Path $PSScriptRoot '..')
npm run start
