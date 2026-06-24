"""
Seed-скрипт: создаёт тестовые данные для демонстрации платформы.

Создаёт:
  - Архетипы персонажей (4 шт.)
  - Бейджи (7 шт. с реальными condition_type)
  - Квесты (8 шт., разные типы/сложность)
  - 14 тестовых пользователей в auth-сервисе (российские ФИО, bio, avatar, birthday)
  - Иерархия: carol_pm (Head) → dan_devops / artem_security (Team Leads)
               dan_devops  → alice, bob, natasha, ruslan, polina, maxim
               artem_security → igor, anna, eva
  - Персонаж (Character) + экипировка (CharacterEquipment) для каждого пользователя
  - Разблокированная косметика (UnlockedCosmetic)
  - Назначение квестов / бейджей
  - XP-транзакции и Coin-транзакции
  - Снапшот лидерборда (период "all_time")

Запуск изнутри контейнера gamification-service:
    python seed_demo.py [--devuser-id UUID]

Автор: Dmitry Koval
"""

import argparse
import asyncio
import os
import random
import sys
import uuid as _uuid_mod
from datetime import date

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# ---- настройки ----
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://gamification_user:change_me_secure_password@postgres:5432/gamification_db",
)
AUTH_DB_SCHEMA = "auth"

sys.path.insert(0, os.path.dirname(__file__))
from app.models import (
    Badge, BadgeRarity, Quest, QuestDifficulty, QuestStatus, QuestType,
    UserBadge, UserQuest, UserQuestStatus,
    CharacterType, CharacterTypeSlug,
    Character, CharacterEquipment,
    CosmeticItem, CosmeticSlot, CosmeticVisibility, UnlockType,
    UnlockedCosmetic,
    XPTransaction, XPSource,
    CoinTransaction, CoinSource,
    LeaderboardSnapshot,
)
from app.database import DB_SCHEMA

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ================================================================
# ХЕШИРОВАНИЕ ПАРОЛЕЙ
# ================================================================

def hash_password(pwd: str) -> str:
    import bcrypt
    return bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def parse_date(s: str) -> date:
    """Конвертирует строку 'YYYY-MM-DD' в объект datetime.date."""
    y, m, d = s.split("-")
    return date(int(y), int(m), int(d))


# ================================================================
# АРХЕТИПЫ ПЕРСОНАЖЕЙ
# ================================================================

async def seed_character_types(db: AsyncSession) -> None:
    character_types_data = [
        {
            "slug": CharacterTypeSlug.WARRIOR,
            "name": "Воин",
            "description": "Мощный и стойкий боец ближнего боя. +20% монет за сложные квесты.",
            "icon_url": "⚔️",
            "coin_multiplier_base": 1.2,
            "xp_multiplier_base": 1.0,
            "bonus_description": "+20% монет за выполнение квестов",
        },
        {
            "slug": CharacterTypeSlug.MAGE,
            "name": "Маг",
            "description": "Искусный заклинатель, черпающий силу из знаний. +20% XP за любые действия.",
            "icon_url": "🧙",
            "coin_multiplier_base": 1.0,
            "xp_multiplier_base": 1.2,
            "bonus_description": "+20% XP за все действия",
        },
        {
            "slug": CharacterTypeSlug.ROGUE,
            "name": "Плут",
            "description": "Быстрый авантюрист. +10% XP и +10% монет, двойной бонус за daily-квесты.",
            "icon_url": "🗡️",
            "coin_multiplier_base": 1.1,
            "xp_multiplier_base": 1.1,
            "bonus_description": "+10% XP и +10% монет, двойной бонус за daily-квесты",
        },
        {
            "slug": CharacterTypeSlug.ENGINEER,
            "name": "Инженер",
            "description": "Мастер технологий. +15% XP за интеграционные квесты (GitHub, Jira).",
            "icon_url": "🔧",
            "coin_multiplier_base": 1.0,
            "xp_multiplier_base": 1.15,
            "bonus_description": "+15% XP за интеграционные квесты",
        },
    ]
    for ct_data in character_types_data:
        existing = await db.scalar(select(CharacterType).where(CharacterType.slug == ct_data["slug"]))
        if existing:
            print(f"  ℹ️  Архетип '{ct_data['name']}' уже есть")
        else:
            db.add(CharacterType(**ct_data))
            print(f"  ✅ Архетип создан: {ct_data['name']}")
    await db.flush()


# ================================================================
# КОСМЕТИЧЕСКИЕ ПРЕДМЕТЫ (ИНВЕНТАРЬ)
# ================================================================

