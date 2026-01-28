# CHRONEX AI - Auto-Start on Windows Boot
# Created by DEMON ALEX - CREATOR OF CHRONEX AI
# This PowerShell script sets up Chronex AI to start automatically

param(
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Status
)

$scriptPath = $PSScriptRoot
$chronexBat = Join-Path $scriptPath "RUN-CHRONEX.bat"
$taskName = "ChronexAI-AutoStart"

function Install-AutoStart {
    Write-Host "🚀 Installing Chronex AI Auto-Start..." -ForegroundColor Cyan
    Write-Host ""
    
    # Check if task already exists
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "⚠️  Auto-start is already installed!" -ForegroundColor Yellow
        Write-Host "   Use -Uninstall to remove it first" -ForegroundColor Gray
        return
    }
    
    # Create scheduled task
    $action = New-ScheduledTaskAction -Execute $chronexBat -WorkingDirectory $scriptPath
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
    
    try {
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Auto-start Chronex AI on login - Created by DEMON ALEX" | Out-Null
        Write-Host "✅ Auto-start installed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Chronex AI will now start automatically when you log in to Windows" -ForegroundColor Cyan
        Write-Host ""
    } catch {
        Write-Host "❌ Failed to install auto-start: $_" -ForegroundColor Red
    }
}

function Uninstall-AutoStart {
    Write-Host "🗑️  Removing Chronex AI Auto-Start..." -ForegroundColor Yellow
    Write-Host ""
    
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if (-not $existingTask) {
        Write-Host "⚠️  Auto-start is not installed!" -ForegroundColor Yellow
        return
    }
    
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "✅ Auto-start removed successfully!" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host "❌ Failed to remove auto-start: $_" -ForegroundColor Red
    }
}

function Show-Status {
    Write-Host "📊 Chronex AI Auto-Start Status" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "Status: ✅ INSTALLED" -ForegroundColor Green
        Write-Host "Task Name: $taskName" -ForegroundColor Gray
        Write-Host "State: $($existingTask.State)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Chronex AI will start automatically on Windows login" -ForegroundColor Cyan
    } else {
        Write-Host "Status: ❌ NOT INSTALLED" -ForegroundColor Red
        Write-Host ""
        Write-Host "Run with -Install to enable auto-start" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Main logic
if ($Install) {
    Install-AutoStart
} elseif ($Uninstall) {
    Uninstall-AutoStart
} elseif ($Status) {
    Show-Status
} else {
    Write-Host "🤖 Chronex AI - Auto-Start Manager" -ForegroundColor Cyan
    Write-Host "===================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\auto-start-manager.ps1 -Install    Install auto-start" -ForegroundColor Gray
    Write-Host "  .\auto-start-manager.ps1 -Uninstall  Remove auto-start" -ForegroundColor Gray
    Write-Host "  .\auto-start-manager.ps1 -Status     Check status" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host "  .\auto-start-manager.ps1 -Install" -ForegroundColor Gray
    Write-Host ""
}
