@echo off
setlocal
cd /d "%~dp0"
title Basis Matvey Backend
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required. Install it from https://nodejs.org
  pause
  exit /b 1
)
if not exist "node_modules\pdfjs-dist\package.json" (
  echo Installing backend dependencies...
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed. Check the connection and try again.
    pause
    exit /b 1
  )
)
node control.mjs
if errorlevel 1 pause
