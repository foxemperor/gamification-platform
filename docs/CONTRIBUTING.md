# Руководство для нового разработчика
## Gamification Platform

> **Для кого этот документ:** если ты видишь этот репозиторий впервые и хочешь разобраться в проекте, запустить его локально или внести изменения — начни именно отсюда.

---

## 1. Что это за проект?

**Gamification Platform** — веб-система геймификации для мотивации сотрудников в распределённых командах. Сотрудники выполняют рабочие задачи, получают за них опыт (XP) и монеты, повышают уровень, зарабатывают бейджи и соревнуются в лидерборде.

Проект является **дипломным магистерским проектом** (апрель 2026, автор: Dmitry Koval) и построен на **микросервисной архитектуре**.

---

## 2. Быстрый старт (5 минут до рабочего стенда)

### Что нужно установить заранее

| Инструмент | Версия | Зачем |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | 24+ | Запуск бэкенда |
| [Node.js](https://nodejs.org) | 18+ LTS | Запуск фронтенда |
| [Git](https://git-scm.com) | любая | Работа с репозиторием |
| PowerShell | 5+ (Windows) | Скрипт `dev.ps1` |

### Первый запуск (Windows)

```powershell
# 1. Клонировать репозиторий
git clone https://github.com/foxemperor/gamification-platform.git
cd gamification-platform

# 2. Создать .env (автоматически из примера)
copy .env.example .env

# 3. Запустить бэкенд (Docker)
.\dev.ps1 up

# 4. Убедиться что всё поднялось
.\dev.ps1 health

# 5. Установить зависимости фронтенда
.\dev.ps1 ui:install

# 6. Запустить весь стек
.\dev.ps1 dev
```

После запуска доступны:

| Адрес | Что это |
|---|---|
| http://localhost:3000 | React-приложение (фронтенд) |
| http://localhost:8000 | API Gateway (единая точка входа) |
| http://localhost:8001/docs | Swagger UI — Auth Service |
| http://localhost:8002/docs | Swagger UI — Gamification Service |

### Первый запуск (Linux / macOS)

```bash
git clone https://github.com/foxemperor/gamification-platform.git
cd gamification-platform
cp .env.example .env
make up
make ui-install
make ui-dev    # в отдельном терминале
```

---

## 3. Структура репозитория

```
gamification-platform/
├── services/
│   ├── api-gateway/          # Порт 8000 — маршрутизатор, rate-limit, CORS
│   ├── auth-service/         # Порт 8001 — пользователи, JWT, bcrypt
│   ├── gamification-service/ # Порт 8002 — квесты, XP, бейджи, лидерборд
│   ├── analytics-service/    # Заглушка — не реализована
│   └── integration-service/  # Заглушка — не реализована
├── frontend/                 # React + TypeScript + Vite
│   └── src/
│       ├── api/              # HTTP-клиент (axios + перехватчики)
│       ├── components/       # UI-компоненты (auth/, ui/)
│       ├── hooks/            # Пользовательские хуки (useAuth, useToast)
│       ├── pages/            # Страницы (AuthPage, ...)
│       ├── store/            # Глобальное состояние (Zustand)
│       └── styles/           # Глобальные CSS-переменные и темы
├── shared/                   # Общие утилиты между сервисами
├── docs/                     # Вся документация проекта ← ты здесь
├── docker-compose.yml        # Описание всех контейнеров
├── Makefile                  # Команды для Linux/macOS
├── dev.ps1                   # Команды для Windows (PowerShell)
└── .env.example              # Шаблон переменных окружения
```

---

## 4. Как устроен бэкенд

### Принцип «единой точки входа»

Все HTTP-запросы от клиента идут **только на порт 8000** (API Gateway). Gateway проверяет rate-limit, логирует запрос и проксирует его нужному сервису:

```
Клиент → :8000 (API Gateway)
             ├── /api/v1/auth/*   → :8001 (Auth Service)
             ├── /api/v1/quests/* → :8002 (Gamification Service)
             └── /api/v1/events/* → Celery → Redis → Worker
```

Прямые запросы на `:8001` или `:8002` работают **только в development** и нужны только для Swagger UI.

### Как сервисы аутентифицируют пользователей

1. Клиент логинится через `POST /api/v1/auth/login` → получает `access_token` (30 мин) и `refresh_token` (7 дней)
2. Каждый последующий запрос содержит заголовок `Authorization: Bearer <access_token>`
3. **Auth Service** проверяет токен через `jwt.decode()` + SELECT из БД
4. **Gamification Service** проверяет токен через `jwt.decode()` **без обращения к БД** — только читает `user_id` из payload
5. При истечении `access_token` фронтенд автоматически делает `POST /api/v1/auth/refresh` → получает новую пару токенов

> ⚠️ Оба сервиса используют **один и тот же `SECRET_KEY`** из `.env`. Если ключи не совпадут — Gamification Service будет отклонять токены, выданные Auth Service.

### Где хранятся данные

Каждый сервис имеет **свою** базу данных — прямой SQL между сервисами запрещён:

| Сервис | База данных | Основные таблицы |
|---|---|---|
| Auth Service | `auth_db` | `users` |
| Gamification Service | `gamification_db` | `quests`, `user_quests`, `xp_transactions`, `badges`, `leaderboard_snapshots` |

Оба экземпляра PostgreSQL живут в **одном Docker-контейнере** `postgres` — это допустимо для разработки, в production их следует разделить.

---

## 5. Как устроен фронтенд

См. подробный документ: [`docs/frontend.md`](./frontend.md)

Краткая выжимка:
- **React 18** + **TypeScript** + **Vite** (сборщик)
- **Zustand** — глобальное состояние (auth-токены в памяти, тема)
- **Axios** — HTTP-клиент с перехватчиком 401 и авто-рефрешем
- **React Router v6** — маршрутизация
- **CSS Modules** + **CSS Custom Properties** — три темы без лишних зависимостей

---

## 6. Переменные окружения (.env)

Скопируй `.env.example` в `.env` и измени только то, что нужно:

```env
# === ОБЯЗАТЕЛЬНО СМЕНИТЬ В PRODUCTION ===
SECRET_KEY=your-super-secret-key-change-in-production
POSTGRES_PASSWORD=your-db-password

# === Auth Service ===
DATABASE_URL=postgresql+asyncpg://gamification_user:password@postgres:5432/auth_db
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# === Gamification Service ===
GAMIFICATION_DATABASE_URL=postgresql+asyncpg://gamification_user:password@postgres:5432/gamification_db
JWT_SECRET_KEY=your-super-secret-key-change-in-production  # ДОЛЖЕН совпадать с SECRET_KEY!

# === Redis / Celery ===
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# === Frontend (Vite) ===
VITE_API_URL=http://localhost:8000
```

> ❗ `SECRET_KEY` и `JWT_SECRET_KEY` должны быть **одинаковыми** — оба сервиса проверяют JWT одним ключом.

---

## 7. Все команды разработки

> 💡 Быструю справку прямо в терминале можно вызвать в любой момент:
> - **Windows:** `.\dev.ps1 help`
> - **Linux/macOS:** `make` или `make help`

### dev.ps1 (Windows)

#### Бэкенд (Docker)

```powershell
.\dev.ps1              # = .\dev.ps1 up — запустить бэкенд
.\dev.ps1 up           # Запустить все Docker-сервисы
.\dev.ps1 stop         # Остановить сервисы (контейнеры остаются)
.\dev.ps1 restart      # Перезапустить все сервисы
.\dev.ps1 restart auth-service   # Перезапустить конкретный сервис
.\dev.ps1 rebuild      # Пересобрать все образы без кэша
.\dev.ps1 rebuild auth-service   # Пересобрать один сервис
```

#### Фронтенд (Node.js / Vite)

```powershell
.\dev.ps1 ui:install   # npm install в ./frontend
.\dev.ps1 ui           # Запустить Vite dev-сервер → http://localhost:3000
.\dev.ps1 ui:build     # Production-сборка → frontend/dist/
.\dev.ps1 ui:open      # Открыть http://localhost:3000 в браузере
.\dev.ps1 dev          # Запустить бэкенд + фронтенд вместе (всё в одной команде)
```

#### Логи и мониторинг

```powershell
.\dev.ps1 logs                   # Логи всех сервисов (live)
.\dev.ps1 logs auth-service      # Логи одного сервиса
.\dev.ps1 health                 # HTTP health-check всех сервисов
```

#### База данных и утилиты

```powershell
.\dev.ps1 db           # Открыть psql (PostgreSQL CLI)
.\dev.ps1 open         # Открыть Swagger UI обоих сервисов в браузере
.\dev.ps1 test         # Автотест API (6 шагов: register → login → me → quests → profile → leaderboard)
.\dev.ps1 help         # Показать список всех команд
.\dev.ps1 clean        # ⚠️  Удалить контейнеры + volumes (уничтожит данные БД!)
```

---

### Makefile (Linux / macOS)

#### Бэкенд (Docker)

```bash
make up           # Запустить все Docker-сервисы
make down         # Остановить
make restart      # Перезапустить (= down + up)
make ps           # Статус всех контейнеров
```

#### Фронтенд (Node.js / Vite)

```bash
make ui-install   # npm install в ./frontend
make ui-dev       # Запустить Vite dev-сервер → http://localhost:3000
make ui-build     # Production-сборка → frontend/dist/
```

#### Логи

```bash
make logs                # Все логи (live)
make logs-api            # Логи API Gateway
make logs-auth           # Логи Auth Service
make logs-gamification   # Логи Gamification Service
```

#### База данных

```bash
make db-shell     # Открыть psql (PostgreSQL CLI)
make redis-shell  # Открыть Redis CLI
make init-db      # Инициализировать БД
make migrate      # Применить Alembic-миграции
```

#### Тестирование и качество кода

```bash
make test         # pytest
make test-cov     # pytest + HTML coverage report (htmlcov/index.html)
make lint         # flake8 + mypy
make format       # black + isort (авто-форматирование)
```

#### Разработка и очистка

```bash
make shell        # Bash внутри контейнера API Gateway
make install      # pip install локально (для IDE)
make clean        # Удалить __pycache__, .pyc, htmlcov...
make clean-all    # ⚠️  Удалить всё включая Docker volumes!
make help         # Показать список всех команд
```

---

## 8. Git-workflow и ветки

```
main          ← стабильные релизы, только через PR
develop       ← интеграционная ветка, сюда мержатся фичи
feature/xxx   ← новая функциональность
fix/xxx       ← исправление бага
chore/xxx     ← инфраструктура, документация, зависимости
```

### Как добавить новую функциональность

```bash
# 1. Создать ветку от develop
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# 2. Писать код...

# 3. Коммитить по Conventional Commits:
git commit -m "feat(gamification): add daily quest reset"
git commit -m "fix(auth): handle expired refresh token"
git commit -m "docs(api): update register endpoint description"

# 4. Создать PR в develop через GitHub
```

### Префиксы коммитов

| Префикс | Когда использовать |
|---|---|
| `feat` | Новая функция |
| `fix` | Исправление бага |
| `refactor` | Рефакторинг без изменения поведения |
| `docs` | Документация |
| `chore` | Зависимости, конфиги, CI |
| `test` | Тесты |
| `style` | Форматирование кода |

---

## 9. Как добавить новый API-эндпоинт

### Пример: добавить `GET /api/v1/quests/{id}` (получить квест по ID)

**Шаг 1 — Schema** (`services/gamification-service/app/schemas.py`):
```python
class QuestDetail(OrmBase):
    id: str
    title: str
    description: str
    xp_reward: int
    difficulty: str
    status: str
```

**Шаг 2 — Router** (`services/gamification-service/app/routers/quests.py`):
```python
@router.get("/{quest_id}", response_model=QuestDetail)
async def get_quest(
    quest_id: str,
    db: AsyncSession = Depends(get_db),
):
    quest = await db.get(Quest, quest_id)
    if not quest:
        raise HTTPException(status_code=404, detail="Квест не найден")
    return quest
```

**Шаг 3 — Gateway proxy** (`services/api-gateway/app/routers/quests.py`):
```python
# Новый эндпоинт автоматически проксируется, если Gateway
# использует wildcard-проксирование для /quests/*.
# Проверь конфиг app/config.py → GAMIFICATION_SERVICE_URL
```

**Шаг 4 — Frontend API-слой** (`frontend/src/api/gamification.ts`):
```typescript
export const gamificationApi = {
  getQuest: (id: string) =>
    api.get<QuestDetail>(`/quests/${id}`).then(r => r.data),
}
```

---

## 10. Как добавить новое поле в модель User

> ⚠️ Auth Service не использует Alembic — таблицы пересоздаются через `create_all()` при старте. В production нужны миграции!

**Шаг 1** — добавить поле в модель (`services/auth-service/app/models.py`):
```python
first_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
last_name:  Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
```

**Шаг 2** — добавить поле в схему (`services/auth-service/app/schemas.py`):
```python
class UserRegister(UserBase):
    first_name: Optional[str] = None
    last_name:  Optional[str] = None
    password: str = Field(..., min_length=8)
```

**Шаг 3** — обновить роутер (`services/auth-service/app/routers/auth.py`) — передать новые поля при создании User.

**Шаг 4** — пересобрать контейнер:
```powershell
# Windows
.\dev.ps1 rebuild auth-service

# Linux/macOS
make restart
```

---

## 11. Диагностика проблем

### Сервис не отвечает на health-check

```powershell
# 1. Проверить статус контейнеров
docker compose ps

# 2. Посмотреть логи упавшего сервиса
.\dev.ps1 logs auth-service      # Windows
make logs-auth                   # Linux/macOS

# 3. Частые причины:
# - PostgreSQL ещё не готов → подождать 5-10 секунд
# - Неверный DATABASE_URL в .env
# - Порт уже занят другим процессом
```

### Фронтенд не компилируется

```powershell
# Убедиться что Node.js установлен
node --version   # должно быть 18+
npm --version

# Переустановить зависимости
cd frontend
rm -rf node_modules
npm install

# Или через скрипт:
.\dev.ps1 ui:install   # Windows
make ui-install        # Linux/macOS
```

### JWT ошибка 401 от Gamification Service

```
Причина: SECRET_KEY в auth-service и JWT_SECRET_KEY в gamification-service не совпадают.
Решение: убедиться что оба ключа одинаковы в .env
```

### `npm` не найден в PowerShell

```powershell
# 1. Скачать Node.js с https://nodejs.org (LTS)
# 2. Установить с галочкой "Add to PATH"
# 3. Закрыть и открыть PowerShell заново
node --version
```

---

## 12. Что ещё не реализовано (TODO)

Список известных заглушек и незавершённых мест:

| Файл / место | Что нужно сделать | Приоритет |
|---|---|---|
| `auth/routers/auth.py` → `POST /logout` | Redis blacklist для инвалидации токенов | Высокий |
| `api-gateway/middleware/rate_limit.py` | Полная реализация через Redis (сейчас заглушка) | Средний |
| `gamification/routers/leaderboard.py` | Запрос в Auth Service для получения username (сейчас `player_xxxxxxxx`) | Средний |
| `auth/models.py` | Унифицировать формулу уровней с Power Law из gamification-service | Низкий |
| `analytics-service/` | Реализовать с нуля | Низкий |
| `integration-service/` | Webhooks GitHub/Jira → автоначисление XP | Низкий |
| `frontend/LoginForm.tsx` | Убрать toast-заглушку, подключить реальный API (после обновления Auth Service) | Высокий |
| Leaderboard | Кэшировать в Redis (сейчас N+2 запросов к БД) | Средний |
| Tests | pytest для всех сервисов | Средний |

---

## 13. Полезные ссылки

- [Репозиторий](https://github.com/foxemperor/gamification-platform)
- [FastAPI документация](https://fastapi.tiangolo.com)
- [SQLAlchemy 2.x async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [Zustand (state management)](https://zustand-demo.pmnd.rs)
- [Vite конфигурация](https://vitejs.dev/config/)
- [Feather Icons](https://feathericons.com)
- [Swagger UI Auth Service](http://localhost:8001/docs) *(только при запущенном стенде)*
- [Swagger UI Gamification Service](http://localhost:8002/docs) *(только при запущенном стенде)*

---

*Документ актуален для ветки `develop`, апрель 2026. Автор кода: Dmitry Koval.*
