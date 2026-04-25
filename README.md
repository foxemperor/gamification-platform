# 🎮 Gamification Platform для распределённых команд

**Дипломный проект магистра** по теме: *«Разработка web-системы геймификации мотивации в распределённых командах»*

- **Автор**: Коваль Дмитрий Игоревич
- **Руководитель**: Трофимов Виктор Маратович
- **Университет**: Кубанский государственный технологический университет
- **Год**: 2026

---

## 📋 Описание проекта

Универсальная платформа геймификации для повышения мотивации и вовлечённости сотрудников распределённых команд. Система реализует механики квестов, XP, монет, бейджей и таблиц лидеров через API-first микросервисную архитектуру, что обеспечивает масштабируемость и независимость от конкретной компании или инструментарного стека.

### 🎯 Ключевые возможности

- **Система квестов**: персональные, командные, скилловые задания с принятием и завершением
- **Система прогрессии**: уровни, опыт (XP по Power Law), монеты, бейджи
- **Таблицы лидеров**: недельные, месячные, за всё время
- **Ролевая модель**: Admin, Manager, Employee — гибкое управление правами
- **No-code Quest Builder**: создание квестов через UI без программирования *(в разработке)*
- **Real-time обновления**: WebSocket для мгновенных уведомлений *(в разработке)*
- **Аналитика**: метрики вовлечённости, история XP *(в разработке)*

---

## ✅ Текущий статус (апрель 2026)

| Компонент | Статус | Описание |
|---|---|---|
| 🏗️ Архитектура и UML-диаграммы | ✅ Готово | ERD, Deployment, Use Case, Sequence, Class, Activity |
| 🗄️ PostgreSQL схема | ✅ Готово | init.sql, все таблицы, индексы |
| 🔴 Redis | ✅ Работает | Брокер для Celery |
| 🚪 API Gateway | ✅ Работает | FastAPI, health check, маршрутизация |
| 🔐 Auth Service | ✅ Полностью готов | JWT, регистрация, логин, refresh, `/me` |
| 🎮 Gamification Service | ✅ Полностью готов | Квесты, XP, бейджи, лидерборды, Celery |
| 🎨 Frontend (React) | 🚧 В разработке | — |
| 📡 Event Service | 📅 Запланировано | Регистрация рабочих событий (смены, тренинги) |
| 📊 Analytics Service | 📅 Запланировано | Агрегация метрик, engagement score |

---

## 🏗️ Архитектура

### Технологический стек

**Backend:**
- Python 3.11+
- FastAPI (RESTful API + WebSocket)
- PostgreSQL 16 (основная БД)
- Redis 7 (кэш + брокер задач)
- Celery (асинхронные задачи)
- SQLAlchemy (ORM)
- Pydantic v2 (валидация данных)

**Frontend** *(в разработке)*:
- React 18 + TypeScript
- Material-UI 5
- Redux Toolkit
- Axios

**Infrastructure:**
- Docker + Docker Compose
- Nginx (reverse proxy)
- GitHub Actions (CI/CD — планируется)

### Микросервисная архитектура

```
┌─────────────────────────────────────────────────────┐
│                    API Gateway :8000                │
│              (маршрутизация, auth proxy)            │
└──────┬────────────────────────────┬─────────────────┘
       │                            │
┌──────▼──────────┐     ┌───────────▼──────────────┐
│  Auth Service   │     │  Gamification Service    │
│    :8001  ✅    │     │        :8002  ✅          │
│  JWT, bcrypt    │     │  Квесты, XP, Бейджи,     │
│  Пользователи   │     │  Лидерборды, Celery      │
└─────────────────┘     └──────────────────────────┘
       │                            │
       └────────────┬───────────────┘
                    │
         ┌──────────▼──────────┐
         │  PostgreSQL :5432   │  Redis :6379
         │    (общая БД) ✅    │  (брокер) ✅
         └─────────────────────┘
```

Сервисы взаимодействуют через:
- **HTTP REST API** — синхронные запросы между сервисами
- **Redis Pub/Sub + Celery** — асинхронные задачи (начисление XP, рассылка уведомлений)
- **Shared PostgreSQL** — общая база данных (shared database pattern для MVP)

---

## 🚀 Тестовый запуск проекта

### Предварительные требования

| Инструмент | Минимальная версия | Проверка |
|---|---|---|
| Docker | 24.0+ | `docker --version` |
| Docker Compose | 2.20+ | `docker compose version` |
| Git | 2.40+ | `git --version` |

