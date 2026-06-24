"""
Seed — создание пользователей при старте сервиса
=====================================================
Идемпотентно: если пользователь уже есть — ничего не делает.

Структура дев-пользователей (покрывает все сценарии MemberScope):

  Участник               email                      role      project        department    manager
  ────────────────────  ───────────────────────────  ────────  ─────────────  ────────────  ───────
  Alice Manager        alice@gamequest.dev        manager   Phoenix        Backend       —
  Bob Developer        bob@gamequest.dev          employee  Phoenix        Backend       Alice
  Carol Developer      carol@gamequest.dev        employee  Phoenix        Backend       Alice
  Dave Developer       dave@gamequest.dev         employee  Phoenix        Backend       Alice
  Eve Developer        eve@gamequest.dev          employee  Phoenix        Backend       Alice
  Frank (other dept)   frank@gamequest.dev        employee  Phoenix        Frontend      Alice
  Grace (other proj)   grace@gamequest.dev        employee  Horizon        QA            —
  Henry (no org)       henry@gamequest.dev        employee  —              —             —
  devuser (legacy)     dev@test.com               employee  Phoenix        Backend       Alice

Scope-покрытие:
  all        → все 9 + superuser = 10 записей
  project    → 6 (все Phoenix)
  department → 6 (Phoenix/Backend: Alice, Bob, Carol, Dave, Eve, devuser)
  team       → для Bob: все с manager_id=Alice.id (Bob, Carol, Dave, Eve, devuser) + сам Bob = 6
             → для Alice (manager): все, у кого manager_id=Alice.id = 6 записей
"""

import logging
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import User
from app.security import hash_password
from app.config import settings

logger = logging.getLogger("auth-service.seed")


# ---------------------------------------------------------------------------
# Суперюзер
# ---------------------------------------------------------------------------

