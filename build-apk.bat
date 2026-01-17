@echo off
REM NEXCHAT APK Build Script for Windows
REM This script automates the APK building process

echo.
echo ===================================
echo    NEXCHAT APK Builder
echo ===================================
echo.

REM Check if Node.js is installed
node -v >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/5] Building web application...
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build web app
    pause
    exit /b 1
)

echo.
echo [3/5] Checking for Capacitor...
if not exist "android" (
    echo [3.1] Adding Android platform...
    call npx cap add android
)

echo.
echo [4/5] Syncing files...
call npm run cap:sync
if errorlevel 1 (
    echo ERROR: Failed to sync files
    pause
    exit /b 1
)

echo.
echo [5/5] Opening Android Studio...
echo.
echo NEXT STEPS:
echo 1. Android Studio will open in a moment
echo 2. Click Build menu
echo 3. Select "Build Bundle(s) / APK(s)"
echo 4. Choose "Build APK(s)"
echo 5. APK will be saved to: android\app\release\app-release.apk
echo.

call npx cap open android

echo.
echo ===================================
echo Build setup complete!
echo ===================================
echo.
pause
