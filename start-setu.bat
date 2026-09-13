@echo off
title Setu Launcher
cd /d "%~dp0"

echo ============================================
echo   Setu - starting local demo
echo ============================================

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Get it from https://nodejs.org
  pause
  exit /b 1
)

if not exist ".freebuff\backend\node_modules" (
  echo Installing backend dependencies...
  pushd .freebuff\backend
  call npm install
  popd
)

if not exist ".freebuff\client\node_modules" (
  echo Installing client dependencies...
  pushd .freebuff\client
  call npm install
  popd
)

if not exist ".freebuff\backend\.env" (
  copy ".freebuff\backend\.env.example" ".freebuff\backend\.env" >nul
  echo Created backend .env from template.
)

echo Starting in-memory MongoDB...
start "Setu MongoDB" cmd /k "cd .freebuff\backend && npm run mongo"

REM wait ~8s for mongod to accept connections (ping works regardless of PATH)
ping -n 9 127.0.0.1 >nul

echo Starting backend...
start "Setu Backend" cmd /k "cd .freebuff\backend && set PORT=5000 && npm run dev"

echo Starting client...
start "Setu Client" cmd /k "cd .freebuff\client && npm run dev"

REM wait ~10s for servers, then open the browser
ping -n 11 127.0.0.1 >nul
start http://localhost:5175

echo.
echo All three windows are running. Close them to stop the site.
echo Browser should open at http://localhost:5175
echo.
pause
