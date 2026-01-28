# CHRONEX AI - Quick Setup Script
# Run this to install all dependencies and start Chronex AI
# Created by DEMON ALEX - CREATOR OF CHRONEX AI

Write-Host "🚀 CHRONEX AI - QUICK SETUP" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
Write-Host "📋 Step 1: Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python not found"
    }
} catch {
    Write-Host "❌ Python is not installed or not in PATH!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Python from: https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "Make sure to check 'Add Python to PATH' during installation!" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "📦 Step 2: Installing required packages..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray

# Install core dependencies
$packages = @(
    "flask",
    "flask-cors",
    "python-dotenv",
    "pillow",
    "requests",
    "numpy"
)

foreach ($package in $packages) {
    Write-Host "Installing $package..." -ForegroundColor Gray
    python -m pip install $package --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ $package installed" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ Failed to install $package" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎯 Step 3: Optional AI Packages (for maximum intelligence)" -ForegroundColor Yellow
Write-Host "Do you want to install OpenAI support? (Recommended for smartest AI)" -ForegroundColor Cyan
$installOpenAI = Read-Host "Install OpenAI? (y/n)"

if ($installOpenAI -eq "y" -or $installOpenAI -eq "Y") {
    Write-Host "Installing OpenAI..." -ForegroundColor Gray
    python -m pip install openai --quiet
    Write-Host "✅ OpenAI installed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 To use OpenAI, create a .env file with:" -ForegroundColor Yellow
    Write-Host "   OPENAI_API_KEY=your-api-key-here" -ForegroundColor Gray
    Write-Host "   AI_PROVIDER=openai" -ForegroundColor Gray
    Write-Host "   USE_REAL_AI=True" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Starting CHRONEX AI..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start Chronex AI
python CHRONEX-AI.py
