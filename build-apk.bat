@echo off
REM NEXCHAT APK Build Script for Windows
REM This script automates the APK building process

echo.
echo ===================================
echo    NEXCHAT APK Builder v2.0
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

REM Check if Java is installed
java -version >nul 2>&1
if errorlevel 1 (
    echo WARNING: Java is not installed or not in PATH
    echo Android Studio typically includes Java
    echo.
)

REM Check if Android SDK is available
if not exist "%ANDROID_HOME%" (
    if not exist "%APPDATA%\.android" (
        echo WARNING: Android SDK may not be installed
        echo You need to install Android Studio
        echo.
    )
)

echo [1/6] Cleaning previous builds...
if exist "dist" rmdir /s /q dist
if exist "android\app\build" rmdir /s /q android\app\build
echo ✓ Cleaned

echo.
echo [2/6] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo ✓ Dependencies installed

echo.
echo [3/6] Building web application...
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build web app
    echo Make sure all JavaScript files are valid
    pause
    exit /b 1
)
echo ✓ Web app built successfully

echo.
echo [4/6] Checking for Capacitor Android platform...
if not exist "android" (
    echo [4.1] Adding Android platform (this may take a few minutes)...
    call npx cap add android
    if errorlevel 1 (
        echo ERROR: Failed to add Android platform
        echo Make sure Java Development Kit (JDK) is installed
        pause
        exit /b 1
    )
)
echo ✓ Android platform ready

echo.
echo [5/6] Syncing files to Android project...
call npx cap sync android
if errorlevel 1 (
    echo ERROR: Failed to sync files
    pause
    exit /b 1
)
echo ✓ Files synced

echo.
echo [6/6] Opening Android Studio...
echo.
echo ==========================================
echo    NEXT STEPS - BUILD APK IN ANDROID STUDIO
echo ==========================================
echo.
echo 1. Android Studio will open in a moment
echo 2. Wait for Gradle sync to complete
echo 3. Click Build menu at the top
echo 4. Select "Build Bundle(s) / APK(s)"
echo 5. Choose "Build APK(s)"
echo 6. Click Run (or Build) in the dialog
echo 7. Wait for the build to complete
echo.
echo BUILD OUTPUT LOCATIONS:
echo   Debug APK: android\app\build\outputs\apk\debug\app-debug.apk
echo   Release APK: android\app\release\app-release.apk
echo.
echo For direct Gradle build from command line:
echo   cd android
echo   gradlew.bat assembleDebug    (Debug APK)
echo   gradlew.bat assembleRelease  (Release APK)
echo.
echo ==========================================
echo.

call npx cap open android

echo.
echo Build setup complete!
echo APK file will be available in android\app\build\outputs\apk\
echo.
pause

