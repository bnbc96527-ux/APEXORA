@echo off
setlocal
cd /d "%~dp0"

REM Start localhost.run reverse tunnel (PowerShell 5+ compatible)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tunnel.ps1"

