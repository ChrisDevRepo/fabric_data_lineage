################################################
# Development Server with Build Logging
################################################
# Log files are stored in: build/logs/
#
# Files created:
#   - devserver_<timestamp>.log     Full build output
#   - devserver_<timestamp>.errors.log  Errors only
#   - latest.log                    Copy of most recent full log
#   - latest.errors.log             Copy of most recent error log
#
# Quick commands after build:
#   Get-Content build/logs/latest.errors.log   # View errors
#   Get-Content build/logs/latest.log          # View full log
################################################

# Setup logging directory
$logsDir = Join-Path $PSScriptRoot "..\..\build\logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Create timestamped log files
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$buildLogFile = Join-Path $logsDir "devserver_$timestamp.log"
$errorLogFile = Join-Path $logsDir "devserver_$timestamp.errors.log"
$latestLog = Join-Path $logsDir "latest.log"
$latestErrors = Join-Path $logsDir "latest.errors.log"

# Clean old logs - only keep current session
Remove-Item "$logsDir\devserver_*.log" -Force -ErrorAction SilentlyContinue
Remove-Item "$logsDir\devserver_*.errors.log" -Force -ErrorAction SilentlyContinue

# Display startup banner
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fabric DevServer - Build Session" -ForegroundColor Cyan
Write-Host "  $timestamp" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Log location: $logsDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "After build, check errors with:" -ForegroundColor Gray
Write-Host "  Get-Content build/logs/latest.errors.log" -ForegroundColor White
Write-Host ""

# Initialize log with header
@"
================================================
Fabric DevServer Build Log
Session: $timestamp
Started: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
================================================

"@ | Out-File -FilePath $buildLogFile -Encoding utf8

"# Build Errors - Session $timestamp`n" | Out-File -FilePath $errorLogFile -Encoding utf8

################################################
# Starting the DevServer
################################################
Write-Host "Starting DevServer..." -ForegroundColor Green
Write-Host "(Press Ctrl+C to stop)" -ForegroundColor Gray
Write-Host ""

$devServerDir = Join-Path $PSScriptRoot "..\..\src\Workload"
Push-Location $devServerDir

try {
    if ($env:CODESPACES -eq "true") {
        Write-Host "Codespace mode - low memory config" -ForegroundColor Yellow
        $env:NODE_ENV = "codespace"
        # Run with Tee-Object to capture output to both console and file
        npm run start:codespace 2>&1 | Tee-Object -FilePath $buildLogFile -Append
    } else {
        # Run with Tee-Object to capture output to both console and file
        npm start 2>&1 | Tee-Object -FilePath $buildLogFile -Append
    }
} finally {
    Pop-Location

    # Add footer to log
    @"

================================================
Session Ended: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
================================================
"@ | Out-File -FilePath $buildLogFile -Append -Encoding utf8

    # Extract errors to separate file
    if (Test-Path $buildLogFile) {
        Get-Content $buildLogFile |
            Where-Object { $_ -match "ERROR|error:|TS\d{4,}:|failed|Cannot find" } |
            Out-File -FilePath $errorLogFile -Append -Encoding utf8
    }

    # Update "latest" copies
    Copy-Item $buildLogFile $latestLog -Force -ErrorAction SilentlyContinue
    Copy-Item $errorLogFile $latestErrors -Force -ErrorAction SilentlyContinue

    # Summary
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Build Session Ended" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    $errorCount = 0
    if (Test-Path $errorLogFile) {
        $errorCount = (Get-Content $errorLogFile | Where-Object { $_ -match "ERROR|TS\d{4,}" } | Measure-Object).Count
    }

    if ($errorCount -gt 0) {
        Write-Host "  Errors: $errorCount" -ForegroundColor Red
        Write-Host ""
        Write-Host "  View errors:" -ForegroundColor Yellow
        Write-Host "    Get-Content build/logs/latest.errors.log" -ForegroundColor White
    } else {
        Write-Host "  No errors detected" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "  Full log: build/logs/latest.log" -ForegroundColor Gray
    Write-Host ""
}
