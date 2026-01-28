@echo off
REM ========================================
REM CHRONEX AI - ONE-CLICK INSTALLER
REM Everything happens automatically!
REM Created by DEMON ALEX
REM ========================================

title CHRONEX AI - One-Click Installer
mode con: cols=80 lines=30
color 0B

cls
echo.
echo     ========================================
echo       CHRONEX AI - ONE-CLICK INSTALLER
echo       Created by DEMON ALEX
echo     ========================================
echo.
echo     This will automatically:
echo     [*] Install Python (if needed)
echo     [*] Install all required packages
echo     [*] Configure Chronex AI
echo     [*] Create desktop shortcuts
echo     [*] Start Chronex AI
echo.
echo     Just sit back and relax! ^_^
echo.
echo     ========================================
echo.
timeout /t 3 /nobreak >nul

REM Run the auto-setup script
call AUTO-SETUP-CHRONEX.bat

REM If we get here, setup completed
echo.
echo ========================================
echo   CHRONEX AI IS NOW RUNNING!
echo ========================================
echo.
echo [*] Your AI is live at: http://localhost:5000
echo [*] Keep this window open
echo [*] Press Ctrl+C to stop
echo.
pause
