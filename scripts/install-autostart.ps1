[CmdletBinding()]
param(
  [string]$TaskName = 'TbtPaperTerminal_Autostart',
  [switch]$RunNow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$runner = Join-Path $repoRoot 'scripts\\run-servers.ps1'

if (-not (Test-Path $runner)) {
  throw "Missing runner script: $runner"
}

$psExe = (Get-Command powershell.exe -ErrorAction Stop).Source
$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$runner`""

$action = New-ScheduledTaskAction -Execute $psExe -Argument $arg -WorkingDirectory $repoRoot
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

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
}

Write-Output "Installed Scheduled Task: $TaskName"
