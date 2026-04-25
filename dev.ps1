# ================================================================
# dev.ps1 — Быстрый запуск для разработки (Windows 11 / PowerShell)
# Проект: Gamification Platform
# Автор: Dmitry Koval
# ================================================================
# Использование:
#   .\dev.ps1             — запустить рабочие сервисы
#   .\dev.ps1 stop        — остановить все
#   .\dev.ps1 restart     — перезапустить все
#   .\dev.ps1 logs        — показать логи всех сервисов
#   .\dev.ps1 logs auth   — логи конкретного сервиса
#   .\dev.ps1 health      — проверить health всех сервисов
#   .\dev.ps1 test        — быстрый сценарий тестирования
#   .\dev.ps1 clean       — удалить контейнеры и волюмы
#   .\dev.ps1 rebuild     — полная пересборка без кэша
#   .\dev.ps1 db          — открыть psql в контейнере
#   .\dev.ps1 open        — открыть Swagger UI в браузере
# ================================================================

param(
    [string]$Command = "up",
    [string]$Service = ""
)

# Цвета для логов
$C = @{
    Reset   = "`e[0m"
    Bold    = "`e[1m"
    Cyan    = "`e[36m"
    Green   = "`e[32m"
    Yellow  = "`e[33m"
    Red     = "`e[31m"
    Gray    = "`e[90m"
}

# Сервисы, которые запускаем (без недоделанных)
$ACTIVE_SERVICES = @("postgres", "redis", "auth-service", "gamification-service")

$HEALTH_ENDPOINTS = @{
    "auth-service"          = "http://localhost:8001/health"
    "gamification-service"  = "http://localhost:8002/health"
    "gamification-service (ready)" = "http://localhost:8002/health/ready"
}

$SWAGGER_URLS = @(
    "http://localhost:8001/docs"
    "http://localhost:8002/docs"
)

# ================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ================================================================

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "$($C.Cyan)$($C.Bold)=== $Text ===$($C.Reset)"
    Write-Host ""
}

function Write-Ok   { param([string]$T) Write-Host "$($C.Green)  ✓ $T$($C.Reset)" }
function Write-Warn { param([string]$T) Write-Host "$($C.Yellow)  ! $T$($C.Reset)" }
function Write-Err  { param([string]$T) Write-Host "$($C.Red)  ✗ $T$($C.Reset)" }
function Write-Info { param([string]$T) Write-Host "$($C.Gray)  → $T$($C.Reset)" }

function Assert-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Err "Docker не установлен или недоступен в PATH"
        Write-Info "Скачайте: https://www.docker.com/products/docker-desktop"
        exit 1
    }
}

function Assert-EnvFile {
    if (-not (Test-Path ".env")) {
        Write-Warn "Файл .env не найден — создаю из .env.example..."
        Copy-Item ".env.example" ".env"
        Write-Ok ".env создан. Проверьте настройки если нужно."
    }
}

function Invoke-Health {
    Write-Header "Проверка Health Endpoints"
    $allOk = $true

    foreach ($entry in $HEALTH_ENDPOINTS.GetEnumerator()) {
        try {
            $resp = Invoke-WebRequest -Uri $entry.Value -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                Write-Ok "[$($entry.Key)] $($entry.Value) — $($resp.StatusCode) OK"
            } else {
                Write-Warn "[$($entry.Key)] $($entry.Value) — $($resp.StatusCode)"
                $allOk = $false
            }
        } catch {
            Write-Err "[$($entry.Key)] $($entry.Value) — недоступен"
            $allOk = $false
        }
    }

    Write-Host ""
    if ($allOk) {
        Write-Ok "Все сервисы работают! 🎉"
    } else {
        Write-Warn "Некоторые сервисы недоступны. Проверьте: .\dev.ps1 logs"
    }
}

