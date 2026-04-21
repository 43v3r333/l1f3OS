@echo off
cd /d "%~dp0personal-os"
call npm.cmd run dev:all
