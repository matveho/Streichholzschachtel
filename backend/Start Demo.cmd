@echo off
setlocal
cd /d "%~dp0"
title Basis Demo
set PORT=8787
set GENERATION_PROVIDER=ollama
set LOCAL_SYNTHESIS=1
set EXTRACTIVE_ONLY=0
set OLLAMA_URL=http://127.0.0.1:11435
set OLLAMA_MODEL=qwen3:4b-instruct-2507-q4_K_M
if not exist "state\demo-engine\launch.mjs" (
  call "Start Backend.cmd"
  exit /b
)
node state\demo-engine\launch.mjs
if errorlevel 1 pause
