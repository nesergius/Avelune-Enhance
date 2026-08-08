@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo This source tree is RC6. Redirecting to BUILD_RC6_WINDOWS.cmd...
call "%~dp0BUILD_RC6_WINDOWS.cmd"
exit /b %ERRORLEVEL%