COSMETICS_DATA = [
    # ── Открытые базовые предметы (доступны всем сразу) ──
    {
        "slug": "hair_short_basic", "name": "Короткая стрижка",
        "description": "Аккуратная короткая причёска на каждый день.",
        "slot": CosmeticSlot.HAIR, "rarity": BadgeRarity.COMMON,
        "visibility": CosmeticVisibility.OPEN, "unlock_type": UnlockType.NONE,
    },
    {
        "slug": "hair_long_basic", "name": "Длинные волосы",
        "description": "Свободные длинные волосы.",
        "slot": CosmeticSlot.HAIR, "rarity": BadgeRarity.COMMON,
        "visibility": CosmeticVisibility.OPEN, "unlock_type": UnlockType.NONE,
    },
    {
        "slug": "torso_tshirt", "name": "Базовая футболка",
        "description": "Простая удобная футболка.",
        "slot": CosmeticSlot.TORSO, "rarity": BadgeRarity.COMMON,
        "visibility": CosmeticVisibility.OPEN, "unlock_type": UnlockType.NONE,
    },
    {
        "slug": "torso_hoodie", "name": "Худи разработчика",
        "description": "Уютное худи для долгих код-сессий.",
        "slot": CosmeticSlot.TORSO, "rarity": BadgeRarity.RARE,
        "visibility": CosmeticVisibility.OPEN, "unlock_type": UnlockType.NONE,
    },
    {
        "slug": "eyes_calm", "name": "Спокойный взгляд",
        "description": "Уверенный и спокойный взгляд.",
        "slot": CosmeticSlot.EYES, "rarity": BadgeRarity.COMMON,
        "visibility": CosmeticVisibility.OPEN, "unlock_type": UnlockType.NONE,
    },

    # ── Закрытые: разблокируются по уровню персонажа (LEVEL) ──
    {
        "slug": "head_crown", "name": "Корона лидера",
        "description": "Золотая корона для истинных лидеров команды.",
        "slot": CosmeticSlot.HEAD, "rarity": BadgeRarity.EPIC,
        "visibility": CosmeticVisibility.LOCKED, "unlock_type": UnlockType.LEVEL,
        "unlock_value": 5,
    },
    {
        "slug": "head_acc_glasses", "name": "Умные очки",
        "description": "Стильные очки для фокусировки.",
        "slot": CosmeticSlot.HEAD_ACCESSORY, "rarity": BadgeRarity.RARE,
        "visibility": CosmeticVisibility.LOCKED, "unlock_type": UnlockType.LEVEL,
        "unlock_value": 3,
    },

    # ── Закрытые: разблокируются за количество квестов (QUEST) ──
    {
        "slug": "weapon_main_sword", "name": "Клинок ветерана",
        "description": "Острый меч для тех, кто прошёл множество испытаний.",
        "slot": CosmeticSlot.WEAPON_MAIN, "rarity": BadgeRarity.EPIC,
        "visibility": CosmeticVisibility.LOCKED, "unlock_type": UnlockType.QUEST,
        "unlock_value": 5,
    },
    {
        "slug": "weapon_sec_shield", "name": "Щит защитника",
        "description": "Надёжный щит, полученный за упорство.",
        "slot": CosmeticSlot.WEAPON_SECONDARY, "rarity": BadgeRarity.RARE,
        "visibility": CosmeticVisibility.LOCKED, "unlock_type": UnlockType.QUEST,
        "unlock_value": 3,
    },

    # ── Закрытые: разблокируются за достижение (ACHIEVEMENT) ──
    {
        "slug": "torso_acc_cape", "name": "Плащ легенды",
        "description": "Эпичный плащ для обладателей легендарных наград.",
        "slot": CosmeticSlot.TORSO_ACCESSORY, "rarity": BadgeRarity.LEGENDARY,
        "visibility": CosmeticVisibility.LOCKED, "unlock_type": UnlockType.ACHIEVEMENT,
        "unlock_badge_name": "Мастер квестов",
    },
]


async def seed_cosmetics(db: AsyncSession) -> None:
    for c in COSMETICS_DATA:
        existing = await db.scalar(select(CosmeticItem).where(CosmeticItem.slug == c["slug"]))
        if existing:
            print(f"  ℹ️  Предмет '{c['name']}' уже есть")
            continue
        data = dict(c)
        badge_name = data.pop("unlock_badge_name", None)
        unlock_ref = None
        if badge_name:
            badge = await db.scalar(select(Badge).where(Badge.name == badge_name))
            if badge:
                unlock_ref = badge.id
            else:
                print(f"  ⚠️  Бейдж '{badge_name}' не найден для предмета '{c['name']}'")
        db.add(CosmeticItem(unlock_ref=unlock_ref, **data))
        print(f"  ✅ Предмет создан: {c['name']} [{c['slot'].value} / {c['visibility'].value}]")
    await db.flush()


# ================================================================
# ТЕСТОВЫЕ ПОЛЬЗОВАТЕЛИ
#
# Иерархия:
#   carol_pm        — Head / PM (менеджер лидов)
#   ├── dan_devops  — Tech Lead  (менеджер разработчиков)
#   │   ├── alice_dev
#   │   ├── bob_backend
#   │   ├── natasha_fullstack
#   │   ├── ruslan_ios
#   │   ├── polina_design
#   │   └── maxim_android
#   └── artem_security — Security Lead (менеджер смежных специалистов)
#       ├── igor_ml
#       ├── anna_analytics
#       └── eva_qa
#
# Аватары: DiceBear Avataaars (бесплатный CDN, без авторизации)
# ================================================================

