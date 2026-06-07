@echo off
REM Resonance - Music Streaming Server
REM This script starts the Node.js server

cd /d "%~dp0"
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║           🎵  Starting Resonance...  🎵          ║
echo ╚══════════════════════════════════════════════════╝
echo.

REM Check if node_modules exists, install if not
if not exist "node_modules\" (
    echo [1/2] Installing dependencies...
    call npm install
    echo.
)

echo [2/2] Starting server...
echo.
call npm start

pause
