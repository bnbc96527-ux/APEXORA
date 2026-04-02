[CmdletBinding()]
param(
  [string]$RepoRoot = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-LocalPortOpen {
  param([Parameter(Mandatory = $true)][int]$Port)
  try {
    return (Test-NetConnection -ComputerName 'localhost' -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue)
  } catch {
    return $false
  }
}

try {
  if (-not $RepoRoot) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $RepoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
  } else {
    $RepoRoot = (Resolve-Path $RepoRoot).Path
  }

  $logDir = Join-Path $RepoRoot 'logs'
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  $autostartLog = Join-Path $logDir 'autostart.log'

  $npm = (Get-Command npm -ErrorAction Stop).Source

  Add-Content -Path $autostartLog -Value ("[{0}] Starting check in {1}" -f (Get-Date -Format o), $RepoRoot)

  $uiAlreadyUp = Test-LocalPortOpen -Port 5173
  $apiAlreadyUp = Test-LocalPortOpen -Port 4010

  Add-Content -Path $autostartLog -Value ("[{0}] UI 5173 up: {1}" -f (Get-Date -Format o), $uiAlreadyUp)
  Add-Content -Path $autostartLog -Value ("[{0}] API 4010 up: {1}" -f (Get-Date -Format o), $apiAlreadyUp)

  $uiProc = $null
  $apiProc = $null

  # UI (Vite) is localhost-bound by default; prefer checking localhost (IPv6 ::1) over 127.0.0.1.
  if (-not $uiAlreadyUp) {
    $uiOut = Join-Path $logDir 'ui.out.log'
    $uiErr = Join-Path $logDir 'ui.err.log'
    $uiProc = Start-Process `
      -FilePath $npm `
      -ArgumentList @('run', 'dev:ui') `
      -WorkingDirectory $RepoRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput $uiOut `
      -RedirectStandardError $uiErr `
      -PassThru
    Add-Content -Path $autostartLog -Value ("[{0}] Started UI (npm run dev:ui) PID={1}" -f (Get-Date -Format o), $uiProc.Id)
  }

  # Local API used by the UI proxy at /live-api
  if (-not $apiAlreadyUp) {
    $apiOut = Join-Path $logDir 'api.out.log'
    $apiErr = Join-Path $logDir 'api.err.log'
    $apiProc = Start-Process `
      -FilePath $npm `
      -ArgumentList @('run', 'dev:api') `
      -WorkingDirectory $RepoRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput $apiOut `
      -RedirectStandardError $apiErr `
      -PassThru
    Add-Content -Path $autostartLog -Value ("[{0}] Started API (npm run dev:api) PID={1}" -f (Get-Date -Format o), $apiProc.Id)
  }

  if ($null -ne $uiProc -or $null -ne $apiProc) {
    $pidPath = Join-Path $logDir 'servers.pids.json'
    $payload = [ordered]@{
      startedAt = (Get-Date).ToString('o')
      uiPid = if ($null -ne $uiProc) { $uiProc.Id } else { $null }
      apiPid = if ($null -ne $apiProc) { $apiProc.Id } else { $null }
    }
    $payload | ConvertTo-Json | Set-Content -Path $pidPath -Encoding UTF8

    Start-Sleep -Seconds 2
    Add-Content -Path $autostartLog -Value ("[{0}] UI 5173 up after start: {1}" -f (Get-Date -Format o), (Test-LocalPortOpen -Port 5173))
    Add-Content -Path $autostartLog -Value ("[{0}] API 4010 up after start: {1}" -f (Get-Date -Format o), (Test-LocalPortOpen -Port 4010))
  } else {
    Add-Content -Path $autostartLog -Value ("[{0}] Nothing to start (already running)" -f (Get-Date -Format o))
  }

  exit 0
} catch {
  Add-Content -Path $autostartLog -Value ("[{0}] ERROR: {1}" -f (Get-Date -Format o), $_.Exception.Message)
  exit 1
}
