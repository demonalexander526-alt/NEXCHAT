@echo off
REM ====================================================
REM CHRONEX AI - FULLY AUTOMATIC SETUP
REM Created by DEMON ALEX - CREATOR OF CHRONEX AI
REM IN QCOMPLIANCE WITH NEX_DEV TEAM && RIGHTS RESERVED 
REM ====================================================

title CHRONEX AI - Automatic Setup

color 0A
echo.
echo ========================================
echo   CHRONEX AI - AUTOMATIC SETUP
echo   Created by DEMON ALEX
echo ========================================
echo.
echo [*] Starting automatic installation...
echo [*] This will install everything you need!
echo.

REM Check if Python is installed
echo [1/5] Checking for Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [!] Python not found! Installing Python automatically...
    echo.
    echo [*] Downloading Python installer...
    
    REM Download Python installer
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe' -OutFile 'python_installer.exe'}"
    
    if exist python_installer.exe (
        echo [*] Installing Python... Please wait...
        echo [*] This will take 2-3 minutes...
        start /wait python_installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
        
        REM Clean up installer
        del python_installer.exe
        
        echo [OK] Python installed successfully!
        echo [*] Please restart this script for changes to take effect.
        echo.
        pause
        exit /b 0
    ) else (
        echo [!] Failed to download Python installer.
        echo [*] Please install Python manually from: https://www.python.org/downloads/
        echo [*] Make sure to check "Add Python to PATH"!
        echo.
        pause
        exit /b 1
    )
) else (
    echo [OK] Python is already installed!
)
echo.

REM Upgrade pip
echo [2/5] Upgrading pip...
python -m pip install --upgrade pip --quiet
echo [OK] Pip upgraded!
echo.

REM Install core dependencies
echo [3/5] Installing core packages...
echo [*] Installing: flask, flask-cors, python-dotenv, pillow, requests, numpy
echo [*] This may take 2-3 minutes...
python -m pip install flask flask-cors python-dotenv pillow requests numpy --quiet --disable-pip-version-check
if errorlevel 1 (
    echo [!] Some packages failed to install. Trying again...
    python -m pip install flask flask-cors python-dotenv pillow requests numpy
)
echo [OK] Core packages installed!
echo.

REM Install optional AI packages
echo [4/5] Installing AI enhancement packages...
echo [*] Installing: openai, psutil
python -m pip install openai psutil --quiet --disable-pip-version-check
if errorlevel 1 (
    echo [!] Optional packages failed. Continuing anyway...
) else (
    echo [OK] AI packages installed!
)
echo.

REM Create .env file if it doesn't exist
echo [5/5] Setting up configuration...
if not exist .env (
    echo [*] Creating default .env configuration...
    (
        echo # CHRONEX AI Configuration
        echo # Created automatically by AUTO-SETUP-CHRONEX.bat
        echo.
        echo # AI Provider: openai, huggingface, ollama, or default
        echo AI_PROVIDER=default
        echo.
        echo # OpenAI Settings ^(Get API key from: https://platform.openai.com/api-keys^)
        echo # OPENAI_API_KEY=your-api-key-here
        echo # OPENAI_MODEL=gpt-3.5-turbo
        echo.
        echo # AI Settings
        echo USE_REAL_AI=False
        echo AI_TEMPERATURE=0.7
        echo AI_MAX_TOKENS=1000
        echo ENABLE_VISION=True
        echo.
        echo # Server Settings
        echo PORT=5000
        echo DEBUG=False
        echo.
        echo # To enable OpenAI:
        echo # 1. Get API key from https://platform.openai.com/api-keys
        echo # 2. Uncomment OPENAI_API_KEY line above and add your key
        echo # 3. Set AI_PROVIDER=openai
        echo # 4. Set USE_REAL_AI=True
        echo # 5. Restart Chronex AI
    ) > .env
    echo [OK] Configuration file created!
) else (
    echo [OK] Configuration file already exists!
)
echo.

REM Create auto-start script
echo [*] Creating auto-start script...
(
    echo @echo off
    echo title CHRONEX AI - Running
    echo color 0B
    echo echo.
    echo echo ========================================
    echo echo   CHRONEX AI - RUNNING
    echo echo   Created by DEMON ALEX
    echo echo ========================================
    echo echo.
    echo echo [*] Starting Chronex AI Python Backend...
    echo echo [*] Server will run on: http://localhost:5000
    echo echo [*] Press Ctrl+C to stop
    echo echo.
    echo python CHRONEX-AI.py
    echo if errorlevel 1 ^(
    echo     echo.
    echo     echo [ERROR] Chronex AI failed to start!
    echo     echo [*] Check the error messages above
    echo     pause
    echo ^)
) > RUN-CHRONEX.bat
echo [OK] Auto-start script created!
echo.

REM Create desktop shortcut
echo [*] Creating desktop shortcut...
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\Start Chronex AI.lnk'); $Shortcut.TargetPath = '%CD%\RUN-CHRONEX.bat'; $Shortcut.WorkingDirectory = '%CD%'; $Shortcut.IconLocation = '%SystemRoot%\System32\shell32.dll,277'; $Shortcut.Description = 'Start Chronex AI - Created by DEMON ALEX'; $Shortcut.Save()"
if errorlevel 1 (
    echo [!] Could not create desktop shortcut
) else (
    echo [OK] Desktop shortcut created!
)
echo.

color 0A
echo ========================================
echo   SETUP COMPLETE!
echo ========================================
echo.
echo [SUCCESS] Everything is installed and ready!
echo.
echo [*] What was installed:
echo     - Python ^(if needed^)
echo     - Flask web framework
echo     - All required packages
echo     - Configuration file
echo     - Auto-start scripts
echo     - Desktop shortcut
echo.
echo [*] How to start Chronex AI:
echo     1. Double-click "Start Chronex AI" on your desktop
echo     OR
echo     2. Run RUN-CHRONEX.bat from this folder
echo.
echo [*] To make AI SUPER SMART:
echo     1. Get OpenAI API key from: https://platform.openai.com/api-keys
echo     2. Edit .env file and add your API key
echo     3. Set AI_PROVIDER=openai and USE_REAL_AI=True
echo     4. Restart Chronex AI
echo.
echo [*] Starting Chronex AI now...
echo.
timeout /t 3 /nobreak >nul

REM Start Chronex AI
call RUN-CHRONEX.bat
