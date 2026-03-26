@echo off
setlocal

cd /d "%~dp0"

set "API_PORT=8787"
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if /I "%%A"=="PORT" set "API_PORT=%%B"
)

echo Starting Outreach SYSTEM...
echo.

start "Outreach API" cmd /k "cd /d %~dp0 && npm run dev:api"
start "Outreach Web" cmd /k "cd /d %~dp0 && npm run dev:web"

echo API and web servers are starting in separate windows.
echo Web: http://localhost:5173
echo API: http://localhost:%API_PORT%

endlocal
