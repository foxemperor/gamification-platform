# ================================================================
# dev.ps1 - Quick dev launcher (Windows 11 / PowerShell 5+)
# Project: Gamification Platform
# Author: Dmitry Koval
# ================================================================
# Usage:
#   .\dev.ps1              - start backend services (= up)
#   .\dev.ps1 help         - show all available commands
#   .\dev.ps1 dev          - start backend + frontend together
#   .\dev.ps1 ui           - start frontend dev server only
#   .\dev.ps1 ui:install   - npm install in ./frontend
#   .\dev.ps1 ui:build     - production build -> frontend/dist/
#   .\dev.ps1 stop         - stop all
#   .\dev.ps1 restart      - restart all
#   .\dev.ps1 restart auth-service - restart one service
#   .\dev.ps1 logs         - logs of all services
#   .\dev.ps1 logs auth-service    - logs of one service
#   .\dev.ps1 health       - health check all services
#   .\dev.ps1 test         - quick API test scenario
#   .\dev.ps1 clean        - remove containers and volumes
#   .\dev.ps1 rebuild      - full rebuild without cache
#   .\dev.ps1 db           - open psql in container
#   .\dev.ps1 open         - open Swagger UI in browser
# ================================================================

param(
    [string]$Command = "up",
    [string]$Service = ""
)

$GREEN  = "Green"
$YELLOW = "Yellow"
$RED    = "Red"
$CYAN   = "Cyan"
$GRAY   = "DarkGray"
$WHITE  = "White"

$ACTIVE_SERVICES = @("postgres", "redis", "auth-service", "gamification-service")

$HEALTH_ENDPOINTS = [ordered]@{
    "auth-service"               = "http://localhost:8001/health"
    "gamification-service"       = "http://localhost:8002/health"
    "gamification-service/ready" = "http://localhost:8002/health/ready"
}

$SWAGGER_URLS = @(
    "http://localhost:8001/docs"
    "http://localhost:8002/docs"
)

# ================================================================
# HELPERS
# ================================================================

function Write-Header([string]$Text) {
    Write-Host ""
    Write-Host "=== $Text ===" -ForegroundColor $CYAN
    Write-Host ""
}

function Write-Ok([string]$T)   { Write-Host "  [OK] $T" -ForegroundColor $GREEN  }
function Write-Warn([string]$T) { Write-Host "  [!!] $T" -ForegroundColor $YELLOW }
function Write-Err([string]$T)  { Write-Host "  [XX] $T" -ForegroundColor $RED    }
function Write-Info([string]$T) { Write-Host "   ->  $T" -ForegroundColor $GRAY   }

