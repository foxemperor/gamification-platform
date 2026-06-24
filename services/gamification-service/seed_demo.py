"""
Seed-скрипт: создаёт тестовые данные для демонстрации платформы.

Создаёт:
  - Архетипы персонажей (4 шт.)
  - Бейджи (7 шт. с реальными condition_type)
  - Квесты (8 шт., разные типы/сложность)
  - 5 тестовых пользователей в auth-сервисе (отдел, проект, должность)
  - Назначение manager_id: carol_pm управляет alice, bob, dan, eva
  - Назначение квестов / бейджей devuser и тестовым пользователям

Запуск изнутри контейнера gamification-service:
    python seed_demo.py [--devuser-id UUID]

Автор: Dmitry Koval
"""

import argparse
import asyncio
import os
import sys
import uuid as _uuid_mod

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
    CosmeticItem, CosmeticSlot, CosmeticVisibility, UnlockType,
)
from app.database import DB_SCHEMA

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ================================================================
# ХЕШИРОВАНИЕ ПАРОЛЕЙ — используем bcrypt напрямую (без passlib)
# ================================================================

def hash_password(pwd: str) -> str:
    """Хэширует пароль через bcrypt напрямую, без passlib."""
    import bcrypt
    return bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


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
    """Создаёт каталог косметических предметов для вкладки «Инвентарь»."""
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
# ТЕСТОВЫЕ ПОЛЬЗОВАТЕЛИ (в auth-схеме)
# ================================================================

TEST_USERS = [
    {
        "username": "alice_dev",
        "email": "alice@test.com",
        "password": "TestPass123!",
        "full_name": "Алиса Новикова",
        "department": "Разработка",
        "project": "Платформа геймификации",
        "position": "Фронтенд разработчик",
        "role": "employee",
        "xp": 320,
        "level": 3,
        "coins": 45,
        "manager_username": "carol_pm",
    },
    {
        "username": "bob_backend",
        "email": "bob@test.com",
        "password": "TestPass123!",
        "full_name": "Боб Петров",
        "department": "Разработка",
        "project": "Платформа геймификации",
        "position": "Бэкенд разработчик",
        "role": "employee",
        "xp": 580,
        "level": 5,
        "coins": 72,
        "manager_username": "carol_pm",
    },
    {
        "username": "carol_pm",
        "email": "carol@test.com",
        "password": "TestPass123!",
        "full_name": "Кароль Мартынова",
        "department": "Управление проектами",
        "project": "Внутренние инструменты",
        "position": "Проект менеджер",
        "role": "manager",
        "xp": 210,
        "level": 2,
        "coins": 30,
        "manager_username": None,  # менеджер не имеет своего менеджера
    },
    {
        "username": "dan_devops",
        "email": "dan@test.com",
        "password": "TestPass123!",
        "full_name": "Данил Григорьев",
        "department": "Инфраструктура",
        "project": "Платформа геймификации",
        "position": "DevOps инженер",
        "role": "employee",
        "xp": 450,
        "level": 4,
        "coins": 60,
        "manager_username": "carol_pm",
    },
    {
        "username": "eva_qa",
        "email": "eva@test.com",
        "password": "TestPass123!",
        "full_name": "Ева Соколова",
        "department": "Качество и тестирование",
        "project": "Внутренние инструменты",
        "position": "QA инженер",
        "role": "employee",
        "xp": 140,
        "level": 1,
        "coins": 18,
        "manager_username": "carol_pm",
    },
]


