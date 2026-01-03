################################################
# Clean All Build Logs
################################################
$logsDir = Join-Path $PSScriptRoot "..\..\build\logs"

if (Test-Path $logsDir) {
    Remove-Item "$logsDir\*" -Force -ErrorAction SilentlyContinue
    Write-Host "Build logs cleared." -ForegroundColor Green
} else {
    Write-Host "No logs to clean." -ForegroundColor Yellow
}
