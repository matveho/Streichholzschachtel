@echo off
setlocal
cd /d "%~dp0backend-matvey"
title Basis Backend Controls
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required. Install it from https://nodejs.org
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 24 or newer is required. Update Node.js from https://nodejs.org
  pause
  exit /b 1
)
node control.mjs %*
if errorlevel 1 (
  echo.
  echo Basis could not complete the operation. Run this file again and choose 6 for troubleshooting or 7 for logs.
  pause
  exit /b 1
)
