@echo off
REM NEXCHAT Environment Setup Checker
REM This script verifies all required tools are installed

echo.
echo ===================================
echo NEXCHAT Setup Checker
echo ===================================
echo.

setlocal enabledelayedexpansion

set "missing="

REM Check Node.js
echo Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is NOT installed
    set "missing=!missing! Node.js"
) else (
    for /f "tokens=*" %%i in ('node -v') do (
        echo ✅ Node.js %%i
    )
)

REM Check npm
echo.
echo Checking npm...
npm -v >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is NOT installed
    set "missing=!missing! npm"
) else (
    for /f "tokens=*" %%i in ('npm -v') do (
        echo ✅ npm %%i
    )
)

REM Check Java
echo.
echo Checking Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo ❌ Java is NOT installed
    set "missing=!missing! Java"
) else (
    for /f "tokens=*" %%i in ('java -version 2^>^&1') do (
        echo ✅ Java found
        goto :skip_java
    )
    :skip_java
)

REM Check Git
echo.
echo Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git is NOT installed
    set "missing=!missing! Git"
) else (
    for /f "tokens=*" %%i in ('git --version') do (
        echo ✅ %%i
    )
)

REM Check for Android SDK
echo.
echo Checking Android SDK...
if exist "%ANDROID_HOME%" (
    echo ✅ Android SDK found at %ANDROID_HOME%
) else (
    echo ⚠️  Android SDK not found
    echo Install Android Studio from: https://developer.android.com/studio
)

REM Check for Capacitor
echo.
echo Checking Capacitor...
if exist "node_modules\@capacitor\cli" (
    echo ✅ Capacitor CLI installed
) else (
    echo ❌ Capacitor CLI not installed
    set "missing=!missing! Capacitor"
)

REM Summary
echo.
echo ===================================

if "!missing!"=="" (
    echo ✅ All required tools are installed!
    echo.
    echo You can now run: build-apk.bat
) else (
    echo ❌ Missing tools:!missing!
    echo.
    echo Please install the missing tools:
    echo 1. Node.js - https://nodejs.org/
    echo 2. Java JDK - https://www.oracle.com/java/technologies/downloads/
    echo 3. Android Studio - https://developer.android.com/studio
    echo 4. Git - https://git-scm.com/
)

echo ===================================
echo.

pause
