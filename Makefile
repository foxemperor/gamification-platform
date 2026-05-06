.PHONY: help up down logs logs-auth logs-gamification restart clean clean-all \
        init-db migrate db-shell redis-shell \
        test test-cov lint format shell install ps \
        ui-install ui-dev ui-build

# ===================================
# ЦВЕТА ДЛЯ КРАСИВОГО ВЫВОДА
# ===================================
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
CYAN   := \033[0;36m
BOLD   := \033[1m
NC     := \033[0m

# ===================================
# ПЕРЕМЕННЫЕ
# ===================================
DOCKER_COMPOSE        := docker-compose
DOCKER_COMPOSE_FILE   := docker-compose.yml
API_GATEWAY_CONTAINER := gamification-api-gateway
POSTGRES_CONTAINER    := gamification-postgres

# ===================================
# HELP — показать все доступные команды
# Цель по умолчанию: make (без аргумента)
# ===================================
.DEFAULT_GOAL := help

help:
	@echo ""
	@echo "$(CYAN)$(BOLD)================================================================$(NC)"
	@echo "$(CYAN)$(BOLD)  🎮 Gamification Platform  --  Makefile$(NC)"
	@echo "$(CYAN)$(BOLD)  Linux / macOS$(NC)"
	@echo "$(CYAN)$(BOLD)================================================================$(NC)"
	@echo ""
	@echo "$(YELLOW)$(BOLD)  BACKEND (Docker)$(NC)"
	@echo "  $(BOLD)make up$(NC)              - Запустить все сервисы"
	@echo "  $(BOLD)make down$(NC)            - Остановить все сервисы"
	@echo "  $(BOLD)make restart$(NC)         - Перезапустить все сервисы"
	@echo "  $(BOLD)make ps$(NC)              - Статус всех контейнеров"
	@echo ""
	@echo "$(YELLOW)$(BOLD)  FRONTEND (Node.js / Vite)$(NC)"
	@echo "  $(BOLD)make ui-install$(NC)      - npm install в ./frontend"
	@echo "  $(BOLD)make ui-dev$(NC)          - Запустить Vite dev-сервер (http://localhost:3000)"
	@echo "  $(BOLD)make ui-build$(NC)        - Production-сборка -> frontend/dist/"
	@echo ""
	@echo "$(YELLOW)$(BOLD)  LOGS & MONITORING$(NC)"
	@echo "  $(BOLD)make logs$(NC)            - Логи всех сервисов (live)"
	@echo "  $(BOLD)make logs-api$(NC)        - Логи API Gateway"
	@echo "  $(BOLD)make logs-auth$(NC)       - Логи Auth Service"
	@echo "  $(BOLD)make logs-gamification$(NC) - Логи Gamification Service"
	@echo ""
	@echo "$(YELLOW)$(BOLD)  БАЗА ДАННЫХ$(NC)"
	@echo "  $(BOLD)make init-db$(NC)         - Инициализировать БД"
	@echo "  $(BOLD)make migrate$(NC)         - Применить Alembic-миграции"
	@echo "  $(BOLD)make db-shell$(NC)        - Открыть psql (PostgreSQL CLI)"
	@echo "  $(BOLD)make redis-shell$(NC)     - Открыть Redis CLI"
	@echo ""
	@echo "$(YELLOW)$(BOLD)  ТЕСТИРОВАНИЕ И КАЧЕСТВО$(NC)"
	@echo "  $(BOLD)make test$(NC)            - Запустить pytest"
	@echo "  $(BOLD)make test-cov$(NC)        - pytest + HTML coverage report (htmlcov/)"
	@echo "  $(BOLD)make lint$(NC)            - flake8 + mypy"
	@echo "  $(BOLD)make format$(NC)          - black + isort (автоформатирование)"
	@echo ""
	@echo "$(YELLOW)$(BOLD)  РАЗРАБОТКА$(NC)"
	@echo "  $(BOLD)make shell$(NC)           - Bash внутри контейнера API Gateway"
	@echo "  $(BOLD)make install$(NC)         - pip install локально (для IDE)"
	@echo ""
	@echo "$(YELLOW)$(BOLD)  ОЧИСТКА$(NC)"
	@echo "  $(BOLD)make clean$(NC)           - Удалить __pycache__, .pyc, htmlcov..."
	@echo "  $(BOLD)make clean-all$(NC)       - Удалить все включая Docker volumes $(RED)(ОПАСНО!)$(NC)"
	@echo ""
	@echo "$(YELLOW)$(BOLD)  АДРЕСА СЕРВИСОВ$(NC)"
	@echo "  Frontend:              $(CYAN)http://localhost:3000$(NC)"
	@echo "  API Gateway:           $(CYAN)http://localhost:8000$(NC)"
	@echo "  Auth Service:          $(CYAN)http://localhost:8001$(NC)"
	@echo "  Auth Swagger:          $(CYAN)http://localhost:8001/docs$(NC)"
	@echo "  Gamification Service:  $(CYAN)http://localhost:8002$(NC)"
	@echo "  Gamification Swagger:  $(CYAN)http://localhost:8002/docs$(NC)"
	@echo ""
	@echo "$(CYAN)$(BOLD)================================================================$(NC)"
	@echo ""

# ===================================
# DOCKER УПРАВЛЕНИЕ
# ===================================

up:
	@echo "$(GREEN)🚀 Запуск всех сервисов...$(NC)"
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) up -d
	@echo "$(GREEN)✅ Сервисы запущены!$(NC)"
	@echo ""
	@echo "$(YELLOW)Доступные сервисы:$(NC)"
	@echo "  - Frontend:         http://localhost:3000  (make ui-dev)"
	@echo "  - API Gateway:      http://localhost:8000"
	@echo "  - Auth Service:     http://localhost:8001/docs"
	@echo "  - Gamification:     http://localhost:8002/docs"

down:
	@echo "$(YELLOW)🛑 Остановка всех сервисов...$(NC)"
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) down
	@echo "$(GREEN)✅ Сервисы остановлены$(NC)"

restart: down up

ps:
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) ps

