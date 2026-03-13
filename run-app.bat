@echo off
setlocal

cd /d "%~dp0"

echo Starting Outreach SYSTEM...
echo.

start "Outreach API" cmd /k "cd /d %~dp0 && npm run dev:api"
start "Outreach Web" cmd /k "cd /d %~dp0 && npm run dev:web"

echo API and web servers are starting in separate windows.
echo Web: http://localhost:5173
echo API: http://localhost:8787

endlocal