> 💡 **Python и Node.js не нужны** для запуска через Docker.

### Шаг 1 — Клонирование репозитория

```bash
git clone https://github.com/foxemperor/gamification-platform.git
cd gamification-platform
```

### Шаг 2 — Настройка переменных окружения

```bash
cp .env.example .env
```

> Для тестового запуска значения в `.env.example` уже подходят. Менять ничего не нужно.

### Шаг 3 — Запуск всех сервисов

```bash
docker compose up -d
```

Первый запуск занимает 2–3 минуты (загрузка образов). При повторных запусках — значительно быстрее.

### Шаг 4 — Проверка статуса

```bash
docker compose ps
```

Все сервисы должны иметь статус `healthy` или `running`:

```
NAME                    STATUS          PORTS
gamification-postgres   running         0.0.0.0:5432->5432/tcp
gamification-redis      running         0.0.0.0:6379->6379/tcp
gamification-gateway    running         0.0.0.0:8000->8000/tcp
gamification-auth       running (healthy) 0.0.0.0:8001->8001/tcp
gamification-service    running (healthy) 0.0.0.0:8002->8002/tcp
```

### Шаг 5 — Открытие Swagger UI

После успешного запуска откройте в браузере:

| Сервис | URL |
|---|---|
| 🔐 Auth Service API | http://localhost:8001/docs |
| 🎮 Gamification Service API | http://localhost:8002/docs |
| 🚪 API Gateway | http://localhost:8000/docs |

---

## 🧪 Полный тестовый сценарий (шаг за шагом)

Следующий сценарий позволяет проверить работу всей системы в браузере без Postman или curl.

### 1. Регистрация пользователя

Откройте http://localhost:8001/docs → `POST /api/v1/auth/register` → **Try it out**:

```json
{
  "email": "demo@example.com",
  "username": "demo_user",
  "password": "Demo1234",
  "full_name": "Дмитрий Демо"
}
```

Ожидаемый ответ: **201 Created** с объектом пользователя и токенами.

### 2. Вход в систему

`POST /api/v1/auth/login`:

```json
{
  "email": "demo@example.com",
  "password": "Demo1234"
}
```

Скопируйте `access_token` из ответа.

### 3. Авторизация в Swagger

Нажмите **🔒 Authorize** (верхний правый угол) → вставьте `access_token` → **Authorize**.

### 4. Просмотр профиля

`GET /api/v1/auth/me` → **Try it out** → **Execute**.

Ответ содержит: `xp`, `level`, `coins`, `xp_to_next_level`.

### 5. Работа с квестами

Перейдите на http://localhost:8002/docs (Gamification Service):

```
GET  /api/v1/quests              → список доступных квестов
POST /api/v1/quests/{id}/accept  → принять квест
POST /api/v1/quests/{id}/complete → завершить и получить XP
GET  /api/v1/leaderboard         → таблица лидеров
GET  /api/v1/profile/me          → профиль с бейджами и историей XP
```

> ⚠️ Авторизацию нужно выполнить отдельно в Swagger каждого сервиса (вставить тот же `access_token`).

---

## 🛠️ Полезные команды

### PowerShell (Windows)

```powershell
.\dev.ps1 health    # Проверить состояние всех сервисов
.\dev.ps1 test      # Запустить тесты
.\dev.ps1 logs      # Просмотр логов
.\dev.ps1 restart   # Перезапустить сервисы
.\dev.ps1 open      # Открыть Swagger UI в браузере
.\dev.ps1 db        # Подключиться к PostgreSQL
.\dev.ps1 rebuild   # Пересобрать образы
.\dev.ps1 clean     # Полная очистка (контейнеры + тома)
```

### Make (Linux/macOS)

```bash
make up          # Запустить все сервисы
make down        # Остановить все сервисы
make logs        # Просмотр логов
make init-db     # Инициализация БД
make test        # Запустить тесты
make lint        # Проверка кода (flake8, black)
make format      # Форматирование кода
make clean       # Очистка временных файлов
```

---

## 📦 Структура проекта

