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
#   .\dev.ps1 db:init      - check DB schemas and run migrations
#   .\dev.ps1 db:status    - show current migration state
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

$ACTIVE_SERVICES = @("postgres", "redis", "auth-service", "gamification-service", "api-gateway")

$HEALTH_ENDPOINTS = [ordered]@{
    "api-gateway"                = "http://localhost:8000/health"
    "auth-service"               = "http://localhost:8001/health"
    "gamification-service"       = "http://localhost:8002/health"
    "gamification-service/ready" = "http://localhost:8002/health/ready"
}

$SWAGGER_URLS = @(
    "http://localhost:8000/docs"
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
    Write-Host "  .\dev.ps1 db:init           " -NoNewline; Write-Host "check schemas & run migrations (safe, idempotent)" -ForegroundColor $GRAY
    Write-Host "  .\dev.ps1 db:status         " -NoNewline; Write-Host "show current Alembic migration state" -ForegroundColor $GRAY
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

# ================================================================
# DB INIT — проверка схем и запуск миграций
# ================================================================

function Invoke-DbInit {
    param([bool]$Silent = $false)

    if (-not $Silent) { Write-Header "Database Init" }

    # Проверяем что postgres запущен
    $pgRunning = docker ps --filter "name=gamification-postgres" --filter "status=running" -q
    if (-not $pgRunning) {
        Write-Err "PostgreSQL container is not running!"
        Write-Info "Start it first: .\dev.ps1 up"
        return $false
    }

    # ── Проверяем наличие схем ──
    Write-Info "Checking database schemas..."

    $authSchemaExists = docker exec gamification-postgres psql `
        -U gamification_user -d gamification_db -tAc `
        "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth';"

    $gamSchemaExists = docker exec gamification-postgres psql `
        -U gamification_user -d gamification_db -tAc `
        "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'gamification';"

    $authTablesCount = docker exec gamification-postgres psql `
        -U gamification_user -d gamification_db -tAc `
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'auth';"

    $gamTablesCount = docker exec gamification-postgres psql `
        -U gamification_user -d gamification_db -tAc `
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'gamification';"

    $authTablesCount = $authTablesCount.Trim()
    $gamTablesCount  = $gamTablesCount.Trim()

    # ── Статус схем ──
    Write-Host ""
    Write-Host "  Schema Status:" -ForegroundColor $CYAN

    if ($authSchemaExists -eq "1") {
        Write-Ok   "  schema 'auth'          exists  ($authTablesCount table(s))"
    } else {
        Write-Warn "  schema 'auth'          MISSING"
    }

    if ($gamSchemaExists -eq "1") {
        Write-Ok   "  schema 'gamification'  exists  ($gamTablesCount table(s))"
    } else {
        Write-Warn "  schema 'gamification'  MISSING"
    }

    # ── Проверяем нужно ли накатывать миграции ──
    $needsMigration = ($authSchemaExists -ne "1") -or ($gamSchemaExists -ne "1") `
                   -or ([int]$authTablesCount -eq 0) -or ([int]$gamTablesCount -eq 0)

    if (-not $needsMigration) {
        Write-Host ""
        Write-Ok "Database is healthy. No migrations needed."
        Write-Host ""
        return $true
    }

    # ── Предлагаем накатить миграции ──
    Write-Host ""
    Write-Warn "One or more schemas/tables are missing."
    Write-Host ""
    $confirm = Read-Host "  Run migrations now to initialize DB? (Y/n)"
    if ($confirm -eq "n" -or $confirm -eq "N") {
        Write-Warn "Skipped. Services may fail until DB is initialized."
        Write-Info "Run manually: .\dev.ps1 db:init"
        return $false
    }

    Write-Host ""
    Write-Info "Running Alembic migrations..."
    Write-Host ""

    # ── auth-service migrations ──
    Write-Host "  [auth-service]" -ForegroundColor $YELLOW
    $authContainer = docker ps --filter "name=gamification-auth-service" --filter "status=running" -q
    if ($authContainer) {
        docker exec gamification-auth-service python -m alembic upgrade head
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "  auth-service migrations done"
        } else {
            Write-Err "  auth-service migrations FAILED"
            Write-Info "  Check logs: docker logs gamification-auth-service --tail 30"
        }
    } else {
        Write-Warn "  auth-service container not running — starting temporarily..."
        docker compose run --rm --no-deps auth-service python -m alembic upgrade head
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "  auth-service migrations done"
        } else {
            Write-Err "  auth-service migrations FAILED"
        }
    }

    Write-Host ""

    # ── gamification-service migrations ──
    Write-Host "  [gamification-service]" -ForegroundColor $YELLOW
    $gamContainer = docker ps --filter "name=gamification-gamification-service" --filter "status=running" -q
    if ($gamContainer) {
        docker exec gamification-gamification-service python -m alembic upgrade head
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "  gamification-service migrations done"
        } else {
            Write-Err "  gamification-service migrations FAILED"
            Write-Info "  Check logs: docker logs gamification-gamification-service --tail 30"
        }
    } else {
        Write-Warn "  gamification-service container not running — starting temporarily..."
        docker compose run --rm --no-deps gamification-service python -m alembic upgrade head
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "  gamification-service migrations done"
        } else {
            Write-Err "  gamification-service migrations FAILED"
        }
    }

    Write-Host ""

    # ── Итоговая проверка ──
    Write-Info "Verifying final state..."

    $authFinal = docker exec gamification-postgres psql `
        -U gamification_user -d gamification_db -tAc `
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'auth';"

    $gamFinal = docker exec gamification-postgres psql `
        -U gamification_user -d gamification_db -tAc `
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'gamification';"

    Write-Host ""
    if (([int]$authFinal.Trim() -gt 0) -and ([int]$gamFinal.Trim() -gt 0)) {
        Write-Ok "DB initialized successfully!"
        Write-Info "  schema 'auth'         : $($authFinal.Trim()) table(s)"
        Write-Info "  schema 'gamification' : $($gamFinal.Trim()) table(s)"
    } else {
        Write-Err "DB initialization incomplete. Check migration logs above."
    }
    Write-Host ""
    return $true
}

# ================================================================
# DB STATUS
# ================================================================

function Invoke-DbStatus {
    Write-Header "Database Migration Status"

    $pgRunning = docker ps --filter "name=gamification-postgres" --filter "status=running" -q
    if (-not $pgRunning) {
        Write-Err "PostgreSQL is not running"
        return
    }

    Write-Host "  Schemas & Tables:" -ForegroundColor $CYAN
    docker exec gamification-postgres psql -U gamification_user -d gamification_db -c `
        "SELECT table_schema, COUNT(*) as tables FROM information_schema.tables WHERE table_schema IN ('auth','gamification','public') GROUP BY table_schema ORDER BY table_schema;"

    Write-Host ""
    Write-Host "  Alembic versions:" -ForegroundColor $CYAN
    docker exec gamification-postgres psql -U gamification_user -d gamification_db -c `
        "SELECT * FROM alembic_version;" 2>$null
    Write-Host ""

    $authContainer = docker ps --filter "name=gamification-auth-service" --filter "status=running" -q
    if ($authContainer) {
        Write-Host "  auth-service alembic current:" -ForegroundColor $CYAN
        docker exec gamification-auth-service python -m alembic current
    }

    $gamContainer = docker ps --filter "name=gamification-gamification-service" --filter "status=running" -q
    if ($gamContainer) {
        Write-Host ""
        Write-Host "  gamification-service alembic current:" -ForegroundColor $CYAN
        docker exec gamification-gamification-service python -m alembic current
    }
}

# ================================================================
# HEALTH CHECK
# ================================================================

function Invoke-Health {
    Write-Header "Health Check"
    $allOk = $true

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
        Write-Warn "Some services are down. Check: docker logs <container-name>"
    }
}

# ================================================================
# TEST SCENARIO
# ================================================================

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
        Write-Err "Token is empty - check: docker logs gamification-auth-service"
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
        Write-Info "Waiting 10s for services to be ready..."
        Start-Sleep -Seconds 10
        Invoke-DbInit -Silent $false
        Write-Host ""
        Write-Info "Run '.\dev.ps1 health' to verify all services are up."
        Write-Info "Run '.\dev.ps1 test'   to run the full API test scenario."
    } else {
        Write-Err "Startup error. Check: docker logs gamification-auth-service"
    }

} elseif ($cmd -eq "dev") {
    Write-Header "Gamification Platform - Full Stack"
    Assert-EnvFile
    if (-not (Assert-Node)) { exit 1 }
    Write-Info "Step 1/4: Starting backend..."
    docker compose up $ACTIVE_SERVICES --build -d
    if ($LASTEXITCODE -ne 0) { Write-Err "Backend failed"; exit 1 }
    Write-Info "Step 2/4: Waiting 10s for services to be ready..."
    Start-Sleep -Seconds 10
    Write-Info "Step 3/4: Initializing database..."
    Invoke-DbInit -Silent $false
    Write-Host ""
    Invoke-Health
    Write-Host ""
    Write-Info "Step 4/4: Starting frontend (http://localhost:3000)..."
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
    docker compose stop @ACTIVE_SERVICES
    Write-Ok "Services stopped"

} elseif ($cmd -eq "restart") {
    Write-Header "Restart"
    if ($Service) {
        docker compose restart $Service
        Write-Ok "Restarted: $Service"
    } else {
        docker compose restart @ACTIVE_SERVICES
        Write-Ok "Restarted: $($ACTIVE_SERVICES -join ', ')"
    }

} elseif ($cmd -eq "logs") {
    if ($Service) {
        docker compose logs --tail=100 -f $Service
    } else {
        docker compose logs --tail=100 -f @ACTIVE_SERVICES
    }

} elseif ($cmd -eq "health") {
    Invoke-Health

} elseif ($cmd -eq "db:init") {
    Invoke-DbInit

} elseif ($cmd -eq "db:status") {
    Invoke-DbStatus

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
    if ($Service) {
        docker compose build --no-cache $Service
        docker compose up $Service -d
        Write-Ok "Rebuilt and started: $Service"
    } else {
        docker compose build --no-cache @ACTIVE_SERVICES
        docker compose up @ACTIVE_SERVICES -d
        Write-Ok "Rebuilt and started: $($ACTIVE_SERVICES -join ', ')"
    }

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
