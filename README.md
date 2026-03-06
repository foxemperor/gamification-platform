# 🎮 Gamification Platform для распределённых команд

**Дипломный проект магистра** по теме: *"Разработка web-системы геймификации мотивации в распределённых командах"*

---

## 📋 Описание проекта

Платформа для повышения мотивации и вовлечённости сотрудников распределённых IT-команд через механики геймификации: квесты, баллы опыта (XP), монеты, бейджи, таблицы лидеров и интеграции с рабочими инструментами (GitHub, Jira, Slack).

### 🎯 Основные возможности

- **Система квестов**: персональные, командные, скилловые задания
- **Система прогрессии**: уровни, опыт (XP), монеты, бейджи
- **Таблицы лидеров**: индивидуальные и командные рейтинги
- **Интеграции**: GitHub (commits, PR), Jira (задачи), Slack (уведомления)
- **No-code Quest Builder**: создание квестов без программирования
- **Real-time обновления**: WebSocket для мгновенных уведомлений
- **Аналитика**: метрики вовлечённости, ROI, engagement score

---

## 🏗️ Архитектура

### Технологический стек

**Backend:**
- Python 3.11+
- FastAPI (RESTful API + WebSocket)
- PostgreSQL 16 (основная БД)
- Redis 7 (кэш + очереди задач)
- Celery (асинхронные задачи)
- SQLAlchemy (ORM)
- Pydantic (валидация)

**Frontend:**
- React 18 + TypeScript
- Material-UI 5
- Redux Toolkit
- Axios

**Infrastructure:**
- Docker + Docker Compose
- Nginx (reverse proxy)
- GitHub Actions (CI/CD)

### Микросервисная архитектура

```
├── API Gateway          # Точка входа, маршрутизация запросов
├── Auth Service         # Аутентификация и авторизация (JWT)
├── Gamification Service # Ядро: квесты, XP, бейджи, лидерборды
├── Integration Service  # GitHub, Jira, Slack webhooks
└── Analytics Service    # Метрики, отчёты, аналитика
```

Сервисы взаимодействуют через:
- **HTTP REST API** (синхронные запросы)
- **Redis Pub/Sub** (асинхронные события)
- **Общая БД PostgreSQL** (shared database pattern для MVP)

---

## 🚀 Быстрый старт

### Предварительные требования

- Docker 24.0+
- Docker Compose 2.20+
- Git 2.40+
- Python 3.11+ (для локальной разработки)
- Node.js 18+ (для frontend)

### Установка и запуск

#### 1. Клонирование репозитория

```bash
git clone https://github.com/YOUR_USERNAME/gamification-platform.git
cd gamification-platform
```

#### 2. Настройка переменных окружения

```bash
cp .env.example .env
# Отредактируйте .env файл, добавьте необходимые токены
```

#### 3. Запуск через Docker Compose

```bash
# Запуск всех сервисов
make up

# Или вручную:
docker-compose up -d

# Проверка статуса
docker-compose ps
```

#### 4. Инициализация базы данных

```bash
make init-db

# Или вручную:
docker-compose exec api-gateway python /app/scripts/init_db.py
```

#### 5. Доступ к сервисам

- **API Gateway**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Frontend** (после запуска): http://localhost:3000

---

## 📦 Структура проекта

```
gamification-platform/
├── services/                    # Микросервисы
│   ├── api-gateway/            # Основной API Gateway
│   ├── auth-service/           # Сервис аутентификации
│   ├── gamification-service/   # Ядро геймификации
│   ├── integration-service/    # Внешние интеграции
│   └── analytics-service/      # Аналитика
├── shared/                     # Общий код (models, utils)
├── infrastructure/             # Nginx, PostgreSQL, Redis конфиги
├── scripts/                    # Скрипты инициализации
├── docs/                       # Документация
├── frontend/                   # React приложение
└── docker-compose.yml          # Оркестрация сервисов
```

---

## 🛠️ Полезные команды (Makefile)

```bash
make up              # Запустить все сервисы
make down            # Остановить все сервисы
make logs            # Просмотр логов
make init-db         # Инициализация БД
make migrate         # Применить миграции
make test            # Запустить тесты
make lint            # Проверка кода (flake8, black)
make format          # Форматирование кода
make clean           # Очистка временных файлов
```

---

