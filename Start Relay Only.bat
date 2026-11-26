@echo off
title Kin Relay - relay only
cd /d "%~dp0"
call "%~dp0tools\find-node.cmd"
if not defined NODE goto nonode
"%NODE%" relay.js
pause
goto :eof
:nonode
echo Could not get Node.js. Install the LTS version from https://nodejs.org and run this again.
pause
