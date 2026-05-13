"""
Gamification Service — seed тестовых данных
============================================
Создаёт квесты и бейджи для разработки и демонстрации.
Идемпотентен: повторный запуск не создаёт дубликаты.

Запуск:
    docker compose exec gamification-service python app/seed.py

Автор: Dmitry Koval
"""

import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import settings
from app.models import Badge, BadgeRarity, Quest, QuestDifficulty, QuestStatus, QuestType

QUESTS = [
    {
        "title": "Первый коммит",
        "description": "Сделай свой первый коммит в любой репозиторий команды.",
        "quest_type": QuestType.PERSONAL,
        "difficulty": QuestDifficulty.EASY,
        "xp_reward": 100,
        "coins_reward": 10,
    },
    {
        "title": "Мастер Pull Request",
        "description": "Открой и смержи 5 Pull Request'ов с одобрением ревьюера.",
        "quest_type": QuestType.PERSONAL,
        "difficulty": QuestDifficulty.MEDIUM,
        "xp_reward": 350,
        "coins_reward": 30,
        "integration_trigger": "github_pr_merged",
        "integration_target": 5,
    },
    {
        "title": "Командный игрок",
        "description": "Прими участие в командном код-ревью: дай минимум 10 комментариев к PR коллег.",
        "quest_type": QuestType.TEAM,
        "difficulty": QuestDifficulty.MEDIUM,
        "xp_reward": 280,
        "coins_reward": 25,
    },
    {
        "title": "Покоритель багов",
        "description": "Закрой 10 задач с типом Bug в Jira за месяц.",
        "quest_type": QuestType.SKILL,
        "difficulty": QuestDifficulty.HARD,
        "xp_reward": 600,
        "coins_reward": 50,
        "integration_trigger": "jira_bug_closed",
        "integration_target": 10,
        "time_limit_hours": 720,
    },
    {
        "title": "Ежедневная активность",
        "description": "Сделай хотя бы 1 коммит сегодня.",
        "quest_type": QuestType.DAILY,
        "difficulty": QuestDifficulty.EASY,
        "xp_reward": 50,
        "coins_reward": 5,
        "integration_trigger": "github_commit",
        "integration_target": 1,
        "time_limit_hours": 24,
    },
    {
        "title": "Архитектор",
        "description": "Разработай и задокументируй архитектуру нового модуля (epic-задача в Jira).",
        "quest_type": QuestType.SKILL,
        "difficulty": QuestDifficulty.EPIC,
        "xp_reward": 1500,
        "coins_reward": 120,
    },
    {
        "title": "CI/CD Герой",
        "description": "Настрой или улучши пайплайн CI/CD для одного из сервисов.",
        "quest_type": QuestType.INTEGRATION,
        "difficulty": QuestDifficulty.HARD,
        "xp_reward": 800,
        "coins_reward": 70,
    },
    {
        "title": "Наставник",
        "description": "Проведи onboarding-сессию для нового участника команды.",
        "quest_type": QuestType.TEAM,
        "difficulty": QuestDifficulty.MEDIUM,
        "xp_reward": 400,
        "coins_reward": 40,
    },
]

BADGES = [
    {
        "name": "Новичок",
        "description": "Первые шаги в системе геймификации.",
        "rarity": BadgeRarity.COMMON,
        "condition_type": "quests_completed",
        "condition_value": 1,
        "xp_bonus": 50,
    },
    {
        "name": "Активный участник",
        "description": "Выполнил 5 квестов.",
        "rarity": BadgeRarity.COMMON,
        "condition_type": "quests_completed",
        "condition_value": 5,
        "xp_bonus": 150,
    },
    {
        "name": "Ветеран",
        "description": "Выполнил 20 квестов.",
        "rarity": BadgeRarity.RARE,
        "condition_type": "quests_completed",
        "condition_value": 20,
        "xp_bonus": 500,
    },
    {
        "name": "Легенда команды",
        "description": "Выполнил 50 квестов.",
        "rarity": BadgeRarity.LEGENDARY,
        "condition_type": "quests_completed",
        "condition_value": 50,
        "xp_bonus": 2000,
    },
    {
        "name": "XP Коллекционер",
        "description": "Набрал 1000 XP.",
        "rarity": BadgeRarity.RARE,
        "condition_type": "xp_reached",
        "condition_value": 1000,
        "xp_bonus": 200,
    },
    {
        "name": "XP Мастер",
        "description": "Набрал 5000 XP.",
        "rarity": BadgeRarity.EPIC,
        "condition_type": "xp_reached",
        "condition_value": 5000,
        "xp_bonus": 1000,
    },
]


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # --- Квесты ---
        quests_added = 0
        for data in QUESTS:
            exists = await db.scalar(
                select(Quest).where(Quest.title == data["title"])
            )
            if not exists:
                db.add(Quest(**data, status=QuestStatus.ACTIVE))
                quests_added += 1

        # --- Бейджи ---
        badges_added = 0
        for data in BADGES:
            exists = await db.scalar(
                select(Badge).where(Badge.name == data["name"])
            )
            if not exists:
                db.add(Badge(**data))
                badges_added += 1

        await db.commit()

    await engine.dispose()

    print(f"✅ Seed завершён: квесты +{quests_added}, бейджи +{badges_added}")
    if quests_added == 0 and badges_added == 0:
        print("ℹ️  Все данные уже существуют, дубликаты не созданы.")


if __name__ == "__main__":
    asyncio.run(seed())
