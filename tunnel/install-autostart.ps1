[CmdletBinding()]
param(
  [string]$TaskName = 'Apexora_Tunnel_Autostart',
  [switch]$RemoveOld,
  [string]$OldTaskName = 'TbtPaperTerminal_Autostart',
  [switch]$RunNow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$tunnelDir = Resolve-Path $PSScriptRoot
$runner = Join-Path $tunnelDir 'tunnel.ps1'

if (-not (Test-Path $runner)) {
  throw "Missing tunnel script: $runner"
}

if ($RemoveOld) {
  if (Get-ScheduledTask -TaskName $OldTaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $OldTaskName -Confirm:$false
    Write-Output "Removed old Scheduled Task: $OldTaskName"
  }
}

$psExe = (Get-Command powershell.exe -ErrorAction Stop).Source
$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$runner`""

$action = New-ScheduledTaskAction -Execute $psExe -Argument $arg -WorkingDirectory $tunnelDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -InputObject $task | Out-Null
Write-Output "Installed Scheduled Task: $TaskName"

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
  Write-Output "Started Scheduled Task: $TaskName"
}

