# Localhost.run Tunnel (Windows)

This folder exposes a **local web server** running at:

- `http://localhost:8080`

...to the public internet using **localhost.run** over SSH:

```bash
ssh -R 80:localhost:8080 nokey@localhost.run
```

It is designed to work on:

- Windows 10
- Windows 11
- PowerShell 5+

## Prerequisites

1. Ensure your local web server is running:
   - Open `http://localhost:8080` in a browser and confirm it loads.

2. Ensure Windows OpenSSH Client is installed:
   - In PowerShell:
     ```powershell
     ssh -V
     ```
   - If missing: Windows Settings -> Apps -> Optional features -> Add an optional feature -> **OpenSSH Client**

## Start The Tunnel

Option A (recommended):

```bat
start.cmd
```

Option B (PowerShell):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tunnel.ps1
```

What it does:

- Starts the SSH reverse tunnel
- Writes SSH output to `tunnel.log`
- Writes the current public URL to `tunnel.url`
- Extracts the public tunnel URL printed by localhost.run and prints it to the console
- Saves the tunnel PID into `tunnel.pid`
- Keeps the tunnel running (keep the window open)

## Stop The Tunnel

```bat
stop.cmd
```

This reads the PID from `tunnel.pid` and terminates the tunnel process.

## Restart The Tunnel

```bat
stop.cmd
start.cmd
```

## Auto Start On Logon (Windows Scheduled Task)

Install the Scheduled Task `Apexora_Tunnel_Autostart` (and optionally remove the old `TbtPaperTerminal_Autostart` task):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-autostart.ps1 -RemoveOld -RunNow
```

Uninstall:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall-autostart.ps1
```

Restart the Scheduled Task:

```powershell
Stop-ScheduledTask -TaskName Apexora_Tunnel_Autostart
Start-ScheduledTask -TaskName Apexora_Tunnel_Autostart
```

## Verify `localhost:8080` Is Running

Browser check:

- Open `http://localhost:8080`

PowerShell check:

```powershell
Test-NetConnection -ComputerName localhost -Port 8080
```

If it is not listening, start your web server first, then run `start.cmd` again.

## SSH Key (Optional)

localhost.run can work without keys (their `nokey@localhost.run` user), but if you want a key pair:

```powershell
ssh-keygen -t rsa
```

Follow the prompts. This typically creates:

- `C:\Users\<you>\.ssh\id_rsa` (private key)
- `C:\Users\<you>\.ssh\id_rsa.pub` (public key)

## Manual Tunnel Command

If you want to run without the scripts:

```bash
ssh -R 80:localhost:8080 nokey@localhost.run
```

## Custom Domain Notes (apexora.local / apexora.com)

### Important: `.local` is usually not public DNS

`apexora.local` is commonly used for local-only networks (mDNS / internal DNS). You typically cannot use it as a public domain on the internet.

If you want a public custom domain with localhost.run, use a real public domain like `apexora.com`.

### DNS for `apexora.com` (localhost.run custom domain plan)

If you subscribe to localhost.run custom domains, you can set DNS either of these ways:

Option A: **A records** (recommended for apex/root domains)

- `A` record for `apexora.com` -> `54.161.197.247`
- `A` record for `apexora.com` -> `54.82.85.249`
- `A` record for `apexora.com` -> `35.171.254.69`

Option B: **CNAME** (works for subdomains, not the DNS root)

- `CNAME` for `www.apexora.com` -> `cd.localhost.run`

Why: **apex/root domains** (like `apexora.com`) cannot have a `CNAME` at the DNS root in most DNS providers, so you typically must use **A records** for the root.

## Limitations

- Free localhost.run URLs change frequently (new URL each time you reconnect).
- Custom domains require a paid plan/subscription with localhost.run.
- The tunnel must remain running (if SSH exits, the public URL stops working).
