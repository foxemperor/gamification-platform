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
git clone https://github.com/foxemperor/gamification-platform.git
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
docker compose up -d

# Проверка статуса
docker compose ps
```

#### 4. Инициализация базы данных

```bash
make init-db

# Или вручную:
docker compose exec api-gateway python /app/scripts/init_db.py
```

#### 5. Доступ к сервисам

| Сервис | URL | Статус |
|---|---|---|
| API Gateway | http://localhost:8000 | 🚧 В разработке |
| **Auth Service** | **http://localhost:8001** | ✅ Готов |
| Auth Service Swagger UI | http://localhost:8001/docs | ✅ Готов |
| PostgreSQL | localhost:5432 | ✅ Работает |
| Redis | localhost:6379 | ✅ Работает |
| Frontend | http://localhost:3000 | 🚧 В разработке |

---

## 📖 Работа со Swagger UI

Swagger UI — это интерактивная документация API, встроенная в каждый сервис. Она позволяет тестировать все эндпоинты прямо в браузере без сторонних инструментов (Postman, curl).

### Как открыть

После запуска сервиса откройте в браузере:
- **Auth Service**: http://localhost:8001/docs

### Как выполнить запрос

1. Нажмите на нужный эндпоинт (например, `POST /api/v1/auth/register`) — он раскроется
2. Нажмите кнопку **"Try it out"** справа
3. Заполните поле **Request body** своими данными (замените значения `"string"` на реальные)
4. Нажмите **"Execute"**
5. Результат появится в блоке **"Server response"** ниже

> ⚠️ **Важно:** не путайте блок **"Server response"** (реальный ответ сервера) с блоком **"Responses"** (это просто справочник возможных кодов ответа из документации).

### Как авторизоваться (для защищённых эндпоинтов)

1. Сначала выполните `POST /api/v1/auth/login` и скопируйте `access_token` из ответа
2. Нажмите кнопку **🔒 Authorize** в верхней части страницы
3. Вставьте токен в поле `Value` (только сам токен, без слова `bearer`)
4. Нажмите **Authorize** → **Close**
5. Теперь все запросы к защищённым эндпоинтам будут выполняться с вашим токеном

### Пример: регистрация нового пользователя

Откройте `POST /api/v1/auth/register`, нажмите **"Try it out"** и введите:

```json
{
  "email": "user@example.com",
  "username": "my_username",
  "password": "MyPass123",
  "full_name": "Иван Иванов"
}
```

Требования к паролю: минимум 8 символов, хотя бы одна заглавная буква и одна цифра.

Успешный ответ — **201 Created**:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "my_username",
    "xp": 0,
    "level": 1,
    "coins": 0,
    "xp_to_next_level": 100
  },
  "tokens": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "bearer"
  }
}
```

---

## 📦 Структура проекта

```
gamification-platform/
├── services/                    # Микросервисы
│   ├── api-gateway/            # Основной API Gateway
│   ├── auth-service/           # Сервис аутентификации ✅
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
cd services/auth-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
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
docker compose exec auth-service pytest

# С покрытием
docker compose exec auth-service pytest --cov=app --cov-report=html
```

---

## 📚 API Документация

После запуска сервисов доступна автоматическая документация:

| Сервис | Swagger UI | ReDoc |
|---|---|---|
| Auth Service | http://localhost:8001/docs | http://localhost:8001/redoc |
| Gamification Service | http://localhost:8002/docs | http://localhost:8002/redoc |
| API Gateway | http://localhost:8000/docs | http://localhost:8000/redoc |

### Эндпоинты Auth Service ✅

```
POST   /api/v1/auth/register    # Регистрация нового пользователя
POST   /api/v1/auth/login       # Вход, получение токенов
GET    /api/v1/auth/me          # Данные текущего пользователя
PATCH  /api/v1/auth/me          # Обновление профиля
POST   /api/v1/auth/refresh     # Обновление access токена
POST   /api/v1/auth/logout      # Выход
GET    /health                  # Проверка доступности сервиса
```

### Эндпоинты (планируются)

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
GET    /api/v1/leaderboard/xp        # Топ по XP
GET    /api/v1/leaderboard/coins     # Топ по монетам
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
- **Health checks**: `/health` эндпоинт на каждом сервисе

---

## 🚢 Деплой

### Production (Docker Compose)

```bash
# На сервере
docker compose -f docker-compose.prod.yml up -d

# С Nginx SSL
docker compose -f docker-compose.prod.yml --profile nginx up -d
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
- [x] Auth Service (регистрация, JWT, профиль)
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

Последнее обновление: 20.04.2026