function Invoke-Test {
    Write-Header "Быстрый тест API"

    # 1. Регистрация
    Write-Info "Шаг 1: Регистрация..."
    $regBody = '{"username":"devuser","email":"dev@test.com","password":"DevPass123!"}'
    try {
        $reg = Invoke-RestMethod -Method Post `
            -Uri "http://localhost:8001/api/v1/auth/register" `
            -Body $regBody `
            -ContentType "application/json" `
            -ErrorAction Stop
        Write-Ok "Регистрация успешна: $($reg.email)"
    } catch {
        Write-Warn "Регистрация: пользователь уже существует или сервис недоступен"
    }

    # 2. Логин
    Write-Info "Шаг 2: Логин..."
    $loginBody = '{"email":"dev@test.com","password":"DevPass123!"}'
    try {
        $login = Invoke-RestMethod -Method Post `
            -Uri "http://localhost:8001/api/v1/auth/login" `
            -Body $loginBody `
            -ContentType "application/json" `
            -ErrorAction Stop
        $token = $login.access_token
        Write-Ok "Токен получен: $($token.Substring(0, [Math]::Min(40, $token.Length)))..."
    } catch {
        Write-Err "Логин не удался: $($_.Exception.Message)"
        return
    }

    # 3. Список квестов
    Write-Info "Шаг 3: Список квестов..."
    try {
        $quests = Invoke-RestMethod `
            -Uri "http://localhost:8002/api/v1/quests" `
            -Headers @{ Authorization = "Bearer $token" } `
            -ErrorAction Stop
        Write-Ok "Квестов в БД: $($quests.total)"
    } catch {
        Write-Err "Ошибка получения квестов: $($_.Exception.Message)"
    }

    # 4. Профиль игрока
    Write-Info "Шаг 4: Профиль..."
    try {
        $me = Invoke-RestMethod `
            -Uri "http://localhost:8001/api/v1/users/me" `
            -Headers @{ Authorization = "Bearer $token" } `
            -ErrorAction Stop
        $uid = $me.id
        Write-Ok "Пользователь: $($me.username) (ID: $uid)"

        $profile = Invoke-RestMethod `
            -Uri "http://localhost:8002/api/v1/profile/$uid" `
            -Headers @{ Authorization = "Bearer $token" } `
            -ErrorAction Stop
        Write-Ok "Игровой профиль: Level $($profile.level), XP $($profile.total_xp)"
    } catch {
        Write-Warn "Профиль: $($_.Exception.Message)"
    }

    # 5. Лидерборд
    Write-Info "Шаг 5: Лидерборд..."
    try {
        $lb = Invoke-RestMethod `
            -Uri "http://localhost:8002/api/v1/leaderboard/xp?period=all_time&limit=5" `
            -Headers @{ Authorization = "Bearer $token" } `
            -ErrorAction Stop
        Write-Ok "Лидерборд all_time: $($lb.total_players) игроков"
    } catch {
        Write-Warn "Лидерборд: $($_.Exception.Message)"
    }

    Write-Host ""
    Write-Ok "Тестовый сценарий завершён!"
    Write-Info "Swagger UI:"
    foreach ($url in $SWAGGER_URLS) { Write-Info "  $url" }
}

# ================================================================
# ОСНОВНОЙ ОБРАБОТЧИК КОМАНД
# ================================================================

Assert-Docker