TEST_USERS = [
    # ── Уровень 0: Head PM ──
    {
        "username": "carol_pm",
        "email": "carol@test.com",
        "password": "TestPass123!",
        "full_name": "Каролина Мартынова",
        "birthday": "1989-03-15",
        "department": "Управление проектами",
        "project": "Внутренние инструменты",
        "position": "Руководитель разработки",
        "role": "manager",
        "xp": 870,
        "level": 6,
        "coins": 110,
        "manager_username": None,           # самый верхний уровень
        "bio": "Опытный PM с 10-летним стажем в IT-командах. Фанат Scrum и прозрачных процессов. Обожаю, когда команда достигает целей sprint'а на 100%.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=carol_pm&backgroundColor=b6e3f4",
        "character_slug": CharacterTypeSlug.WARRIOR,
        "equipped_items": ["hair_long_basic", "torso_hoodie", "eyes_calm"],
        "unlocked_items": ["hair_long_basic", "hair_short_basic", "torso_hoodie", "torso_tshirt", "eyes_calm", "head_acc_glasses"],
    },

    # ── Уровень 1: Team Leads (manager_username = carol_pm) ──
    {
        "username": "dan_devops",
        "email": "dan@test.com",
        "password": "TestPass123!",
        "full_name": "Даниил Григорьев",
        "birthday": "1993-05-30",
        "department": "Инфраструктура",
        "project": "Платформа геймификации",
        "position": "Tech Lead / DevOps",
        "role": "manager",
        "xp": 450,
        "level": 4,
        "coins": 60,
        "manager_username": "carol_pm",
        "bio": "Kubernetes, Docker, Terraform — мой рабочий инструментарий. Строю надёжные CI/CD пайплайны и сплю спокойно, зная, что мониторинг всё поймает.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=dan_devops&backgroundColor=d1d4f9",
        "character_slug": CharacterTypeSlug.ENGINEER,
        "equipped_items": ["hair_short_basic", "torso_tshirt", "eyes_calm"],
        "unlocked_items": ["hair_short_basic", "torso_tshirt", "eyes_calm", "head_acc_glasses"],
    },
    {
        "username": "artem_security",
        "email": "artem@test.com",
        "password": "TestPass123!",
        "full_name": "Артём Кузнецов",
        "birthday": "1988-08-19",
        "department": "Безопасность",
        "project": "Внутренние инструменты",
        "position": "Security Lead",
        "role": "manager",
        "xp": 1050,
        "level": 8,
        "coins": 145,
        "manager_username": "carol_pm",
        "bio": "Пентестер и специалист по ИБ. Нахожу уязвимости раньше злоумышленников. Сертифицированный CEH, OSCP. В нерабочее время участвую в CTF-соревнованиях.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=artem_security&backgroundColor=d1d4f9",
        "character_slug": CharacterTypeSlug.ROGUE,
        "equipped_items": ["hair_short_basic", "torso_hoodie", "eyes_calm"],
        "unlocked_items": ["hair_short_basic", "torso_hoodie", "torso_tshirt", "eyes_calm", "head_acc_glasses", "weapon_main_sword", "weapon_sec_shield"],
    },

    # ── Уровень 2: Команда dan_devops ──
    {
        "username": "alice_dev",
        "email": "alice@test.com",
        "password": "TestPass123!",
        "full_name": "Алиса Новикова",
        "birthday": "1998-07-22",
        "department": "Разработка",
        "project": "Платформа геймификации",
        "position": "Фронтенд-разработчик",
        "role": "employee",
        "xp": 320,
        "level": 3,
        "coins": 45,
        "manager_username": "dan_devops",
        "bio": "Пишу интерфейсы на React и TypeScript. Люблю красивые UI и анимации. Мечтаю когда-нибудь сделать свою игру.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=alice_dev&backgroundColor=ffdfbf",
        "character_slug": CharacterTypeSlug.MAGE,
        "equipped_items": ["hair_long_basic", "torso_tshirt", "eyes_calm"],
        "unlocked_items": ["hair_long_basic", "torso_tshirt", "eyes_calm"],
    },
    {
        "username": "bob_backend",
        "email": "bob@test.com",
        "password": "TestPass123!",
        "full_name": "Борис Петров",
        "birthday": "1995-11-08",
        "department": "Разработка",
        "project": "Платформа геймификации",
        "position": "Бэкенд-разработчик",
        "role": "employee",
        "xp": 580,
        "level": 5,
        "coins": 72,
        "manager_username": "dan_devops",
        "bio": "Python и FastAPI — моё всё. Строю надёжные микросервисы и слежу за тем, чтобы API был задокументирован. По вечерам изучаю Rust.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=bob_backend&backgroundColor=c0aede",
        "character_slug": CharacterTypeSlug.ENGINEER,
        "equipped_items": ["hair_short_basic", "torso_hoodie", "eyes_calm"],
        "unlocked_items": ["hair_short_basic", "torso_hoodie", "torso_tshirt", "eyes_calm", "weapon_sec_shield"],
    },
    {
        "username": "natasha_fullstack",
        "email": "natasha@test.com",
        "password": "TestPass123!",
        "full_name": "Наташа Волкова",
        "birthday": "1996-04-17",
        "department": "Разработка",
        "project": "Платформа геймификации",
        "position": "Fullstack-разработчик",
        "role": "employee",
        "xp": 415,
        "level": 4,
        "coins": 55,
        "manager_username": "dan_devops",
        "bio": "React + FastAPI — мои лучшие друзья. Люблю когда фронт и бэк дышат в унисон. Веду технический блог, куда пишу раз в квартал (и каждый раз обещаю себе делать это чаще).",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=natasha_fullstack&backgroundColor=ffdfbf",
        "character_slug": CharacterTypeSlug.ROGUE,
        "equipped_items": ["hair_long_basic", "torso_hoodie", "eyes_calm"],
        "unlocked_items": ["hair_long_basic", "torso_hoodie", "torso_tshirt", "eyes_calm"],
    },
    {
        "username": "ruslan_ios",
        "email": "ruslan@test.com",
        "password": "TestPass123!",
        "full_name": "Руслан Ахметов",
        "birthday": "1992-10-07",
        "department": "Мобильная разработка",
        "project": "Платформа геймификации",
        "position": "iOS-разработчик",
        "role": "employee",
        "xp": 510,
        "level": 4,
        "coins": 68,
        "manager_username": "dan_devops",
        "bio": "Swift и SwiftUI — моя стихия. Собираю нативные iOS-приложения с вниманием к деталям и плавным анимациям. Фанат WWDC и Apple-экосистемы.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=ruslan_ios&backgroundColor=c0aede",
        "character_slug": CharacterTypeSlug.WARRIOR,
        "equipped_items": ["hair_short_basic", "torso_hoodie", "eyes_calm"],
        "unlocked_items": ["hair_short_basic", "torso_hoodie", "torso_tshirt", "eyes_calm", "weapon_sec_shield"],
    },
    {
        "username": "polina_design",
        "email": "polina@test.com",
        "password": "TestPass123!",
        "full_name": "Полина Лебедева",
        "birthday": "1999-06-02",
        "department": "Продуктовый дизайн",
        "project": "Платформа геймификации",
        "position": "UI/UX-дизайнер",
        "role": "employee",
        "xp": 195,
        "level": 2,
        "coins": 25,
        "manager_username": "dan_devops",
        "bio": "Проектирую интерфейсы, которые хочется использовать. Figma, Adobe Illustrator, немного After Effects. Верю, что хороший дизайн решает бизнес-задачи, а не просто выглядит красиво.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=polina_design&backgroundColor=ffd5dc",
        "character_slug": CharacterTypeSlug.MAGE,
        "equipped_items": ["hair_long_basic", "torso_tshirt", "eyes_calm"],
        "unlocked_items": ["hair_long_basic", "torso_tshirt", "eyes_calm"],
    },
    {
        "username": "maxim_android",
        "email": "maxim@test.com",
        "password": "TestPass123!",
        "full_name": "Максим Орлов",
        "birthday": "1994-12-25",
        "department": "Мобильная разработка",
        "project": "Внутренние инструменты",
        "position": "Android-разработчик",
        "role": "employee",
        "xp": 290,
        "level": 3,
        "coins": 38,
        "manager_username": "dan_devops",
        "bio": "Kotlin-разработчик. Строю приложения, которые не лагают и не крашатся. Обожаю Jetpack Compose и ненавижу XML-лейауты.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=maxim_android&backgroundColor=c0aede",
        "character_slug": CharacterTypeSlug.WARRIOR,
        "equipped_items": ["hair_short_basic", "torso_tshirt", "eyes_calm"],
        "unlocked_items": ["hair_short_basic", "torso_tshirt", "eyes_calm"],
    },

    # ── Уровень 2: Команда artem_security ──
    {
        "username": "igor_ml",
        "email": "igor@test.com",
        "password": "TestPass123!",
        "full_name": "Игорь Захаров",
        "birthday": "1991-09-03",
        "department": "Разработка",
        "project": "Аналитика и ML",
        "position": "ML-инженер",
        "role": "employee",
        "xp": 720,
        "level": 6,
        "coins": 95,
        "manager_username": "artem_security",
        "bio": "Обучаю модели, пишу на Python. Занимаюсь рекомендательными системами и NLP. Убеждён, что хорошая документация к модели важнее точности на 0.1%.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=igor_ml&backgroundColor=b6e3f4",
        "character_slug": CharacterTypeSlug.MAGE,
        "equipped_items": ["hair_short_basic", "torso_hoodie", "eyes_calm"],
        "unlocked_items": ["hair_short_basic", "torso_hoodie", "eyes_calm", "head_acc_glasses", "weapon_sec_shield"],
    },
    {
        "username": "anna_analytics",
        "email": "anna@test.com",
        "password": "TestPass123!",
        "full_name": "Анна Смирнова",
        "birthday": "1997-02-11",
        "department": "Аналитика",
        "project": "Аналитика и ML",
        "position": "Аналитик данных",
        "role": "employee",
        "xp": 365,
        "level": 3,
        "coins": 47,
        "manager_username": "artem_security",
        "bio": "Превращаю данные в понятные инсайты. SQL, Python (pandas), Tableau — мои инструменты. Люблю когда дашборды говорят сами за себя и не требуют пятистраничного пояснения.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=anna_analytics&backgroundColor=b6e3f4",
        "character_slug": CharacterTypeSlug.MAGE,
        "equipped_items": ["hair_long_basic", "torso_tshirt", "eyes_calm"],
        "unlocked_items": ["hair_long_basic", "torso_tshirt", "eyes_calm"],
    },
    {
        "username": "eva_qa",
        "email": "eva@test.com",
        "password": "TestPass123!",
        "full_name": "Евгения Соколова",
        "birthday": "2000-01-14",
        "department": "Качество и тестирование",
        "project": "Внутренние инструменты",
        "position": "QA-инженер",
        "role": "employee",
        "xp": 140,
        "level": 1,
        "coins": 18,
        "manager_username": "artem_security",
        "bio": "Ловлю баги раньше, чем они успевают навредить пользователям. Специализируюсь на автотестах (pytest, Playwright). Новичок в команде, но уже нашла критический баг на первой неделе 😄",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=eva_qa&backgroundColor=ffd5dc",
        "character_slug": CharacterTypeSlug.ROGUE,
        "equipped_items": ["hair_long_basic", "torso_tshirt", "eyes_calm"],
        "unlocked_items": ["hair_long_basic", "torso_tshirt", "eyes_calm"],
    },
]