async def create_superuser() -> None:
    """Idемпотентно создаёт суперюзера если его нет."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.email == settings.SUPERUSER_EMAIL)
        )
        if result.scalar_one_or_none():
            logger.info(f"✅ Superuser already exists: {settings.SUPERUSER_EMAIL}")
            return

        superuser = User(
            email=settings.SUPERUSER_EMAIL,
            username=settings.SUPERUSER_USERNAME,
            hashed_password=hash_password(settings.SUPERUSER_PASSWORD),
            full_name="Administrator",
            role="admin",
            department="Administration",
            project="Internal",
            is_active=True,
            is_verified=True,
            is_superuser=True,
        )
        session.add(superuser)
        await session.commit()
        logger.info(f"🌱 Superuser created: {settings.SUPERUSER_EMAIL}")


# ---------------------------------------------------------------------------
# Дев-пользователи — полная оргструктура
# ---------------------------------------------------------------------------

# Описание пользователей. manager_id заполняется в два прохода:
# 1) создаём всех без manager_id
# 2) подвязываем manager_id по email-ключу
_DEV_USERS: list[dict] = [
    # --- Менеджер проекта Phoenix/Backend ---
    {
        "email": "alice@gamequest.dev",
        "username": "alice_manager",
        "password": "Alice123!",
        "full_name": "Alice Ivanova",
        "role": "manager",
        "project": "Phoenix",
        "department": "Backend",
        "position": "Team Lead",
        "manager_email": None,  # у менеджера нет manager_id
        "xp": 1500,
        "level": 5,
    },
    # --- Сотрудники Phoenix/Backend (подчиняются Alice) ---
    {
        "email": "bob@gamequest.dev",
        "username": "bob_dev",
        "password": "Bob12345!",
        "full_name": "Bob Petrov",
        "role": "employee",
        "project": "Phoenix",
        "department": "Backend",
        "position": "Backend Developer",
        "manager_email": "alice@gamequest.dev",
        "xp": 800,
        "level": 3,
    },
    {
        "email": "carol@gamequest.dev",
        "username": "carol_dev",
        "password": "Carol123!",
        "full_name": "Carol Sidorova",
        "role": "employee",
        "project": "Phoenix",
        "department": "Backend",
        "position": "Backend Developer",
        "manager_email": "alice@gamequest.dev",
        "xp": 650,
        "level": 3,
    },
    {
        "email": "dave@gamequest.dev",
        "username": "dave_dev",
        "password": "Dave1234!",
        "full_name": "Dave Kozlov",
        "role": "employee",
        "project": "Phoenix",
        "department": "Backend",
        "position": "Junior Developer",
        "manager_email": "alice@gamequest.dev",
        "xp": 200,
        "level": 1,
    },
    {
        "email": "eve@gamequest.dev",
        "username": "eve_dev",
        "password": "Eve12345!",
        "full_name": "Eve Morozova",
        "role": "employee",
        "project": "Phoenix",
        "department": "Backend",
        "position": "Middle Developer",
        "manager_email": "alice@gamequest.dev",
        "xp": 950,
        "level": 4,
    },
    # --- Сотрудник Phoenix/Frontend (другой отдел, тот же проект) ---
    {
        "email": "frank@gamequest.dev",
        "username": "frank_dev",
        "password": "Frank123!",
        "full_name": "Frank Novikov",
        "role": "employee",
        "project": "Phoenix",
        "department": "Frontend",
        "position": "Frontend Developer",
        "manager_email": None,  # нет менеджера в системе
        "xp": 400,
        "level": 2,
    },
    # --- Сотрудник другого проекта Horizon/QA ---
    {
        "email": "grace@gamequest.dev",
        "username": "grace_qa",
        "password": "Grace123!",
        "full_name": "Grace Volkova",
        "role": "employee",
        "project": "Horizon",
        "department": "QA",
        "position": "QA Engineer",
        "manager_email": None,
        "xp": 300,
        "level": 2,
    },
    # --- Пользователь без оргструктуры (edge-case) ---
    {
        "email": "henry@gamequest.dev",
        "username": "henry_dev",
        "password": "Henry123!",
        "full_name": "Henry Zaitsev",
        "role": "employee",
        "project": None,
        "department": None,
        "position": None,
        "manager_email": None,
        "xp": 0,
        "level": 1,
    },
    # --- Старый devuser (обратная совместимость) — тоже в Phoenix/Backend ---
    {
        "email": settings.DEV_USER_EMAIL,          # dev@test.com
        "username": settings.DEV_USER_USERNAME,    # devuser
        "password": settings.DEV_USER_PASSWORD,    # DevPass123!
        "full_name": "Dev User",
        "role": "employee",
        "project": "Phoenix",
        "department": "Backend",
        "position": "Developer (dev)",
        "manager_email": "alice@gamequest.dev",
        "xp": 100,
        "level": 1,
    },
]


async def create_dev_users() -> None:
    """
    Идемпотентно создаёт набор тестовых пользователей.
    Создаётся ТОЛЬКО когда ENVIRONMENT == "development" AND SEED_DEV_USER == True.
    """
    if settings.ENVIRONMENT != "development" or not settings.SEED_DEV_USER:
        return

    async with AsyncSessionLocal() as session:
        # --- Проход 1: создаём всех пользователей без manager_id ---
        email_to_user: dict[str, User] = {}

        for data in _DEV_USERS:
            result = await session.execute(
                select(User).where(User.email == data["email"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                logger.info(f"✅ Dev user already exists: {data['email']}")
                email_to_user[data["email"]] = existing
                continue

            user = User(
                email=data["email"],
                username=data["username"],
                hashed_password=hash_password(data["password"]),
                full_name=data["full_name"],
                role=data["role"],
                project=data.get("project"),
                department=data.get("department"),
                position=data.get("position"),
                xp=data.get("xp", 0),
                level=data.get("level", 1),
                is_active=True,
                is_verified=True,
                is_superuser=False,
                # manager_id заполняем на втором проходе
            )
            session.add(user)
            email_to_user[data["email"]] = user
            logger.info(f"🌱 Dev user queued: {data['email']}")

        await session.commit()

        # --- Проход 2: подвязываем manager_id ---
        needs_manager = [
            (data["email"], data["manager_email"])
            for data in _DEV_USERS
            if data.get("manager_email") is not None
        ]

        if needs_manager:
            # Перечитываем всех участников из БД, чтобы получить актуальные id
            all_emails = {d["email"] for d in _DEV_USERS}
            res = await session.execute(
                select(User).where(User.email.in_(all_emails))
            )
            db_users: dict[str, User] = {u.email: u for u in res.scalars().all()}

            for user_email, manager_email in needs_manager:
                u = db_users.get(user_email)
                m = db_users.get(manager_email)
                if u and m and u.manager_id != m.id:
                    u.manager_id = m.id
                    session.add(u)
                    logger.info(f"🔗 manager_id: {user_email} → {manager_email}")

            await session.commit()

    logger.info(
        "🌱 Dev users seed complete. "
        f"Login as Bob: bob@gamequest.dev / Bob12345! "
        f"or Manager Alice: alice@gamequest.dev / Alice123!"
    )
