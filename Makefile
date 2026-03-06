.PHONY: help up down logs restart clean init-db migrate test lint format

# ===================================
# ЦВЕТА ДЛЯ КРАСИВОГО ВЫВОДА
# ===================================
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
NC     := \033[0m # No Color

# ===================================
# ПЕРЕМЕННЫЕ
# ===================================
DOCKER_COMPOSE := docker-compose
DOCKER_COMPOSE_FILE := docker-compose.yml
API_GATEWAY_CONTAINER := gamification-api-gateway
POSTGRES_CONTAINER := gamification-postgres

# ===================================
# HELP - показать все доступные команды
# ===================================
help:
	@echo "$(GREEN)╔════════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║  🎮 Gamification Platform - Makefile Commands                 ║$(NC)"
	@echo "$(GREEN)╚════════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(YELLOW)📦 Управление Docker:$(NC)"
	@echo "  make up              - Запустить все сервисы"
	@echo "  make down            - Остановить все сервисы"
	@echo "  make restart         - Перезапустить все сервисы"
	@echo "  make logs            - Показать логи всех сервисов"
	@echo "  make logs-api        - Показать логи API Gateway"
	@echo "  make ps              - Показать статус контейнеров"
	@echo ""
	@echo "$(YELLOW)🗄️  База данных:$(NC)"
	@echo "  make init-db         - Инициализировать базу данных"
	@echo "  make migrate         - Применить миграции"
	@echo "  make db-shell        - Подключиться к PostgreSQL shell"
	@echo "  make redis-shell     - Подключиться к Redis CLI"
	@echo ""
	@echo "$(YELLOW)🧪 Тестирование и качество:$(NC)"
	@echo "  make test            - Запустить все тесты"
	@echo "  make test-cov        - Тесты с покрытием кода"
	@echo "  make lint            - Проверка кода (flake8, mypy)"
	@echo "  make format          - Форматирование кода (black, isort)"
	@echo ""
	@echo "$(YELLOW)🧹 Очистка:$(NC)"
	@echo "  make clean           - Удалить временные файлы"
	@echo "  make clean-all       - Удалить volumes и все данные (⚠️  опасно)"
	@echo ""
	@echo "$(YELLOW)🔧 Разработка:$(NC)"
	@echo "  make shell           - Войти в shell API Gateway контейнера"
	@echo "  make install         - Установить зависимости локально"
	@echo ""

# ===================================
# DOCKER УПРАВЛЕНИЕ
# ===================================

# Запустить все сервисы
up:
	@echo "$(GREEN)🚀 Запуск всех сервисов...$(NC)"
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) up -d
	@echo "$(GREEN)✅ Сервисы запущены!$(NC)"
	@echo ""
	@echo "$(YELLOW)Доступные сервисы:$(NC)"
	@echo "  - API Gateway:      http://localhost:8000"
	@echo "  - API Docs:         http://localhost:8000/docs"
	@echo "  - Auth Service:     http://localhost:8001"
	@echo "  - Gamification:     http://localhost:8002"
	@echo "  - Integration:      http://localhost:8003"
	@echo "  - Analytics:        http://localhost:8004"

# Остановить все сервисы
down:
	@echo "$(YELLOW)🛑 Остановка всех сервисов...$(NC)"
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) down
	@echo "$(GREEN)✅ Сервисы остановлены$(NC)"

# Перезапустить все сервисы
restart: down up

# Показать логи
logs:
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) logs -f

# Показать логи API Gateway
logs-api:
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) logs -f api-gateway

# Показать статус контейнеров
ps:
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) ps

# ===================================
# БАЗА ДАННЫХ
# ===================================

# Инициализировать базу данных
init-db:
	@echo "$(GREEN)🗄️  Инициализация базы данных...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) python -m scripts.init_db
	@echo "$(GREEN)✅ База данных инициализирована$(NC)"

# Применить миграции (Alembic)
migrate:
	@echo "$(GREEN)🔄 Применение миграций...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) alembic upgrade head
	@echo "$(GREEN)✅ Миграции применены$(NC)"

# Подключиться к PostgreSQL
db-shell:
	@echo "$(YELLOW)🐘 Подключение к PostgreSQL...$(NC)"
	@$(DOCKER_COMPOSE) exec $(POSTGRES_CONTAINER) psql -U gamification_user -d gamification_db

# Подключиться к Redis CLI
redis-shell:
	@echo "$(YELLOW)🔴 Подключение к Redis CLI...$(NC)"
	@$(DOCKER_COMPOSE) exec redis redis-cli

# ===================================
# ТЕСТИРОВАНИЕ
# ===================================

# Запустить все тесты
test:
	@echo "$(GREEN)🧪 Запуск тестов...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) pytest -v
	@echo "$(GREEN)✅ Тесты завершены$(NC)"

# Тесты с покрытием кода
test-cov:
	@echo "$(GREEN)🧪 Запуск тестов с покрытием...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) pytest --cov=app --cov-report=html --cov-report=term
	@echo "$(GREEN)✅ Отчёт о покрытии создан в htmlcov/$(NC)"

# Проверка кода (flake8, mypy)
lint:
	@echo "$(GREEN)🔍 Проверка кода...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) flake8 app/
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) mypy app/
	@echo "$(GREEN)✅ Проверка завершена$(NC)"

# Форматирование кода
format:
	@echo "$(GREEN)✨ Форматирование кода...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) black app/
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) isort app/
	@echo "$(GREEN)✅ Код отформатирован$(NC)"

# ===================================
# ОЧИСТКА
# ===================================

# Удалить временные файлы
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

# Удалить volumes (⚠️ удалит ВСЕ данные БД!)
clean-all: down
	@echo "$(RED)⚠️  ВНИМАНИЕ: Это удалит ВСЕ данные из базы данных!$(NC)"
	@read -p "Вы уверены? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) down -v
	@echo "$(GREEN)✅ Все volumes удалены$(NC)"

# ===================================
# РАЗРАБОТКА
# ===================================

# Войти в shell контейнера
shell:
	@echo "$(YELLOW)🐚 Вход в shell API Gateway...$(NC)"
	@$(DOCKER_COMPOSE) exec $(API_GATEWAY_CONTAINER) /bin/bash

# Установить зависимости локально (для IDE)
install:
	@echo "$(GREEN)📦 Установка зависимостей...$(NC)"
	@cd services/api-gateway && pip install -r requirements.txt
	@echo "$(GREEN)✅ Зависимости установлены$(NC)"

# ===================================
# PRODUCTION (планируется)
# ===================================

# prod-build:
# 	@echo "$(GREEN)🏗️  Сборка production образов...$(NC)"
# 	@$(DOCKER_COMPOSE) -f docker-compose.prod.yml build

# prod-up:
# 	@echo "$(GREEN)🚀 Запуск production...$(NC)"
# 	@$(DOCKER_COMPOSE) -f docker-compose.prod.yml up -d