async def seed_test_users(db: AsyncSession) -> dict[str, str]:
    """
    Шаг 1 — создаёт/обновляет всех пользователей (без manager_id).
    Шаг 2 — второй проход: проставляет manager_id по username менеджера.

    ВАЖНО: birthday передаётся как объект datetime.date, а не строка,
    чтобы asyncpg мог корректно закодировать параметр $8 (date-колонка).

    Возвращает словарь username → id (str UUID).
    """
    user_ids: dict[str, str] = {}

    # ── Шаг 1: создаём / обновляем пользователей ──
    for u in TEST_USERS:
        existing_id = await db.scalar(
            text(f"SELECT id::text FROM {AUTH_DB_SCHEMA}.users WHERE username = :username"),
            {"username": u["username"]}
        )
        if existing_id:
            print(f"  ℹ️  Пользователь '{u['username']}' уже есть — обновляем профиль")
            user_ids[u["username"]] = existing_id
            await db.execute(
                text(f"""
                    UPDATE {AUTH_DB_SCHEMA}.users
                    SET department = :dept, project = :proj, position = :pos,
                        xp = :xp, level = :level, coins = :coins,
                        bio = :bio, avatar_url = :avatar_url, birthday = :birthday,
                        full_name = :full_name
                    WHERE username = :username
                """),
                {
                    "dept": u["department"], "proj": u["project"], "pos": u["position"],
                    "xp": u["xp"], "level": u["level"], "coins": u["coins"],
                    "bio": u["bio"], "avatar_url": u["avatar_url"],
                    "birthday": parse_date(u["birthday"]),   # ← date-объект
                    "full_name": u["full_name"],
                    "username": u["username"],
                }
            )
        else:
            new_id = str(_uuid_mod.uuid4())
            await db.execute(
                text(f"""
                    INSERT INTO {AUTH_DB_SCHEMA}.users
                        (id, email, username, hashed_password, full_name,
                         bio, avatar_url, birthday,
                         department, project, position, role,
                         xp, level, coins,
                         is_active, is_verified, is_superuser,
                         created_at, updated_at)
                    VALUES
                        (:id, :email, :username, :hashed_password, :full_name,
                         :bio, :avatar_url, :birthday,
                         :department, :project, :position, :role,
                         :xp, :level, :coins,
                         true, true, false,
                         now(), now())
                """),
                {
                    "id": new_id,
                    "email": u["email"],
                    "username": u["username"],
                    "hashed_password": hash_password(u["password"]),
                    "full_name": u["full_name"],
                    "bio": u["bio"],
                    "avatar_url": u["avatar_url"],
                    "birthday": parse_date(u["birthday"]),   # ← date-объект
                    "department": u["department"],
                    "project": u["project"],
                    "position": u["position"],
                    "role": u["role"],
                    "xp": u["xp"],
                    "level": u["level"],
                    "coins": u["coins"],
                }
            )
            user_ids[u["username"]] = new_id
            print(f"  ✅ Пользователь создан: {u['full_name']} @{u['username']} ({u['position']})")

    await db.flush()

    # ── Шаг 2: проставляем manager_id ──
    print("\n  🔗 Назначаем manager_id...")
    for u in TEST_USERS:
        mgr_username = u.get("manager_username")
        if not mgr_username:
            continue
        mgr_id = user_ids.get(mgr_username)
        if not mgr_id:
            print(f"  ⚠️  Менеджер '{mgr_username}' не найден для '{u['username']}' — пропускаем")
            continue
        await db.execute(
            text(f"""
                UPDATE {AUTH_DB_SCHEMA}.users
                SET manager_id = :manager_id
                WHERE username = :username
            """),
            {"manager_id": mgr_id, "username": u["username"]}
        )
        print(f"  ✅ {u['username']:22s} → manager: {mgr_username} ({mgr_id[:8]}...)")

    await db.flush()
    return user_ids