```
gamification-platform/
├── services/
│   ├── api-gateway/          # API Gateway (FastAPI) ✅
│   ├── auth-service/         # Сервис аутентификации ✅
│   └── gamification-service/ # Ядро геймификации ✅
├── shared/                   # Общие модели и утилиты
├── infrastructure/           # Nginx, PostgreSQL, Redis конфиги
├── scripts/                  # Скрипты инициализации БД
├── docs/                     # UML-диаграммы, схемы
├── frontend/                 # React приложение 🚧
├── .env.example              # Шаблон переменных окружения
├── docker-compose.yml        # Оркестрация сервисов
├── Makefile                  # Утилиты сборки (Linux/macOS)
└── dev.ps1                   # Утилиты сборки (Windows PowerShell)
```

---

## 📚 API Документация

### Auth Service ✅ `localhost:8001`

```
POST  /api/v1/auth/register   # Регистрация нового пользователя
POST  /api/v1/auth/login      # Вход, получение JWT токенов
GET   /api/v1/auth/me         # Данные текущего пользователя
PATCH /api/v1/auth/me         # Обновление профиля
POST  /api/v1/auth/refresh    # Обновление access токена
POST  /api/v1/auth/logout     # Выход из системы
GET   /health                 # Проверка доступности сервиса
```

### Gamification Service ✅ `localhost:8002`

```
GET   /api/v1/quests                   # Список квестов
POST  /api/v1/quests                   # Создать квест (Admin/Manager)
GET   /api/v1/quests/{id}              # Детали квеста
POST  /api/v1/quests/{id}/accept       # Принять квест
POST  /api/v1/quests/{id}/complete     # Завершить квест (+XP, +Coins)

GET   /api/v1/profile/me               # Профиль: XP, уровень, бейджи
GET   /api/v1/profile/xp-history       # История начислений XP

GET   /api/v1/leaderboard              # Общий лидерборд
GET   /api/v1/leaderboard?period=week  # Недельный рейтинг
GET   /api/v1/leaderboard?period=month # Месячный рейтинг

GET   /health                          # Проверка доступности сервиса
```

---

## 🗂️ Ролевая модель

| Роль | Регистрация пользователей | Создание квестов | Назначение бейджей | Просмотр лидерборда |
|---|---|---|---|---|
| **Admin** | ✅ Полный доступ | ✅ | ✅ | ✅ |
| **Manager** | ✅ Управление своей командой | ✅ Для своей команды | ✅ Для своей команды | ✅ |
| **Employee** | ❌ | ❌ | ❌ | ✅ |

---

## 🔐 Безопасность

- **JWT токены** — access (15 мин) + refresh (7 дней)
- **Bcrypt** — хэширование паролей с солью
- **CORS** — настроен для разрешённых origin
- **Rate limiting** — защита на критических эндпоинтах
- **SQLAlchemy ORM** — защита от SQL-инъекций
- **Pydantic v2** — строгая валидация всех входящих данных

---

## 🗓️ Roadmap

### Этап 1: Инфраструктура и ядро ✅ *Март 2026*
- [x] Архитектура проекта и UML-диаграммы
- [x] Docker Compose инфраструктура (PostgreSQL, Redis)
- [x] API Gateway
- [x] Auth Service (JWT, регистрация, профиль)
- [x] Gamification Service (квесты, XP Power Law, бейджи, лидерборды)
- [x] Celery + Redis для асинхронных задач
- [x] PowerShell / Makefile dev-утилиты

### Этап 2: Frontend *Апрель–Май 2026* 🚧
- [ ] React 18 + TypeScript приложение
- [ ] Страница входа / регистрации
- [ ] Дашборд: XP, уровень, прогресс-бар
- [ ] Страница квестов (принять / завершить)
- [ ] Таблица лидеров
- [ ] Профиль пользователя с бейджами

### Этап 3: Event Service *Май 2026* 📅
- [ ] Регистрация рабочих событий (смены, тренинги, мероприятия)
- [ ] Автоматическое начисление XP через Celery
- [ ] Менеджерский UI для управления событиями

### Этап 4: Финализация *Май–Июнь 2026* 📅
- [ ] Unit + Integration тесты
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Analytics Service (engagement score, метрики)
- [ ] Нагрузочное тестирование
- [ ] Документация для защиты диплома

---

## 📊 Мониторинг и логирование

- **Логи**: структурированный JSON-формат через `logging`
- **Health checks**: эндпоинт `/health` на каждом сервисе
- **Metrics**: Prometheus + Grafana *(планируется)*

---

**Статус проекта**: 🚧 В активной разработке

Последнее обновление: 25.04.2026
