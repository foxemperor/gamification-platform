"""
Seed — создание пользователей при старте сервиса
=====================================================
Идемпотентно: если пользователь уже есть — ничего не делает.

Структура дев-пользователей (покрывает все сценарии MemberScope):

  Участник               email                        role      project        department    manager
  ────────────────────  ─────────────────────────────  ────────  ─────────────  ────────────  ───────
  Alice Manager        alice@gamequest.dev            manager   Phoenix        Backend       —
  Bob Developer        bob@gamequest.dev              employee  Phoenix        Backend       Alice
  Carol Developer      carol@gamequest.dev            employee  Phoenix        Backend       Alice
  Dave Developer       dave@gamequest.dev             employee  Phoenix        Backend       Alice
  Eve Developer        eve@gamequest.dev              employee  Phoenix        Backend       Alice
  Frank (other dept)   frank@gamequest.dev            employee  Phoenix        Frontend      Alice
  Grace (other proj)   grace@gamequest.dev            employee  Horizon        QA            —
  Henry (no org)       henry@gamequest.dev            employee  —              —             —
  devuser (legacy)     dev@test.com                   employee  Phoenix        Backend       Alice
  Ivan Manager         ivan@gamequest.dev             manager   Horizon        Backend       —
  Julia Developer      julia@gamequest.dev            employee  Horizon        Backend       Ivan
  Kevin Developer      kevin@gamequest.dev            employee  Horizon        Backend       Ivan
  Laura QA             laura@gamequest.dev            employee  Horizon        QA            Ivan
  Mike Frontend        mike@gamequest.dev             employee  Phoenix        Frontend      Alice
  Nina Designer        nina@gamequest.dev             employee  Phoenix        Design        Alice
  Oscar DevOps         oscar@gamequest.dev            employee  Phoenix        DevOps        Alice
  Polina PM            polina@gamequest.dev           manager   Horizon        Management    —
  Roman QA             roman@gamequest.dev            employee  Phoenix        QA            Alice
  Sara Backend         sara@gamequest.dev             employee  Horizon        Backend       Ivan
  Tom Analyst          tom@gamequest.dev              employee  Horizon        Analytics     Ivan

Scope-покрытие:
  all        → все 20 + superuser = 21 запись
  project    → Phoenix: 9, Horizon: 9
  department → Phoenix/Backend: Alice, Bob, Carol, Dave, Eve, devuser = 6
  team       → для Bob: все с manager_id=Alice.id + Bob = 8
"""