function Write-Help {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor $CYAN
    Write-Host "  Gamification Platform  --  dev.ps1" -ForegroundColor $CYAN
    Write-Host "  Windows 11 / PowerShell 5+" -ForegroundColor $GRAY
    Write-Host "================================================================" -ForegroundColor $CYAN
    Write-Host ""

    Write-Host "  BACKEND (Docker)" -ForegroundColor $YELLOW
    Write-Host "  ----------------------------------------------------------------"
    Write-Host "  .\dev.ps1                   " -NoNewline; Write-Host "start all backend services (= up)" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 up                " -NoNewline; Write-Host "start all backend services" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 stop              " -NoNewline; Write-Host "stop all services" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 restart           " -NoNewline; Write-Host "restart all services" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 restart <service> " -NoNewline; Write-Host "restart one service (e.g. auth-service)" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 rebuild           " -NoNewline; Write-Host "full rebuild without Docker cache" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 rebuild <service> " -NoNewline; Write-Host "rebuild one service only" -ForegroundColor $GRAY
    Write-Host ""

    Write-Host "  FRONTEND (Node.js / Vite)" -ForegroundColor $YELLOW
    Write-Host "  ----------------------------------------------------------------"
    Write-Host "  .\dev.ps1 ui:install        " -NoNewline; Write-Host "npm install in ./frontend" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 ui               " -NoNewline; Write-Host "start Vite dev server (http://localhost:3000)" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 ui:build          " -NoNewline; Write-Host "production build -> frontend/dist/" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 ui:open           " -NoNewline; Write-Host "open http://localhost:3000 in browser" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 dev               " -NoNewline; Write-Host "start backend + frontend together" -ForegroundColor $GRAY
    Write-Host ""

    Write-Host "  LOGS & MONITORING" -ForegroundColor $YELLOW
    Write-Host "  ----------------------------------------------------------------"
    Write-Host "  .\dev.ps1 logs              " -NoNewline; Write-Host "live logs of all services" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 logs <service>    " -NoNewline; Write-Host "live logs of one service" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 health            " -NoNewline; Write-Host "HTTP health check all services" -ForegroundColor $GRAY
    Write-Host ""

    Write-Host "  DATABASE" -ForegroundColor $YELLOW
    Write-Host "  ----------------------------------------------------------------"
    Write-Host "  .\dev.ps1 db                " -NoNewline; Write-Host "open psql (PostgreSQL CLI)" -ForegroundColor $GRAY
    Write-Host ""

    Write-Host "  TESTING & UTILS" -ForegroundColor $YELLOW
    Write-Host "  ----------------------------------------------------------------"
    Write-Host "  .\dev.ps1 test              " -NoNewline; Write-Host "automated 6-step API test scenario" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 open              " -NoNewline; Write-Host "open Swagger UI in browser" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 help              " -NoNewline; Write-Host "show this help" -ForegroundColor $GRAY
    Write-Host ""

    Write-Host "  CLEANUP" -ForegroundColor $YELLOW
    Write-Host "  ----------------------------------------------------------------"
    Write-Host "  .\dev.ps1 clean             " -NoNewline; Write-Host "remove all containers + volumes (DANGER: deletes DB data)" -ForegroundColor $RED
    Write-Host ""

    Write-Host "  SERVICES" -ForegroundColor $YELLOW
    Write-Host "  ----------------------------------------------------------------"
    Write-Host "  Frontend:             " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor $CYAN
    Write-Host "  API Gateway:          " -NoNewline; Write-Host "http://localhost:8000" -ForegroundColor $CYAN
    Write-Host "  Auth Service:         " -NoNewline; Write-Host "http://localhost:8001" -ForegroundColor $CYAN
    Write-Host "  Auth Swagger:         " -NoNewline; Write-Host "http://localhost:8001/docs" -ForegroundColor $CYAN
    Write-Host "  Gamification Service: " -NoNewline; Write-Host "http://localhost:8002" -ForegroundColor $CYAN
    Write-Host "  Gamification Swagger: " -NoNewline; Write-Host "http://localhost:8002/docs" -ForegroundColor $CYAN
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor $CYAN
    Write-Host ""
}

function Assert-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Err "Docker not found. Download: https://www.docker.com/products/docker-desktop"
        exit 1
    }
}

function Assert-EnvFile {
    if (-not (Test-Path ".env")) {
        Write-Warn ".env not found - copying from .env.example..."
        Copy-Item ".env.example" ".env"
        Write-Ok ".env created. Edit if needed."
    }
}

function Assert-Node {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Err "Node.js not found. Download: https://nodejs.org (v18+)"
        return $false
    }
    return $true
}

function Invoke-Health {
    Write-Header "Health Check"
    $allOk = $true

    # Frontend
    Write-Info "Checking frontend..."
    try {
        $fe = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        Write-Ok "[frontend] http://localhost:3000 - $($fe.StatusCode) OK"
    } catch {
        Write-Warn "[frontend] http://localhost:3000 - not running (start with: .\dev.ps1 ui)"
    }

    foreach ($entry in $HEALTH_ENDPOINTS.GetEnumerator()) {
        try {
            $resp = Invoke-WebRequest -Uri $entry.Value -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                Write-Ok "[$($entry.Key)] $($entry.Value) - $($resp.StatusCode) OK"
            } else {
                Write-Warn "[$($entry.Key)] $($entry.Value) - $($resp.StatusCode)"
                $allOk = $false
            }
        } catch {
            Write-Err "[$($entry.Key)] $($entry.Value) - unreachable"
            $allOk = $false
        }
    }

    Write-Host ""
    if ($allOk) {
        Write-Ok "All backend services are up!"
    } else {
        Write-Warn "Some services are down. Check: .\dev.ps1 logs"
    }
}

