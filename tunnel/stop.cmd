@echo off
setlocal
cd /d "%~dp0"

if not exist "tunnel.pid" (
  echo [tunnel] tunnel.pid not found. Nothing to stop.
  exit /b 0
)

set "PID="
for /f %%A in (tunnel.pid) do set "PID=%%A"
if "%PID%"=="" (
  echo [tunnel] tunnel.pid is empty. Delete it and try again.
  exit /b 1
)

echo [tunnel] Stopping tunnel PID %PID% ...
taskkill /PID %PID% /T /F >NUL 2>&1
if errorlevel 1 echo [tunnel] taskkill failed. PID may already be stopped. Cleaning up pid file anyway.

del /f /q "tunnel.pid" >NUL 2>&1
echo [tunnel] Stopped.
