@echo off
REM ========================================
REM CHRONEX AI - AUTO UPDATER
REM Automatically updates all packages
REM Created by DEMON ALEX
REM ========================================

title CHRONEX AI - Auto Updater
color 0E

echo.
echo ========================================
echo   CHRONEX AI - AUTO UPDATER
echo   Created by DEMON ALEX
echo ========================================
echo.
echo [*] Checking for updates...
echo.

REM Update pip
echo [1/3] Updating pip...
python -m pip install --upgrade pip --quiet
echo [OK] Pip updated!
echo.

REM Update all packages
echo [2/3] Updating all packages...
echo [*] This may take a few minutes...
python -m pip install --upgrade flask flask-cors python-dotenv pillow requests numpy openai psutil --quiet
if errorlevel 1 (
    echo [!] Some packages failed to update. Trying again...
    python -m pip install --upgrade flask flask-cors python-dotenv pillow requests numpy openai psutil
)
echo [OK] All packages updated!
echo.

REM Check versions
echo [3/3] Checking installed versions...
echo.
python -m pip list | findstr /I "flask pillow requests numpy openai"
echo.

echo ========================================
echo   UPDATE COMPLETE!
echo ========================================
echo.
echo [*] All packages are up to date!
echo [*] Restart Chronex AI to use the latest versions
echo.
pause
