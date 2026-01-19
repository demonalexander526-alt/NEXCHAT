@echo off
REM NEXCHAT Direct Gradle APK Build Script
REM Builds APK directly without opening Android Studio

echo.
echo ===================================
echo  NEXCHAT Gradle APK Builder
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

echo [1/5] Cleaning previous builds...
if exist "dist" rmdir /s /q dist
echo ✓ Cleaned

echo.
echo [2/5] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo ✓ Dependencies installed

echo.
echo [3/5] Building web application...
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build web app
    pause
    exit /b 1
)
echo ✓ Web app built

echo.
echo [4/5] Syncing to Android...
call npx cap sync android
if errorlevel 1 (
    echo ERROR: Failed to sync files
    pause
    exit /b 1
)
echo ✓ Files synced

echo.
echo [5/5] Building APK with Gradle...
cd android

REM Check if gradlew exists
if not exist "gradlew.bat" (
    echo ERROR: gradlew.bat not found
    echo Please run build-apk.bat first to initialize Android project
    cd ..
    pause
    exit /b 1
)

echo.
echo Building Debug APK...
echo This may take 2-5 minutes...
echo.

call gradlew.bat assembleDebug

if errorlevel 1 (
    echo.
    echo ERROR: Gradle build failed
    echo Check the error messages above for details
    cd ..
    pause
    exit /b 1
)

echo.
echo ===================================
echo ✓ BUILD SUCCESSFUL!
echo ===================================
echo.
echo APK Output Location:
echo   app\build\outputs\apk\debug\app-debug.apk
echo.
echo File size and details:
for %%F in (app\build\outputs\apk\debug\app-debug.apk) do echo   Size: %%~zF bytes
echo.
echo Next steps:
echo 1. Transfer app-debug.apk to your Android phone
echo 2. Enable "Unknown Sources" in Settings ^> Security
echo 3. Open the APK file and tap "Install"
echo.
echo To build Release APK (for Play Store):
echo   cd android
echo   gradlew.bat assembleRelease
echo.

cd ..
pause
