@echo off
setlocal
cd /d "%~dp0"
node open-vercel.mjs
if errorlevel 1 pause
