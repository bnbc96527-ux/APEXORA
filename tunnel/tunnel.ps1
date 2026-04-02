<#
  tunnel.ps1

  Starts a localhost.run reverse tunnel for a local web server on http://localhost:8080
  using:
    ssh -R 80:localhost:8080 nokey@localhost.run

  Requirements (implemented):
  - stdout/stderr -> tunnel.log
  - extract first https:// URL from tunnel.log output
  - print public URL
  - keep SSH process alive
- store PID in tunnel.pid
#>

param(
  [int]$LocalPort = 8080,
  [int]$RemotePort = 80,
  [string]$UserHost = 'nokey@localhost.run'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info([string]$Message) {
  Write-Host "[tunnel] $Message"
}

function Get-FirstHttpsUrlFromText([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
  $m = [regex]::Match($Text, 'https://[^\s\)\]\}">''`]+')
  if ($m.Success) { return $m.Value }
  return $null
}

function Get-TunnelUrlFromText([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }

  # Prefer the actual tunnel URL line over other docs/social links.
  $m = [regex]::Match(
    $Text,
    'tunneled with[^\r\n]*?(https://[^\s\)\]\}">''`]+)',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )
  if ($m.Success) { return $m.Groups[1].Value }

  return $null
}

function Get-LatestTunnelUrlFromText([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }

  $ms = [regex]::Matches(
    $Text,
    'tunneled with[^\r\n]*?(https://[^\s\)\]\}">''`]+)',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )

  if ($ms.Count -lt 1) { return $null }
  return $ms[$ms.Count - 1].Groups[1].Value
}

function Test-LocalPortListening([int]$Port) {
  try {
    # Test-NetConnection is slower than a raw socket but much more reliable on
    # Windows when localhost resolves to both IPv6 and IPv4.
    return (Test-NetConnection -ComputerName 'localhost' -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue)
  } catch {
    return $false
  }
}

$dir = $PSScriptRoot
$logPath = Join-Path $dir 'tunnel.log'
$pidPath = Join-Path $dir 'tunnel.pid'
$urlPath = Join-Path $dir 'tunnel.url'
$knownHostsPath = Join-Path $dir 'known_hosts'

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "OpenSSH client not found. Install 'OpenSSH Client' in Windows Optional Features, then retry."
}

if (Test-Path $pidPath) {
  $existingPidRaw = (Get-Content -Path $pidPath -ErrorAction SilentlyContinue | Select-Object -First 1)
  $existingPid = 0
  [void][int]::TryParse(($existingPidRaw -as [string]), [ref]$existingPid)
  if ($existingPid -gt 0) {
    $p = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($p) {
      $existingUrl = $null
      if (Test-Path $logPath) {
        $existingUrl = Get-LatestTunnelUrlFromText (Get-Content -Path $logPath -Raw -ErrorAction SilentlyContinue)
      }
      Write-Info "Tunnel already running (PID $existingPid)."
      if ($existingUrl) {
        Write-Info "Public URL: $existingUrl"
        Set-Content -Path $urlPath -Value $existingUrl -Encoding ascii
      }
      Write-Info "Use stop.cmd to stop it, or delete tunnel.pid if it's stale."
      return
    }
  }
}

if (-not (Test-LocalPortListening -Port $LocalPort)) {
  Write-Info "Warning: nothing is listening on http://localhost:$LocalPort yet."
  Write-Info "Start your local web server first, then keep this tunnel running."
}

New-Item -ItemType File -Path $logPath -Force | Out-Null
Clear-Content -Path $logPath -ErrorAction SilentlyContinue

$forwardSpec = "$RemotePort`:localhost:$LocalPort"
$args = @(
  '-o', 'BatchMode=yes',
  '-o', 'StrictHostKeyChecking=accept-new',
  '-o', "UserKnownHostsFile=`"$knownHostsPath`"",
  '-o', 'ExitOnForwardFailure=yes',
  '-o', 'ConnectTimeout=15',
  '-o', 'ServerAliveInterval=30',
  '-o', 'ServerAliveCountMax=3',
  '-R', $forwardSpec,
  $UserHost
)

Write-Info "Starting: ssh $($args -join ' ')"
Write-Info "Logging to: $logPath"


# NOTE: localhost.run prints the public URL via the SSH session output.
# On Windows, OpenSSH behaves differently when stdout/stderr are pipes (no URL output),
# so we redirect output directly to a file using cmd.exe redirection.
$cmdExe = (Get-Command cmd.exe -ErrorAction Stop).Source
$sshArgString = ($args -join ' ')
$cmdArg = "/d /s /c ssh $sshArgString 1>>`"$logPath`" 2>>&1"

$proc = Start-Process -FilePath $cmdExe -ArgumentList $cmdArg -WorkingDirectory $dir -WindowStyle Hidden -PassThru

Set-Content -Path $pidPath -Value $proc.Id -Encoding ascii
Write-Info "Tunnel PID: $($proc.Id) (saved to tunnel.pid)"

$publicUrl = $null
try {
  # Wait up to 60s for localhost.run to print the https URL
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while (-not $publicUrl -and -not $proc.HasExited -and $sw.Elapsed.TotalSeconds -lt 60) {
    Start-Sleep -Milliseconds 250
    $proc.Refresh()
    if (Test-Path $logPath) {
      $publicUrl = Get-LatestTunnelUrlFromText (Get-Content -Path $logPath -Raw -ErrorAction SilentlyContinue)
    }
  }

  if (-not $publicUrl -and (Test-Path $logPath)) {
    $publicUrl = Get-LatestTunnelUrlFromText (Get-Content -Path $logPath -Raw -ErrorAction SilentlyContinue)
  }

  if ($publicUrl) {
    Set-Content -Path $urlPath -Value $publicUrl -Encoding ascii
    Write-Host ""
    Write-Host "Public URL: $publicUrl"
    Write-Host ""
  } else {
    $firstHttps = $null
    if (Test-Path $logPath) {
      $firstHttps = Get-FirstHttpsUrlFromText (Get-Content -Path $logPath -Raw -ErrorAction SilentlyContinue)
    }

    if ($firstHttps) {
      Write-Info "Public tunnel URL not detected yet. First https:// link seen: $firstHttps"
    } else {
      Write-Info "Public URL not detected yet. Check tunnel.log for details."
    }
  }

  Write-Info "Tunnel is running. Keep this window open."
  Write-Info "Stop it via stop.cmd (recommended) or Ctrl+C here."

  $lastUrlCheck = [System.Diagnostics.Stopwatch]::StartNew()
  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 1
    $proc.Refresh()

    if ($lastUrlCheck.Elapsed.TotalSeconds -ge 10) {
      $lastUrlCheck.Restart()
      if (Test-Path $logPath) {
        $latest = Get-LatestTunnelUrlFromText (Get-Content -Path $logPath -Raw -ErrorAction SilentlyContinue)
        if ($latest -and $latest -ne $publicUrl) {
          $publicUrl = $latest
          Set-Content -Path $urlPath -Value $publicUrl -Encoding ascii
          Write-Info "Public URL updated: $publicUrl"
        }
      }
    }
  }

  $proc.Refresh()
  Write-Info "Tunnel process exited with code $($proc.ExitCode)."
} finally {
  if (Test-Path $pidPath) {
    Remove-Item -Path $pidPath -Force -ErrorAction SilentlyContinue
  }
  if ($proc -and -not $proc.HasExited) {
    try {
      # Kill the whole tree so the ssh child doesn't get orphaned.
      & taskkill.exe /PID $proc.Id /T /F *> $null
    } catch {}
  }
}
