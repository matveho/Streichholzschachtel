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
node control.mjs
if errorlevel 1 pause