logs:
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) logs -f

logs-api:
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) logs -f api-gateway

logs-auth:
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) logs -f auth-service

logs-gamification:
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) logs -f gamification-service

# ===================================
# FRONTEND
# ===================================

ui-install:
	@echo "$(GREEN)📦 npm install...$(NC)"
	@cd frontend && npm install
	@echo "$(GREEN)✅ Зависимости установлены$(NC)"

ui-dev:
	@echo "$(GREEN)⚡ Запуск Vite dev-сервера...$(NC)"
	@cd frontend && npm run dev

ui-build:
	@echo "$(GREEN)🏗️  Production-сборка...$(NC)"
	@cd frontend && npm run build
	@echo "$(GREEN)✅ Сборка готова: frontend/dist/$(NC)"

# ===================================
# БАЗА ДАННЫХ
# ===================================

init-db:
	@echo "$(GREEN)🗄️  Инициализация базы данных...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) python -m scripts.init_db
	@echo "$(GREEN)✅ База данных инициализирована$(NC)"

migrate:
	@echo "$(GREEN)🔄 Применение миграций...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) alembic upgrade head
	@echo "$(GREEN)✅ Миграции применены$(NC)"

db-shell:
	@echo "$(YELLOW)🐘 Подключение к PostgreSQL...$(NC)"
	@$(DOCKER_COMPOSE) exec $(POSTGRES_CONTAINER) psql -U gamification_user -d gamification_db

redis-shell:
	@echo "$(YELLOW)🔴 Подключение к Redis CLI...$(NC)"
	@$(DOCKER_COMPOSE) exec redis redis-cli

# ===================================
# ТЕСТИРОВАНИЕ
# ===================================

test:
	@echo "$(GREEN)🧪 Запуск тестов...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) pytest -v
	@echo "$(GREEN)✅ Тесты завершены$(NC)"

test-cov:
	@echo "$(GREEN)🧪 Тесты + покрытие...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) pytest --cov=app --cov-report=html --cov-report=term
	@echo "$(GREEN)✅ Отчёт создан: htmlcov/index.html$(NC)"

lint:
	@echo "$(GREEN)🔍 Проверка кода...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) flake8 app/
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) mypy app/
	@echo "$(GREEN)✅ Проверка завершена$(NC)"

format:
	@echo "$(GREEN)✨ Форматирование кода...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) black app/
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) isort app/
	@echo "$(GREEN)✅ Код отформатирован$(NC)"

# ===================================
# ОЧИСТКА
# ===================================

clean:
	@echo "$(YELLOW)🧹 Очистка временных файлов...$(NC)"
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@find . -type f -name "*.pyo" -delete 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name ".coverage" -delete 2>/dev/null || true
	@echo "$(GREEN)✅ Очистка завершена$(NC)"

clean-all: down
	@echo "$(RED)⚠️  ВНИМАНИЕ: БУДУТ УДАЛЕНЫ ВСЕ ДАННЫЕ БД!$(NC)"
	@read -p "Вы уверены? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) down -v
	@echo "$(GREEN)✅ Все volumes удалены$(NC)"

# ===================================
# РАЗРАБОТКА
# ===================================

shell:
	@echo "$(YELLOW)🐚 Вход в shell API Gateway...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) /bin/bash

install:
	@echo "$(GREEN)📦 Установка зависимостей локально...$(NC)"
	@cd services/api-gateway && pip install -r requirements.txt
	@echo "$(GREEN)✅ Зависимости установлены$(NC)"
