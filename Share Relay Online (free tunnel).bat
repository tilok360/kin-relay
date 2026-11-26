@echo off
title Kin Relay - online tunnel
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\share-online.ps1" 8787
pause