## 🧪 Разработка

### Локальная разработка без Docker

#### Backend

```bash
cd services/api-gateway
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm start
```

### Тестирование

```bash
# Все тесты
make test

# Конкретный сервис
docker-compose exec api-gateway pytest

# С покрытием
docker-compose exec api-gateway pytest --cov=app --cov-report=html
```

---

## 📚 API Документация

После запуска сервисов доступна автоматическая документация:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

### Основные эндпоинты

#### Аутентификация
```
POST   /api/v1/auth/register       # Регистрация
POST   /api/v1/auth/login          # Вход
POST   /api/v1/auth/refresh        # Обновление токена
```

#### Пользователи
```
GET    /api/v1/users/me            # Текущий пользователь
GET    /api/v1/users/{id}          # Профиль пользователя
PATCH  /api/v1/users/me            # Обновление профиля
```

#### Квесты
```
GET    /api/v1/quests              # Список квестов
POST   /api/v1/quests              # Создать квест
GET    /api/v1/quests/{id}         # Детали квеста
POST   /api/v1/quests/{id}/accept  # Принять квест
POST   /api/v1/quests/{id}/complete # Завершить квест
```

#### Лидерборды
```
GET    /api/v1/leaderboard/xp      # Топ по XP
GET    /api/v1/leaderboard/coins   # Топ по монетам
GET    /api/v1/leaderboard/team/{id} # Командный рейтинг
```

---

## 🔐 Безопасность

- **JWT токены** для аутентификации (access + refresh)
- **Bcrypt** для хэширования паролей
- **CORS** настроен для production домена
- **Rate limiting** на критических эндпоинтах
- **SQL Injection защита** через SQLAlchemy ORM
- **XSS защита** через Pydantic валидацию
- **HTTPS only** в production (Nginx + Let's Encrypt)

---

## 🌐 Интеграции

### GitHub
- Webhook на push, PR, issues
- Автоматическое начисление XP за коммиты
- Квесты на основе активности в репозиториях

### Jira
- OAuth 2.0 авторизация
- Синхронизация задач → квесты
- Начисление XP за закрытие тикетов

### Slack
- Бот для уведомлений
- Команды для проверки прогресса
- Real-time оповещения о достижениях

---

## 📊 Мониторинг и логирование

- **Логи**: структурированный JSON формат
- **Metrics**: Prometheus + Grafana (планируется)
- **Health checks**: `/health` и `/readiness` эндпоинты

---

## 🚢 Деплой

### Production (Docker Compose)

```bash
# На сервере
docker-compose -f docker-compose.prod.yml up -d

# С Nginx SSL
docker-compose -f docker-compose.prod.yml --profile nginx up -d
```

### Kubernetes (планируется)

Helm chart для деплоя в K8s кластер.

---

## 🧑‍💻 Команда разработки

- **Автор**: Коваль Дмитрий Игоревич
- **Руководитель**: [Имя научного руководителя]
- **Университет**: [Название вуза]
- **Год**: 2026

---

## 📄 Лицензия

Этот проект создан в образовательных целях как дипломная работа магистра.

---

## 📧 Контакты

- **Email**: [ваш email]
- **Telegram**: [ваш телеграм]
- **GitHub**: [ваш GitHub профиль]

---

## 🗓️ Roadmap

### Этап 1: MVP (Март 2026)
- [x] Архитектура проекта
- [x] API Gateway
- [ ] Auth Service
- [ ] Gamification Service (базовые квесты, XP)
- [ ] PostgreSQL схема
- [ ] Базовый Frontend

### Этап 2: Интеграции (Апрель 2026)
- [ ] GitHub webhooks
- [ ] Jira OAuth
- [ ] Slack bot
- [ ] Celery задачи

### Этап 3: Продвинутые фичи (Май 2026)
- [ ] WebSocket real-time
- [ ] No-code Quest Builder
- [ ] Analytics Dashboard
- [ ] Unit + Integration тесты

### Этап 4: Production (Май-Июнь 2026)
- [ ] CI/CD pipeline
- [ ] Kubernetes деплой
- [ ] Мониторинг (Prometheus/Grafana)
- [ ] Нагрузочное тестирование
- [ ] Документация для защиты

---

**Статус проекта**: 🚧 В разработке (MVP)

Последнее обновление: 06.03.2026
