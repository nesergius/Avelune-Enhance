@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Avelune Enhance 2.0.0 RC6 Builder

echo ============================================================
echo Avelune Enhance 2.0.0 RC6 Windows Builder
echo ============================================================
echo.
echo This build verifies official model provenance, licenses,
echo native source, tests, Setup, Portable, update metadata,
echo packaged engine smoke tests and multi-viewport visual QA.
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass ^
  -File "%~dp0tools\build-rc6-release.ps1"

set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" (
  echo [PASS] Open RC6-OUTPUT.
) else (
  echo [FAIL] See RC6-BUILD.log and RC6-OUTPUT\QA-FAILED.
)
echo.
pause
exit /b %EXIT_CODE%