async def seed_test_users(db: AsyncSession) -> dict[str, str]:
    """
    Шаг 1 — создаёт/обновляет всех пользователей (без manager_id).
    Шаг 2 — второй проход: проставляет manager_id по username менеджера.
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
            print(f"  ℹ️  Пользователь '{u['username']}' уже есть")
            user_ids[u["username"]] = existing_id
            await db.execute(
                text(f"""
                    UPDATE {AUTH_DB_SCHEMA}.users
                    SET department = :dept, project = :proj, position = :pos,
                        xp = :xp, level = :level, coins = :coins
                    WHERE username = :username
                """),
                {
                    "dept": u["department"], "proj": u["project"], "pos": u["position"],
                    "xp": u["xp"], "level": u["level"], "coins": u["coins"],
                    "username": u["username"]
                }
            )
        else:
            new_id = str(_uuid_mod.uuid4())
            await db.execute(
                text(f"""
                    INSERT INTO {AUTH_DB_SCHEMA}.users
                        (id, email, username, hashed_password, full_name,
                         department, project, position, role,
                         xp, level, coins,
                         is_active, is_verified, is_superuser,
                         created_at, updated_at)
                    VALUES
                        (:id, :email, :username, :hashed_password, :full_name,
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
            print(f"  ✅ Пользователь создан: {u['username']} ({u['department']} / {u['project']})")

    await db.flush()

    # ── Шаг 2: проставляем manager_id (второй проход, все UUID уже известны) ──
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
        print(f"  ✅ {u['username']:15s} → manager: {mgr_username} ({mgr_id[:8]}...)")

    await db.flush()
    return user_ids


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
            print(f"  ✅ Бейдж создан: {b['name']} [{b['rarity'].value}] condition={b['condition_type']}:{b['condition_value']}")
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
# НАЗНАЧЕНИЕ КВЕСТОВ И БЕЙДЖЕЙ ПОЛЬЗОВАТЕЛЮ
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
# ГЛАВНАЯ ФУНКЦИЯ SEED
# ================================================================

async def seed(devuser_id: str) -> None:
    async with async_session() as db:
        print(f"\n👤 devuser_id = {devuser_id}")

        print("\n📌 Шаг 1/5: Архетипы персонажей...")
        await seed_character_types(db)

        print("\n📌 Шаг 1b: Косметические предметы (инвентарь)...")
        await seed_cosmetics(db)

        print("\n📌 Шаг 2/5: Тестовые пользователи + manager_id...")
        test_user_ids = await seed_test_users(db)

        print("\n📌 Шаг 3/5: Бейджи...")
        badges = await seed_badges(db)

        print("\n📌 Шаг 4/5: Квесты...")
        quests = await seed_quests(db)

        print("\n📌 Шаг 5/5: Назначаем квесты / бейджи...")
        first_badge = next((b for b in badges if b.condition_type is None), badges[0])
        await assign_badge_to_user(db, devuser_id, first_badge)
        await assign_quests_to_user(db, devuser_id, quests, count=3)
        print(f"  ✅ devuser: бейдж '{first_badge.name}' + {min(3, len(quests))} квеста")

        user_quest_map = {
            "alice_dev":   (quests[1:5], [first_badge]),
            "bob_backend": (quests[0:4], [first_badge, badges[1] if len(badges) > 1 else first_badge]),
            "carol_pm":    (quests[2:4], [first_badge]),
            "dan_devops":  (quests[3:6], [first_badge, badges[4] if len(badges) > 4 else first_badge]),
            "eva_qa":      (quests[0:2], [first_badge]),
        }
        for username, (uq_list, ub_list) in user_quest_map.items():
            uid = test_user_ids.get(username)
            if uid:
                for q in uq_list:
                    await assign_quests_to_user(db, uid, [q], count=1)
                for b in ub_list:
                    await assign_badge_to_user(db, uid, b)
                print(f"  ✅ {username}: {len(uq_list)} квеста, {len(ub_list)} бейдж")

        await db.commit()
        print("\n🎉 Seed выполнен успешно!")
        print("\n📄 Тестовые пользователи (email / password):")
        for u in TEST_USERS:
            mgr = f"manager: {u['manager_username']}" if u.get("manager_username") else "менеджер (нет руководителя)"
            print(f"   {u['full_name']:25s}  {u['email']:22s}  /  {u['password']}  [{u['department']}]  {mgr}")


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
