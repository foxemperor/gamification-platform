-- Gamification Platform — PostgreSQL initialization
-- Создание расширений и базовая настройка
-- Схемы auth и gamification создаются через Alembic миграции при старте сервисов

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
