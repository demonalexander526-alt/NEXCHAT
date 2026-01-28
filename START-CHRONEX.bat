@echo off
REM CHRONEX AI - Quick Setup and Start
REM Created by DEMON ALEX - CREATOR OF CHRONEX AI

echo.
echo ========================================
echo   CHRONEX AI - QUICK SETUP
echo   Created by DEMON ALEX
echo ========================================
echo.

REM Check Python
echo [1/3] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH!
    echo.
    echo Please install Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation!
    echo.
    pause
    exit /b 1
)
echo [OK] Python found!
echo.

REM Install dependencies
echo [2/3] Installing required packages...
echo This may take a few minutes...
echo.
python -m pip install flask flask-cors python-dotenv pillow requests numpy --quiet
if errorlevel 1 (
    echo [WARNING] Some packages may have failed to install
) else (
    echo [OK] Core packages installed!
)
echo.

REM Start Chronex AI
echo [3/3] Starting CHRONEX AI...
echo.
echo ========================================
echo   CHRONEX AI is starting...
echo   Press Ctrl+C to stop
echo ========================================
echo.
python CHRONEX-AI.py
