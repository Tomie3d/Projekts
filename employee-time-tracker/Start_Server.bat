@echo off
cd /d "%~dp0"
start "" npm start
timeout /t 3 >nul
start http://localhost:3000
exit