# ================================================================
# ПЕРСОНАЖИ + ЭКИПИРОВКА
# Для каждого тестового пользователя создаём Character и надеваем
# предметы из equipped_items. Также разблокируем unlocked_items.
# ================================================================

async def seed_characters_for_users(
    db: AsyncSession,
    user_ids: dict[str, str],
) -> None:
    """Создаёт персонажей и экипировку для всех тестовых пользователей."""

    # Загружаем все архетипы и косметику в память (быстрее, чем N запросов)
    char_types: dict[CharacterTypeSlug, CharacterType] = {}
    for slug in CharacterTypeSlug:
        ct = await db.scalar(select(CharacterType).where(CharacterType.slug == slug))
        if ct:
            char_types[slug] = ct

    cosmetics: dict[str, CosmeticItem] = {}
    result = await db.execute(select(CosmeticItem))
    for item in result.scalars().all():
        cosmetics[item.slug] = item

    SKIN_COLORS = ["#F5C5A3", "#FDDBB4", "#EDB98A", "#D08B5B", "#AE5D29", "#694D3D"]
    HAIR_COLORS = ["#2C1810", "#4A2C2A", "#8B5E3C", "#D4A853", "#F0E68C", "#1A1A2E"]
    EYES_COLORS = ["#4A90D9", "#2ECC71", "#8B4513", "#7B68EE", "#708090", "#2C3E50"]

    for u in TEST_USERS:
        uid = user_ids.get(u["username"])
        if not uid:
            continue

        char_slug = u.get("character_slug")
        char_type = char_types.get(char_slug)
        if not char_type:
            print(f"  ⚠️  Архетип {char_slug} не найден — пропускаем персонажа для {u['username']}")
            continue

        # Проверяем, существует ли уже персонаж
        existing_char = await db.scalar(
            select(Character).where(Character.user_id == uid)
        )
        if existing_char:
            print(f"  ℹ️  Персонаж для {u['username']} уже есть")
            char = existing_char
        else:
            char = Character(
                user_id=uid,
                character_type_id=char_type.id,
                level=u["level"],
                experience=u["xp"],
                coin_multiplier=char_type.coin_multiplier_base,
                xp_multiplier=char_type.xp_multiplier_base,
                skin_color=random.choice(SKIN_COLORS),
                hair_color=random.choice(HAIR_COLORS),
                eyes_color=random.choice(EYES_COLORS),
            )
            db.add(char)
            await db.flush()
            print(f"  ✅ Персонаж создан: {u['username']} → {char_type.name} (lvl {u['level']})")

        # Разблокированные предметы
        for slug in u.get("unlocked_items", []):
            item = cosmetics.get(slug)
            if not item:
                continue
            existing_unlock = await db.scalar(
                select(UnlockedCosmetic)
                .where(UnlockedCosmetic.user_id == uid)
                .where(UnlockedCosmetic.cosmetic_item_id == item.id)
            )
            if not existing_unlock:
                db.add(UnlockedCosmetic(user_id=uid, cosmetic_item_id=item.id))

        await db.flush()

        # Экипировка (надетые предметы)
        for slug in u.get("equipped_items", []):
            item = cosmetics.get(slug)
            if not item:
                continue
            existing_equip = await db.scalar(
                select(CharacterEquipment)
                .where(CharacterEquipment.character_id == char.id)
                .where(CharacterEquipment.slot == item.slot)
            )
            if not existing_equip:
                db.add(CharacterEquipment(
                    character_id=char.id,
                    cosmetic_item_id=item.id,
                    slot=item.slot,
                ))

        await db.flush()
        print(f"  ✅ Экипировка / инвентарь для {u['username']}: {len(u.get('equipped_items', []))} слота надеты, "
              f"{len(u.get('unlocked_items', []))} предметов разблокировано")


# ================================================================
# БЕЙДЖИ
# ================================================================

