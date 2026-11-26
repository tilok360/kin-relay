@echo off
rem Sets NODE to a Node.js 22 or newer: Kin Relay's own runtime\node.exe, the one installed on this PC, or a fresh
rem private copy downloaded from nodejs.org by tools\get-node.ps1.
set "NODE="
if exist "%~dp0..\runtime\node.exe" set "NODE=%~dp0..\runtime\node.exe"
if defined NODE goto :eof
set "MAJOR=0"
where node >nul 2>nul
if errorlevel 1 goto download
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set "MAJOR=%%v"
if %MAJOR% GEQ 22 set "NODE=node"
if defined NODE goto :eof
:download
echo Kin Relay needs Node.js 22 or newer, which is free.
echo Downloading a private copy into the runtime folder. This happens only once.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0get-node.ps1"
if exist "%~dp0..\runtime\node.exe" set "NODE=%~dp0..\runtime\node.exe"
