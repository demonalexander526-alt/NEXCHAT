@echo off
title CHRONEX AI BRAIN - POWERED BY DEMON ALEX
color 0b

echo ===================================================
echo      CHRONEX AI - ADVANCED PYTHON BACKEND
echo           CREATED BY DEMON ALEX
echo ===================================================
echo.

:: Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0c
    echo [CRITICAL ERROR] Python is not found!
    echo.
    echo Please install Python from python.org to use the AI Brain.
    echo.
    pause
    exit
)

echo [INIT] Checking core dependencies...
:: Install essential packages silently to ensure it runs
pip install flask flask-cors --quiet >nul 2>&1

echo [INIT] Starting Neural Core...
echo.
echo [STATUS] CHRONEX AI IS LISTENING ON PORT 5000
echo.
echo [INSTRUCTION] Minimize this window, but DO NOT CLOSE IT.
echo               If you close this window, the AI brain goes offline.
echo.
echo ===================================================
echo.

:: Run the AI script
python CHRONEX-AI.py

:: If script crashes, keep window open to show error
if %errorlevel% neq 0 (
    color 0c
    echo.
    echo [ERROR] The AI Brain crashed. See error above.
    pause
)