BADGES_DATA = [
    {
        "name": "Первопроходец",
        "description": "Выдаётся за первый вход в систему. Принят в команду!",
        "icon_url": "🏆",
        "rarity": BadgeRarity.COMMON,
        "condition_type": None,
        "condition_value": None,
        "xp_bonus": 25,
    },
    {
        "name": "Новичок герой",
        "description": "Выполните первый квест и получите эту награду.",
        "icon_url": "⭐",
        "rarity": BadgeRarity.COMMON,
        "condition_type": "quests_completed",
        "condition_value": 1,
        "xp_bonus": 50,
    },
    {
        "name": "Охотник квестов",
        "description": "Завершите 5 квестов и докажите свою неутомимость.",
        "icon_url": "🎯",
        "rarity": BadgeRarity.RARE,
        "condition_type": "quests_completed",
        "condition_value": 5,
        "xp_bonus": 100,
    },
    {
        "name": "Мастер квестов",
        "description": "Выполните 15 квестов. Настоящий мастер приключений!",
        "icon_url": "👑",
        "rarity": BadgeRarity.EPIC,
        "condition_type": "quests_completed",
        "condition_value": 15,
        "xp_bonus": 250,
    },
    {
        "name": "Знаток опыта",
        "description": "Накопите 500 XP. Рост неизбежен!",
        "icon_url": "💫",
        "rarity": BadgeRarity.RARE,
        "condition_type": "xp_total",
        "condition_value": 500,
        "xp_bonus": 75,
    },
    {
        "name": "Легенда",
        "description": "Накопите 2000 XP. О ваших подвигах слагают легенды!",
        "icon_url": "🔥",
        "rarity": BadgeRarity.LEGENDARY,
        "condition_type": "xp_total",
        "condition_value": 2000,
        "xp_bonus": 500,
    },
    {
        "name": "Вожак пятого уровня",
        "description": "Достигните 5-го уровня в системе.",
        "icon_url": "🦅",
        "rarity": BadgeRarity.EPIC,
        "condition_type": "level",
        "condition_value": 5,
        "xp_bonus": 150,
    },
]


async def seed_badges(db: AsyncSession) -> list:
    badges = []
    for b in BADGES_DATA:
        existing = await db.scalar(select(Badge).where(Badge.name == b["name"]))
        if existing:
            print(f"  ℹ️  Бейдж '{b['name']}' уже есть")
            badges.append(existing)
        else:
            badge = Badge(**b)
            db.add(badge)
            await db.flush()
            badges.append(badge)
            print(f"  ✅ Бейдж создан: {b['name']} [{b['rarity'].value}]")
    return badges


# ================================================================
# КВЕСТЫ
# ================================================================

QUESTS_DATA = [
    {
        "title": "Первый шаг 🚀",
        "description": "Войди в систему и ознакомься с платформой геймификации.",
        "quest_type": QuestType.PERSONAL,
        "difficulty": QuestDifficulty.EASY,
        "xp_reward": 50,
        "coins_reward": 10,
    },
    {
        "title": "Заполни профиль ✅",
        "description": "Добавь фото, должность и био в своём профиле.",
        "quest_type": QuestType.PERSONAL,
        "difficulty": QuestDifficulty.EASY,
        "xp_reward": 75,
        "coins_reward": 15,
    },
    {
        "title": "Ежедневный чек-ин 🏖️",
        "description": "Отметься в системе сегодня. Маленький шаг к большой цели!",
        "quest_type": QuestType.DAILY,
        "difficulty": QuestDifficulty.EASY,
        "xp_reward": 30,
        "coins_reward": 5,
    },
    {
        "title": "Командный дух 👥",
        "description": "Помоги коллеге решить задачу или ответь на его вопрос.",
        "quest_type": QuestType.TEAM,
        "difficulty": QuestDifficulty.MEDIUM,
        "xp_reward": 120,
        "coins_reward": 20,
    },
    {
        "title": "Код-ревью 🔍",
        "description": "Проведи ревью пулл-риквеста коллеги в GitHub.",
        "quest_type": QuestType.INTEGRATION,
        "difficulty": QuestDifficulty.MEDIUM,
        "xp_reward": 150,
        "coins_reward": 25,
        "integration_trigger": "github_pr_review",
        "integration_target": 1,
    },
    {
        "title": "Спринт 🏃",
        "description": "Закрой 3 квеста за одну неделю.",
        "quest_type": QuestType.PERSONAL,
        "difficulty": QuestDifficulty.HARD,
        "xp_reward": 300,
        "coins_reward": 50,
        "time_limit_hours": 168,
    },
    {
        "title": "Ментор 🧑‍🏫",
        "description": "Помоги новому сотруднику разобраться с платформой.",
        "quest_type": QuestType.TEAM,
        "difficulty": QuestDifficulty.MEDIUM,
        "xp_reward": 200,
        "coins_reward": 35,
    },
    {
        "title": "Эпический код ⚡",
        "description": "Закрой epic-задание и стань легендой команды!",
        "quest_type": QuestType.PERSONAL,
        "difficulty": QuestDifficulty.EPIC,
        "xp_reward": 600,
        "coins_reward": 100,
    },
]


async def seed_quests(db: AsyncSession) -> list:
    quests = []
    for q in QUESTS_DATA:
        existing = await db.scalar(select(Quest).where(Quest.title == q["title"]))
        if existing:
            print(f"  ℹ️  Квест '{q['title']}' уже есть")
            quests.append(existing)
        else:
            quest = Quest(**{**q, "status": QuestStatus.ACTIVE})
            db.add(quest)
            await db.flush()
            quests.append(quest)
            print(f"  ✅ Квест создан: {q['title']} [{q['difficulty'].value}] +{q['xp_reward']} XP")
    return quests


# ================================================================
# НАЗНАЧЕНИЕ КВЕСТОВ И БЕЙДЖЕЙ
# ================================================================

async def assign_quests_to_user(db: AsyncSession, user_id: str, quests: list, count: int = 3) -> None:
    for quest in quests[:count]:
        existing = await db.scalar(
            select(UserQuest)
            .where(UserQuest.user_id == user_id)
            .where(UserQuest.quest_id == quest.id)
        )
        if not existing:
            db.add(UserQuest(
                user_id=user_id,
                quest_id=quest.id,
                status=UserQuestStatus.IN_PROGRESS,
                progress=0,
                target=1,
                is_viewed=False,
            ))