import logging
from datetime import date
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
    """Идемпотентно создаёт суперюзера если его нет."""
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
        "manager_email": None,
        "xp": 1500,
        "level": 5,
        "birthday": date(1990, 3, 15),
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
        "birthday": date(1995, 7, 22),
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
        "xp": 620,
        "level": 2,
        "birthday": date(1997, 11, 8),
    },
    {
        "email": "dave@gamequest.dev",
        "username": "dave_dev",
        "password": "Dave1234!",
        "full_name": "Dave Kozlov",
        "role": "employee",
        "project": "Phoenix",
        "department": "Backend",
        "position": "Junior Backend Developer",
        "manager_email": "alice@gamequest.dev",
        "xp": 250,
        "level": 1,
        "birthday": date(2000, 2, 28),
    },
    {
        "email": "eve@gamequest.dev",
        "username": "eve_dev",
        "password": "Eve12345!",
        "full_name": "Eve Morozova",
        "role": "employee",
        "project": "Phoenix",
        "department": "Backend",
        "position": "Backend Developer",
        "manager_email": "alice@gamequest.dev",
        "xp": 910,
        "level": 3,
        "birthday": date(1994, 9, 5),
    },
    # --- Phoenix / другой отдел ---
    {
        "email": "frank@gamequest.dev",
        "username": "frank_dev",
        "password": "Frank123!",
        "full_name": "Frank Volkov",
        "role": "employee",
        "project": "Phoenix",
        "department": "Frontend",
        "position": "Frontend Developer",
        "manager_email": "alice@gamequest.dev",
        "xp": 540,
        "level": 2,
        "birthday": date(1993, 6, 17),
    },
    # --- Phoenix / Mike Frontend ---
    {
        "email": "mike@gamequest.dev",
        "username": "mike_frontend",
        "password": "Mike1234!",
        "full_name": "Mike Novikov",
        "role": "employee",
        "project": "Phoenix",
        "department": "Frontend",
        "position": "Senior Frontend Developer",
        "manager_email": "alice@gamequest.dev",
        "xp": 1120,
        "level": 4,
        "birthday": date(1991, 12, 3),
    },
    # --- Phoenix / Nina Design ---
    {
        "email": "nina@gamequest.dev",
        "username": "nina_design",
        "password": "Nina1234!",
        "full_name": "Nina Popova",
        "role": "employee",
        "project": "Phoenix",
        "department": "Design",
        "position": "UI/UX Designer",
        "manager_email": "alice@gamequest.dev",
        "xp": 730,
        "level": 3,
        "birthday": date(1996, 4, 20),
    },
    # --- Phoenix / Oscar DevOps ---
    {
        "email": "oscar@gamequest.dev",
        "username": "oscar_devops",
        "password": "Oscar123!",
        "full_name": "Oscar Lebedev",
        "role": "employee",
        "project": "Phoenix",
        "department": "DevOps",
        "position": "DevOps Engineer",
        "manager_email": "alice@gamequest.dev",
        "xp": 860,
        "level": 3,
        "birthday": date(1989, 8, 11),
    },
    # --- Phoenix / Roman QA ---
    {
        "email": "roman@gamequest.dev",
        "username": "roman_qa",
        "password": "Roman123!",
        "full_name": "Roman Kuznetsov",
        "role": "employee",
        "project": "Phoenix",
        "department": "QA",
        "position": "QA Engineer",
        "manager_email": "alice@gamequest.dev",
        "xp": 480,
        "level": 2,
        "birthday": date(1998, 1, 14),
    },
    # --- Менеджер проекта Horizon/Backend ---
    {
        "email": "ivan@gamequest.dev",
        "username": "ivan_manager",
        "password": "Ivan1234!",
        "full_name": "Ivan Sokolov",
        "role": "manager",
        "project": "Horizon",
        "department": "Backend",
        "position": "Tech Lead",
        "manager_email": None,
        "xp": 2100,
        "level": 6,
        "birthday": date(1987, 5, 30),
    },
    # --- Сотрудники Horizon/Backend (подчиняются Ivan) ---
    {
        "email": "julia@gamequest.dev",
        "username": "julia_dev",
        "password": "Julia123!",
        "full_name": "Julia Smirnova",
        "role": "employee",
        "project": "Horizon",
        "department": "Backend",
        "position": "Backend Developer",
        "manager_email": "ivan@gamequest.dev",
        "xp": 970,
        "level": 3,
        "birthday": date(1994, 10, 25),
    },
    {
        "email": "kevin@gamequest.dev",
        "username": "kevin_dev",
        "password": "Kevin123!",
        "full_name": "Kevin Orlov",
        "role": "employee",
        "project": "Horizon",
        "department": "Backend",
        "position": "Senior Backend Developer",
        "manager_email": "ivan@gamequest.dev",
        "xp": 1340,
        "level": 4,
        "birthday": date(1992, 3, 7),
    },
    {
        "email": "sara@gamequest.dev",
        "username": "sara_dev",
        "password": "Sara1234!",
        "full_name": "Sara Fedorova",
        "role": "employee",
        "project": "Horizon",
        "department": "Backend",
        "position": "Backend Developer",
        "manager_email": "ivan@gamequest.dev",
        "xp": 660,
        "level": 2,
        "birthday": date(1999, 7, 16),
    },
    # --- Horizon / Laura QA ---
    {
        "email": "laura@gamequest.dev",
        "username": "laura_qa",
        "password": "Laura123!",
        "full_name": "Laura Zhukova",
        "role": "employee",
        "project": "Horizon",
        "department": "QA",
        "position": "QA Lead",
        "manager_email": "ivan@gamequest.dev",
        "xp": 1050,
        "level": 4,
        "birthday": date(1993, 2, 19),
    },
    # --- Horizon / Tom Analytics ---
    {
        "email": "tom@gamequest.dev",
        "username": "tom_analyst",
        "password": "Tom12345!",
        "full_name": "Tom Vasiliev",
        "role": "employee",
        "project": "Horizon",
        "department": "Analytics",
        "position": "Data Analyst",
        "manager_email": "ivan@gamequest.dev",
        "xp": 590,
        "level": 2,
        "birthday": date(1996, 9, 12),
    },
    # --- Horizon / Polina PM ---
    {
        "email": "polina@gamequest.dev",
        "username": "polina_pm",
        "password": "Polina12!",
        "full_name": "Polina Sorokina",
        "role": "manager",
        "project": "Horizon",
        "department": "Management",
        "position": "Product Manager",
        "manager_email": None,
        "xp": 1750,
        "level": 5,
        "birthday": date(1988, 11, 1),
    },
    # --- Grace (другой проект, QA) ---
    {
        "email": "grace@gamequest.dev",
        "username": "grace_qa",
        "password": "Grace123!",
        "full_name": "Grace Titova",
        "role": "employee",
        "project": "Horizon",
        "department": "QA",
        "position": "QA Engineer",
        "manager_email": None,
        "xp": 310,
        "level": 1,
        "birthday": date(2001, 6, 8),
    },
    # --- Henry (без организации) ---
    {
        "email": "henry@gamequest.dev",
        "username": "henry_noorg",
        "password": "Henry123!",
        "full_name": "Henry Belov",
        "role": "employee",
        "project": None,
        "department": None,
        "position": None,
        "manager_email": None,
        "xp": 0,
        "level": 1,
        "birthday": date(2002, 4, 3),
    },
    # --- devuser (legacy) ---
    {
        "email": "dev@test.com",
        "username": "devuser",
        "password": "DevTest1!",
        "full_name": "Dev User",
        "role": "employee",
        "project": "Phoenix",
        "department": "Backend",
        "position": "Backend Developer",
        "manager_email": "alice@gamequest.dev",
        "xp": 450,
        "level": 2,
        "birthday": date(1992, 8, 14),
    },
]


