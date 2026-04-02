[CmdletBinding()]
param(
  [string]$TaskName = 'TbtPaperTerminal_Autostart'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "Removed Scheduled Task: $TaskName"
  exit 0
}

Write-Output "Scheduled Task not found: $TaskName"

