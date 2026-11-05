@echo off
REM Local Batch Image Optimizer - One-click launcher
REM Double-click this file to start the app

cd /d "%~dp0"

echo ============================================
echo  Local Batch Image Optimizer
echo ============================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found! Install from https://nodejs.org/
  pause
  exit /b 1
)

REM Install dependencies on first run
if not exist "node_modules" (
  echo Installing dependencies (first run only)...
  call npm install
  if %errorlevel% neq 0 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
  )
)

echo Starting server at http://localhost:3001 ...
echo Press Ctrl+C to stop.
echo.

REM Open browser after short delay
start "" cmd /c "timeout /t 5 /nobreak >nul ^& start http://localhost:3001"

call npm run dev
pause
