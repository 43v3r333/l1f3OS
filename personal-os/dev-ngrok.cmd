@echo off
REM Use npm.cmd so PowerShell execution policy does not block npm.ps1 (nvm4w).
cd /d "%~dp0"
call npm.cmd run dev:ngrok
