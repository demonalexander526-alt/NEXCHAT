@echo off
REM NEXCHAT Android Development Environment Setup
REM Run this to check and help set up your environment

echo.
echo ===================================
echo  NEXCHAT Android Setup Checker
echo ===================================
echo.

setlocal enabledelayedexpansion

REM Check Node.js
echo [1] Checking Node.js...
node -v >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
    echo   ✓ Node.js !NODE_VER! is installed
) else (
    echo   ✗ Node.js NOT found
    echo   → Download from: https://nodejs.org/
    echo.
)

REM Check npm
echo [2] Checking npm...
npm -v >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
    echo   ✓ npm !NPM_VER! is installed
) else (
    echo   ✗ npm NOT found
    echo.
)

REM Check Java
echo [3] Checking Java...
java -version >nul 2>&1
if !errorlevel! equ 0 (
    echo   ✓ Java is installed
    java -version
) else (
    echo   ✗ Java NOT found
    echo   → Download JDK from: https://www.oracle.com/java/technologies/downloads/
    echo   → Or download OpenJDK from: https://jdk.java.net/
    echo.
)

REM Check JAVA_HOME
echo [4] Checking JAVA_HOME environment variable...
if defined JAVA_HOME (
    echo   ✓ JAVA_HOME is set to: !JAVA_HOME!
) else (
    echo   ✗ JAVA_HOME is NOT set
    echo   → See APK-BUILD-GUIDE.md for setup instructions
    echo.
)

REM Check Android SDK
echo [5] Checking Android SDK...
if defined ANDROID_HOME (
    echo   ✓ ANDROID_HOME is set to: !ANDROID_HOME!
    if exist "!ANDROID_HOME!\platforms" (
        echo   ✓ Android platforms found
    ) else (
        echo   ⚠ Android platforms may need installation
    )
) else (
    echo   ✗ ANDROID_HOME is NOT set
    echo   → Install Android Studio from: https://developer.android.com/studio
    echo   → Default path: C:\Users\YourUsername\AppData\Local\Android\Sdk
    echo.
)

REM Check Gradle
echo [6] Checking Gradle...
if exist "android\gradlew.bat" (
    echo   ✓ Gradle wrapper found (android\gradlew.bat)
) else (
    echo   ⚠ Gradle wrapper not found
    echo   → Run 'build-apk.bat' first to initialize
)

echo.
echo ===================================
echo  SETUP SUMMARY
echo ===================================
echo.
echo ✓ Ready to build APK if:
echo   - All items show ✓
echo   - Node.js version is 14 or higher
echo   - Java is version 11 or higher
echo.
echo NEXT STEPS:
echo   1. Make sure all ✓ items are present
echo   2. If any ✗ items, follow the link provided
echo   3. Run: build-apk.bat     (for first time)
echo      OR: build-apk-gradle.bat (for faster builds)
echo.
echo For detailed instructions, see: APK-BUILD-GUIDE.md
echo.

pause
