Write-Host "Starting Jez Sync development environment..." -ForegroundColor Cyan

# Make sure Docker Postgres is running
Write-Host "Checking Postgres container..." -ForegroundColor Yellow
docker start jezsync-postgres 2>$null

# Start the API in a new window
Write-Host "Starting API server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\apps\api'; npm run dev"

# Wait a moment for the API to start before launching web
Start-Sleep -Seconds 3

# Start the web app in a new window
Write-Host "Starting web server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\apps\web'; npm run dev"

Write-Host "Both servers launching in separate windows." -ForegroundColor Green
Write-Host "API:  http://localhost:3001/health" -ForegroundColor Green
Write-Host "Web:  http://localhost:3000" -ForegroundColor Green