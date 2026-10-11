@echo off
REM Double-click to run the clean-up (it will ask for administrator rights).
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0cleanup-old-zaijabolical.ps1"
