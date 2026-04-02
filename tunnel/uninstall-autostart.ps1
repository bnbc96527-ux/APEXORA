[CmdletBinding()]
param(
  [string]$TaskName = 'Apexora_Tunnel_Autostart',
  [switch]$AlsoRemoveOld,
  [string]$OldTaskName = 'TbtPaperTerminal_Autostart'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Remove-TaskIfExists([string]$Name) {
  if ([string]::IsNullOrWhiteSpace($Name)) { return }

  if (Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $Name -Confirm:$false
    Write-Output "Removed Scheduled Task: $Name"
  } else {
    Write-Output "Scheduled Task not found: $Name"
  }
}

Remove-TaskIfExists -Name $TaskName

if ($AlsoRemoveOld) {
  Remove-TaskIfExists -Name $OldTaskName
}