switch ($Command.ToLower()) {

    # ----- ЗАПУСК -----
    { $_ -in @("up", "") } {
        Write-Header "Gamification Platform — Запуск сервисов"
        Assert-EnvFile

        Write-Info "Запуск: $($ACTIVE_SERVICES -join ', ')"
        docker compose up $ACTIVE_SERVICES --build -d

        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Ok "Сервисы запущены!"
            Write-Info "  Auth Service:          http://localhost:8001"
            Write-Info "  Gamification Service:  http://localhost:8002"
            Write-Info ""
            Write-Info "Подождите ~10сек и запустите: .\dev.ps1 health"
        } else {
            Write-Err "Ошибка запуска. Проверьте: .\dev.ps1 logs"
        }
    }

    # ----- ОСТАНОВКА -----
    "stop" {
        Write-Header "Остановка сервисов"
        docker compose stop $ACTIVE_SERVICES
        Write-Ok "Сервисы остановлены"
    }

    # ----- ПЕРЕЗАПУСК -----
    "restart" {
        Write-Header "Перезапуск"
        $target = if ($Service) { $Service } else { $ACTIVE_SERVICES -join " " }
        docker compose restart $target
        Write-Ok "Перезапущено: $target"
    }

    # ----- ЛОГИ -----
    "logs" {
        $target = if ($Service) { $Service } else { $ACTIVE_SERVICES -join " " }
        Write-Header "Логи: $target"
        docker compose logs --tail=100 -f $target
    }

    # ----- HEALTH -----
    "health" {
        Invoke-Health
    }

    # ----- ТЕСТ -----
    "test" {
        Invoke-Test
    }

    # ----- ЧИСТКА -----
    "clean" {
        Write-Header "Удаление контейнеров и волюмов"
        Write-Warn "Внимание: будут удалены все данные БД!"
        $confirm = Read-Host "Продолжить? (y/N)"
        if ($confirm -eq "y") {
            docker compose down -v --remove-orphans
            Write-Ok "Удалено"
        } else {
            Write-Info "Отменено"
        }
    }

    # ----- ПЕРЕСБОРКА БЕЗ КЭША -----
    "rebuild" {
        Write-Header "Полная пересборка"
        $target = if ($Service) { $Service } else { $ACTIVE_SERVICES -join " " }
        docker compose build --no-cache $target
        docker compose up $target -d
        Write-Ok "Пересобрано и запущено: $target"
    }

    # ----- PSQL -----
    "db" {
        Write-Header "Подключение к psql"
        Write-Info "Введите \q для выхода"
        docker compose exec postgres psql -U gamification_user -d gamification_db
    }

    # ----- ОТКРЫТЬ БРАУЗЕР -----
    "open" {
        Write-Header "Открываю Swagger UI"
        foreach ($url in $SWAGGER_URLS) {
            Write-Info $url
            Start-Process $url
            Start-Sleep -Milliseconds 500
        }
    }

    # ----- HELP -----
    default {
        Write-Host ""
        Write-Host "$($C.Cyan)$($C.Bold)Gamification Platform — dev.ps1$($C.Reset)"
        Write-Host ""
        Write-Host "  $($C.Bold).\dev.ps1$($C.Reset)              — запустить сервисы"
        Write-Host "  $($C.Bold).\dev.ps1 stop$($C.Reset)         — остановить все"
        Write-Host "  $($C.Bold).\dev.ps1 restart$($C.Reset)      — перезапустить все"
        Write-Host "  $($C.Bold).\dev.ps1 restart auth$($C.Reset) — перезапустить конкретный сервис"
        Write-Host "  $($C.Bold).\dev.ps1 logs$($C.Reset)         — логи всех сервисов"
        Write-Host "  $($C.Bold).\dev.ps1 logs gamification$($C.Reset) — логи конкретного"
        Write-Host "  $($C.Bold).\dev.ps1 health$($C.Reset)       — проверить health"
        Write-Host "  $($C.Bold).\dev.ps1 test$($C.Reset)         — быстрый сценарий тестирования"
        Write-Host "  $($C.Bold).\dev.ps1 clean$($C.Reset)        — удалить все + волюмы"
        Write-Host "  $($C.Bold).\dev.ps1 rebuild$($C.Reset)      — пересборка без кэша"
        Write-Host "  $($C.Bold).\dev.ps1 db$($C.Reset)           — открыть psql"
        Write-Host "  $($C.Bold).\dev.ps1 open$($C.Reset)         — открыть Swagger UI"
        Write-Host ""
    }
}
