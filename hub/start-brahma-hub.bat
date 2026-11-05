@echo off
setlocal
title Brahma Hub
cd /d "%~dp0.."

if not exist "node_modules" (
  echo Brahma root dependencies are missing.
  echo Run: npm install
  pause
  exit /b 1
)

if not exist "modules\image-lab\node_modules\sharp" (
  echo Image Lab dependencies are missing.
  echo Run: npm run modules:install
  pause
  exit /b 1
)

echo Starting Brahma Hub on http://127.0.0.1:47821 ...
if exist "node_modules\.bin\tsx.cmd" (
  call "node_modules\.bin\tsx.cmd" "hub\server.ts"
) else (
  call npx tsx "hub\server.ts"
)

echo.
echo Brahma Hub stopped.
pause
