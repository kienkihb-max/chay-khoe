@echo off
chcp 65001 >nul
title Sang loc dang chay - DONG cua so nay khi xong
echo.
echo   Dang khoi dong... (neu Windows hoi, chon cho phep)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
echo.
pause
