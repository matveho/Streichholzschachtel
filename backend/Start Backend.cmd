@echo off
setlocal
call "%~dp0..\Start basis.cmd" %*
exit /b %errorlevel%