function Invoke-Test {
    Write-Header "Quick API Test"

    Write-Info "Step 1: Register..."
    $regBody = '{"username":"devuser","email":"dev@test.com","password":"DevPass123!"}'
    try {
        $reg = Invoke-RestMethod -Method Post `
            -Uri "http://localhost:8001/api/v1/auth/register" `
            -Body $regBody `
            -ContentType "application/json" `
            -ErrorAction Stop
        Write-Ok "Registered: $($reg.user.email)"
    } catch {
        Write-Warn "Register: user may already exist (that's OK)"
    }

    Write-Info "Step 2: Login..."
    $loginBody = '{"email":"dev@test.com","password":"DevPass123!"}'
    $token = $null
    try {
        $login = Invoke-RestMethod -Method Post `
            -Uri "http://localhost:8001/api/v1/auth/login" `
            -Body $loginBody `
            -ContentType "application/json" `
            -ErrorAction Stop
        $token = $login.tokens.access_token
        Write-Ok "Token: $($token.Substring(0, [Math]::Min(40, $token.Length)))..."
    } catch {
        Write-Err "Login failed: $($_.Exception.Message)"
        return
    }

    if (-not $token) {
        Write-Err "Token is empty - check: .\dev.ps1 logs auth-service"
        return
    }

    $headers = @{ Authorization = "Bearer $token" }

    Write-Info "Step 3: Current user (/api/v1/auth/me)..."
    $uid = $null
    try {
        $me = Invoke-RestMethod -Uri "http://localhost:8001/api/v1/auth/me" -Headers $headers -ErrorAction Stop
        $uid = $me.id
        Write-Ok "User: $($me.username), ID: $uid"
    } catch {
        Write-Warn "Get me: $($_.Exception.Message)"
    }

    Write-Info "Step 4: Quest list..."
    try {
        $quests = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/quests" -Headers $headers -ErrorAction Stop
        Write-Ok "Quests in DB: $($quests.total)"
    } catch {
        Write-Err "Quests error: $($_.Exception.Message)"
    }

    if ($uid) {
        Write-Info "Step 5: Game profile..."
        try {
            $profile = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/profile/$uid" -Headers $headers -ErrorAction Stop
            Write-Ok "Level: $($profile.level), XP: $($profile.total_xp), Quests done: $($profile.quests_completed)"
        } catch {
            Write-Warn "Profile: $($_.Exception.Message)"
        }
    }

    Write-Info "Step 6: Leaderboard..."
    try {
        $lb = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/leaderboard/xp?period=all_time&limit=5" -Headers $headers -ErrorAction Stop
        Write-Ok "Leaderboard all_time: $($lb.total_players) player(s)"
    } catch {
        Write-Warn "Leaderboard: $($_.Exception.Message)"
    }

    Write-Host ""
    Write-Ok "Test scenario done!"
    Write-Host ""
    Write-Info "Swagger UI:"
    foreach ($url in $SWAGGER_URLS) { Write-Info "  $url" }
}

# ================================================================
# MAIN
# ================================================================

Assert-Docker

$cmd = $Command.ToLower()