async def seed_dev_users() -> None:
    """Идемпотентно создаёт набор дев-пользователей."""
    async with AsyncSessionLocal() as session:
        # --- Проход 1: создаём пользователей без manager_id ---
        email_to_user: dict[str, User] = {}
        for u in _DEV_USERS:
            result = await session.execute(
                select(User).where(User.email == u["email"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                email_to_user[u["email"]] = existing
                logger.info(f"⏭  Already exists: {u['email']}")
                continue

            user = User(
                email=u["email"],
                username=u["username"],
                hashed_password=hash_password(u["password"]),
                full_name=u["full_name"],
                role=u["role"],
                project=u.get("project"),
                department=u.get("department"),
                position=u.get("position"),
                xp=u.get("xp", 0),
                level=u.get("level", 1),
                birthday=u.get("birthday"),
                is_active=True,
                is_verified=True,
            )
            session.add(user)
            email_to_user[u["email"]] = user
            logger.info(f"🌱 Created: {u['email']}")

        await session.flush()  # получаем id до commit

        # --- Проход 2: подвязываем manager_id ---
        for u in _DEV_USERS:
            mgr_email = u.get("manager_email")
            if not mgr_email:
                continue
            user_obj = email_to_user.get(u["email"])
            mgr_obj = email_to_user.get(mgr_email)
            if user_obj and mgr_obj and user_obj.manager_id is None:
                user_obj.manager_id = mgr_obj.id

        await session.commit()
        logger.info("✅ Dev users seed complete")
