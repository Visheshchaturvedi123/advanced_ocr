@echo off
setlocal
cd /d "%~dp0screen-ocr"

if not exist "node_modules\tesseract.js" (
  echo Installing Screen OCR dependencies...
  call npm install
  if errorlevel 1 goto :error
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Downloading the Electron runtime...
  node "node_modules\electron\install.js"
  if errorlevel 1 goto :error
)

call npm start
exit /b %errorlevel%

:error
echo.
echo Screen OCR setup failed. Run "npm install" inside the screen-ocr folder.
pause
exit /b 1