if ($cmd -eq "help" -or $cmd -eq "-h" -or $cmd -eq "--help") {
    Write-Help

} elseif ($cmd -eq "up" -or $cmd -eq "") {
    Write-Header "Gamification Platform - Start"
    Assert-EnvFile
    Write-Info "Starting: $($ACTIVE_SERVICES -join ', ')"
    docker compose up $ACTIVE_SERVICES --build -d
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Ok "Services started!"
        Write-Info "  Auth Service:         http://localhost:8001"
        Write-Info "  Gamification Service: http://localhost:8002"
        Write-Host ""
        Write-Info "Wait ~10s then run: .\dev.ps1 health"
        Write-Info "For full stack (backend + frontend): .\dev.ps1 dev"
    } else {
        Write-Err "Startup error. Check: .\dev.ps1 logs"
    }

} elseif ($cmd -eq "dev") {
    Write-Header "Gamification Platform - Full Stack"
    Assert-EnvFile
    if (-not (Assert-Node)) { exit 1 }
    Write-Info "Step 1/3: Starting backend..."
    docker compose up $ACTIVE_SERVICES --build -d
    if ($LASTEXITCODE -ne 0) { Write-Err "Backend failed"; exit 1 }
    Write-Info "Step 2/3: Waiting 8s for services to be ready..."
    Start-Sleep -Seconds 8
    Invoke-Health
    Write-Host ""
    Write-Info "Step 3/3: Starting frontend (http://localhost:3000)..."
    Set-Location frontend
    npm run dev
    Set-Location ..

} elseif ($cmd -eq "ui") {
    if (-not (Assert-Node)) { exit 1 }
    Write-Header "Frontend Dev Server"
    Write-Info "Starting Vite at http://localhost:3000 ..."
    Set-Location frontend
    npm run dev
    Set-Location ..

} elseif ($cmd -eq "ui:install") {
    if (-not (Assert-Node)) { exit 1 }
    Write-Header "Frontend - npm install"
    Set-Location frontend
    npm install
    Set-Location ..
    Write-Ok "Dependencies installed"

} elseif ($cmd -eq "ui:build") {
    if (-not (Assert-Node)) { exit 1 }
    Write-Header "Frontend - Production Build"
    Set-Location frontend
    npm run build
    Set-Location ..
    Write-Ok "Build complete -> frontend/dist/"

} elseif ($cmd -eq "ui:open") {
    Write-Info "Opening http://localhost:3000 ..."
    Start-Process "http://localhost:3000"

} elseif ($cmd -eq "stop") {
    Write-Header "Stop services"
    docker compose stop $ACTIVE_SERVICES
    Write-Ok "Services stopped"

} elseif ($cmd -eq "restart") {
    Write-Header "Restart"
    $target = if ($Service) { $Service } else { $ACTIVE_SERVICES -join " " }
    docker compose restart $target
    Write-Ok "Restarted: $target"

} elseif ($cmd -eq "logs") {
    $target = if ($Service) { $Service } else { $ACTIVE_SERVICES -join " " }
    Write-Header "Logs: $target"
    docker compose logs --tail=100 -f $target

} elseif ($cmd -eq "health") {
    Invoke-Health

} elseif ($cmd -eq "test") {
    Invoke-Test

} elseif ($cmd -eq "clean") {
    Write-Header "Clean - remove containers and volumes"
    Write-Warn "WARNING: all database data will be deleted!"
    $confirm = Read-Host "Continue? (y/N)"
    if ($confirm -eq "y") {
        docker compose down -v --remove-orphans
        Write-Ok "Done"
    } else {
        Write-Info "Cancelled"
    }

} elseif ($cmd -eq "rebuild") {
    Write-Header "Full rebuild (no cache)"
    $target = if ($Service) { $Service } else { $ACTIVE_SERVICES -join " " }
    docker compose build --no-cache $target
    docker compose up $target -d
    Write-Ok "Rebuilt and started: $target"

} elseif ($cmd -eq "db") {
    Write-Header "Connect to psql"
    Write-Info "Type \q to exit"
    docker compose exec postgres psql -U gamification_user -d gamification_db

} elseif ($cmd -eq "open") {
    Write-Header "Open Swagger UI"
    foreach ($url in $SWAGGER_URLS) {
        Write-Info $url
        Start-Process $url
        Start-Sleep -Milliseconds 500
    }

} else {
    Write-Warn "Unknown command: '$Command'"
    Write-Host ""
    Write-Info "Run '.\dev.ps1 help' to see all available commands."
    Write-Host ""
}