async def assign_badge_to_user(db: AsyncSession, user_id: str, badge) -> None:
    existing = await db.scalar(
        select(UserBadge)
        .where(UserBadge.user_id == user_id)
        .where(UserBadge.badge_id == badge.id)
    )
    if not existing:
        db.add(UserBadge(
            user_id=user_id,
            badge_id=badge.id,
            is_revoked=False,
            is_new=True,
        ))


# ================================================================
# XP ТРАНЗАКЦИИ
# ================================================================

XP_TRANSACTIONS_TEMPLATES = [
    (50,  XPSource.QUEST,         "Выполнен квест «Первый шаг 🚀»"),
    (75,  XPSource.QUEST,         "Выполнен квест «Заполни профиль ✅»"),
    (30,  XPSource.QUEST,         "Выполнен ежедневный чек-ин"),
    (25,  XPSource.BADGE,         "Получен бейдж «Первопроходец»"),
    (100, XPSource.GITHUB_COMMIT, "10 коммитов в GitHub за спринт"),
    (150, XPSource.GITHUB_PR,     "Закрыт Pull Request #42"),
    (120, XPSource.QUEST,         "Выполнен квест «Командный дух 👥»"),
]

# Количество XP-транзакций для каждого тестового пользователя
XP_TX_COUNT_PER_USER = {
    "alice_dev":         3,
    "bob_backend":       7,
    "carol_pm":          5,
    "dan_devops":        5,
    "eva_qa":            2,
    "igor_ml":           7,
    "natasha_fullstack": 4,
    "maxim_android":     3,
    "polina_design":     2,
    "artem_security":    7,
    "anna_analytics":    4,
    "ruslan_ios":        5,
}


async def seed_xp_transactions(
    db: AsyncSession,
    user_ids: dict[str, str],
    devuser_id: str,
) -> None:
    async def _create_for(uid: str, count: int) -> None:
        existing_count = await db.scalar(
            text(f"SELECT COUNT(*) FROM {DB_SCHEMA}.xp_transactions WHERE user_id = :uid"),
            {"uid": uid},
        )
        if existing_count and existing_count > 0:
            print(f"  ℹ️  XP-транзакции для {uid[:8]}... уже есть ({existing_count} шт.)")
            return
        for tmpl in XP_TRANSACTIONS_TEMPLATES[:count]:
            amount, source, description = tmpl
            db.add(XPTransaction(user_id=uid, amount=amount, source=source, description=description))
        print(f"  ✅ XP-транзакций создано: {count} для {uid[:8]}...")

    await _create_for(devuser_id, len(XP_TRANSACTIONS_TEMPLATES))
    for username, count in XP_TX_COUNT_PER_USER.items():
        uid = user_ids.get(username)
        if uid:
            await _create_for(uid, count)
    await db.flush()


# ================================================================
# COIN ТРАНЗАКЦИИ
# ================================================================

COIN_TRANSACTIONS_TEMPLATES = [
    (10, CoinSource.QUEST, "Квест «Первый шаг 🚀»"),
    (15, CoinSource.QUEST, "Квест «Заполни профиль ✅»"),
    (5,  CoinSource.QUEST, "Ежедневный чек-ин"),
    (25, CoinSource.BADGE, "Бейдж «Первопроходец»"),
    (20, CoinSource.QUEST, "Квест «Командный дух 👥»"),
]

COIN_TX_COUNT_PER_USER = {
    "alice_dev":         3,
    "bob_backend":       5,
    "carol_pm":          4,
    "dan_devops":        4,
    "eva_qa":            1,
    "igor_ml":           5,
    "natasha_fullstack": 3,
    "maxim_android":     2,
    "polina_design":     2,
    "artem_security":    5,
    "anna_analytics":    3,
    "ruslan_ios":        4,
}


async def seed_coin_transactions(
    db: AsyncSession,
    user_ids: dict[str, str],
    devuser_id: str,
) -> None:
    async def _create_for(uid: str, count: int) -> None:
        existing_count = await db.scalar(
            text(f"SELECT COUNT(*) FROM {DB_SCHEMA}.coin_transactions WHERE user_id = :uid"),
            {"uid": uid},
        )
        if existing_count and existing_count > 0:
            print(f"  ℹ️  Coin-транзакции для {uid[:8]}... уже есть ({existing_count} шт.)")
            return
        for tmpl in COIN_TRANSACTIONS_TEMPLATES[:count]:
            amount, source, description = tmpl
            db.add(CoinTransaction(user_id=uid, amount=amount, source=source, description=description))
        print(f"  ✅ Coin-транзакций создано: {count} для {uid[:8]}...")

    await _create_for(devuser_id, len(COIN_TRANSACTIONS_TEMPLATES))
    for username, count in COIN_TX_COUNT_PER_USER.items():
        uid = user_ids.get(username)
        if uid:
            await _create_for(uid, count)
    await db.flush()


# ================================================================
# СНАПШОТ ЛИДЕРБОРДА
# ================================================================

async def seed_leaderboard(
    db: AsyncSession,
    user_ids: dict[str, str],
    devuser_id: str,
    devuser_username: str = "devuser",
) -> None:
    PERIOD = "all_time"

    existing = await db.scalar(
        text(f"SELECT COUNT(*) FROM {DB_SCHEMA}.leaderboard_snapshots WHERE period = :period"),
        {"period": PERIOD},
    )
    if existing and existing > 0:
        print(f"  ℹ️  Снапшот лидерборда '{PERIOD}' уже есть ({existing} записей)")
        return

    entries = [
        {
            "user_id": devuser_id,
            "username": devuser_username,
            "full_name": "Dev User",
            "total_xp": 500,
            "level": 4,
            "total_coins": 65,
            "quests_completed": 3,
            "badges_count": 1,
        }
    ]

    for u in TEST_USERS:
        uid = user_ids.get(u["username"])
        if not uid:
            continue
        entries.append({
            "user_id": uid,
            "username": u["username"],
            "full_name": u["full_name"],
            "total_xp": u["xp"],
            "level": u["level"],
            "total_coins": u["coins"],
            "quests_completed": XP_TX_COUNT_PER_USER.get(u["username"], 1),
            "badges_count": 2 if u["xp"] >= 500 else 1,
        })

    entries.sort(key=lambda x: x["total_xp"], reverse=True)
    for rank, entry in enumerate(entries, start=1):
        db.add(LeaderboardSnapshot(
            user_id=entry["user_id"],
            username=entry["username"],
            full_name=entry["full_name"],
            total_xp=entry["total_xp"],
            level=entry["level"],
            total_coins=entry["total_coins"],
            quests_completed=entry["quests_completed"],
            badges_count=entry["badges_count"],
            rank=rank,
            period=PERIOD,
        ))
        print(f"  ✅ Лидерборд #{rank:2d}: {entry['username']:22s} — {entry['total_xp']:4d} XP (lvl {entry['level']})")

    await db.flush()


# ================================================================
# ГЛАВНАЯ ФУНКЦИЯ SEED
# ================================================================

async def seed(devuser_id: str) -> None:
    async with async_session() as db:
        print(f"\n👤 devuser_id = {devuser_id}")

        print("\n📌 Шаг 1/8: Архетипы персонажей...")
        await seed_character_types(db)

        print("\n📌 Шаг 2/8: Косметические предметы (инвентарь)...")
        await seed_cosmetics(db)

        print("\n📌 Шаг 3/8: Тестовые пользователи + manager_id...")
        test_user_ids = await seed_test_users(db)

        print("\n📌 Шаг 4/8: Персонажи и экипировка пользователей...")
        await seed_characters_for_users(db, test_user_ids)

        print("\n📌 Шаг 5/8: Бейджи...")
        badges = await seed_badges(db)

        print("\n📌 Шаг 6/8: Квесты...")
        quests = await seed_quests(db)

        print("\n📌 Шаг 7/8: Назначаем квесты / бейджи...")
        first_badge = next((b for b in badges if b.condition_type is None), badges[0])
        await assign_badge_to_user(db, devuser_id, first_badge)
        await assign_quests_to_user(db, devuser_id, quests, count=3)
        print(f"  ✅ devuser: бейдж '{first_badge.name}' + {min(3, len(quests))} квеста")

        user_quest_map = {
            "alice_dev":         (quests[1:5], [first_badge]),
            "bob_backend":       (quests[0:4], [first_badge, badges[1] if len(badges) > 1 else first_badge]),
            "carol_pm":          (quests[2:5], [first_badge, badges[2] if len(badges) > 2 else first_badge]),
            "dan_devops":        (quests[3:6], [first_badge, badges[4] if len(badges) > 4 else first_badge]),
            "eva_qa":            (quests[0:2], [first_badge]),
            "igor_ml":           (quests[0:5], [first_badge, badges[1], badges[4]] if len(badges) > 4 else [first_badge]),
            "natasha_fullstack": (quests[1:4], [first_badge]),
            "maxim_android":     (quests[0:3], [first_badge]),
            "polina_design":     (quests[0:2], [first_badge]),
            "artem_security":    (quests[0:6], [first_badge, badges[2], badges[4], badges[6]] if len(badges) > 6 else [first_badge]),
            "anna_analytics":    (quests[1:4], [first_badge]),
            "ruslan_ios":        (quests[0:4], [first_badge, badges[1] if len(badges) > 1 else first_badge]),
        }
        for username, (uq_list, ub_list) in user_quest_map.items():
            uid = test_user_ids.get(username)
            if uid:
                for q in uq_list:
                    await assign_quests_to_user(db, uid, [q], count=1)
                for b in ub_list:
                    if b:
                        await assign_badge_to_user(db, uid, b)
                print(f"  ✅ {username:22s}: {len(uq_list)} квеста, {len(ub_list)} бейдж")

        print("\n📌 Шаг 8a/8: XP-транзакции...")
        await seed_xp_transactions(db, test_user_ids, devuser_id)

        print("\n📌 Шаг 8b/8: Coin-транзакции...")
        await seed_coin_transactions(db, test_user_ids, devuser_id)

        print("\n📌 Шаг 8c/8: Снапшот лидерборда...")
        await seed_leaderboard(db, test_user_ids, devuser_id)

        await db.commit()
        print("\n🎉 Seed выполнен успешно!")
        print("\n📄 Тестовые пользователи (email / password):")
        print(f"\n  {'Уровень':8s}  {'Имя':30s}  {'Email':28s}  Пароль")
        print(f"  {'-'*8}  {'-'*30}  {'-'*28}  {'-'*14}")
        hierarchy = [
            ("Head",      "carol_pm"),
            ("Lead",      "dan_devops"),
            ("Lead",      "artem_security"),
            ("Employee",  "alice_dev"),
            ("Employee",  "bob_backend"),
            ("Employee",  "natasha_fullstack"),
            ("Employee",  "ruslan_ios"),
            ("Employee",  "polina_design"),
            ("Employee",  "maxim_android"),
            ("Employee",  "igor_ml"),
            ("Employee",  "anna_analytics"),
            ("Employee",  "eva_qa"),
        ]
        user_map = {u["username"]: u for u in TEST_USERS}
        for level_label, uname in hierarchy:
            u = user_map[uname]
            print(f"  {level_label:8s}  {u['full_name']:30s}  {u['email']:28s}  {u['password']}")

        print("\n📊 Эндпоинты для проверки:")
        print("   • XP-транзакции    → GET /api/v1/xp/history")
        print("   • Coin-транзакции  → GET /api/v1/coins/history")
        print("   • Лидерборд        → GET /api/v1/leaderboard")
        print("   • Персонаж         → GET /api/v1/characters/me")
        print("   • Инвентарь        → GET /api/v1/inventory")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Сид для demo/devuser")
    parser.add_argument("--devuser-id", default=None, help="UUID devuser")
    args = parser.parse_args()

    async def main():
        uid = args.devuser_id
        if not uid:
            print("❌ Укажите --devuser-id. Пример:")
            print("  docker exec gamification-gamification-service python seed_demo.py --devuser-id <UUID>")
            sys.exit(1)
        await seed(uid)

    asyncio.run(main())
