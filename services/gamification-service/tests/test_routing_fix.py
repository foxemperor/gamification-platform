"""
Тесты для фиксов сессии 3:
  - Admin quests/badges/xp endpoints должны отвечать (ранее шли в auth-service → 404)
  - XP transactions endpoint возвращает список
  - Маршрутизация users/xp-bulk работает корректно

Bug #4: admin/quests → "Квестов не найдено" (шло в auth-service)
Bug #5: admin/badges → "Бейджей не найдено" (шло в auth-service)
Bug #6: admin/xp/transactions → "Not Found" (шло в auth-service)
"""

from __future__ import annotations

import uuid
import pytest

pytestmark = pytest.mark.asyncio


# =========================================================
# Bug #4: Admin quests endpoint работает (не 404)
# =========================================================

async def test_admin_quests_returns_list(client, admin_headers):
    """GET /api/v1/admin/quests → 200, список квестов (может быть пустым)."""
    resp = await client.get("/api/v1/admin/quests", headers=admin_headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert "items" in body, "Ответ должен содержать 'items'"
    assert "total" in body, "Ответ должен содержать 'total'"
    assert isinstance(body["items"], list)


async def test_admin_quests_create_and_list(client, admin_headers):
    """Создаём квест через admin endpoint → он появляется в списке."""
    # Создаём квест
    resp = await client.post(
        "/api/v1/admin/quests",
        json={
            "title": "Routing Fix Quest",
            "description": "Test quest for routing fix",
            "quest_type": "personal",
            "difficulty": "easy",
            "xp_reward": 50,
            "coins_reward": 5,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, f"Create quest failed: {resp.text}"
    created_id = resp.json()["id"]

    # Проверяем что квест появился в списке
    resp = await client.get("/api/v1/admin/quests", headers=admin_headers)
    assert resp.status_code == 200
    ids = [q["id"] for q in resp.json()["items"]]
    assert created_id in ids, "Созданный квест должен быть в списке"


# =========================================================
# Bug #5: Admin badges endpoint работает (не 404)
# =========================================================

async def test_admin_badges_returns_list(client, admin_headers):
    """GET /api/v1/admin/badges → 200, список бейджей."""
    resp = await client.get("/api/v1/admin/badges", headers=admin_headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert "items" in body
    assert isinstance(body["items"], list)


async def test_admin_badges_create_and_list(client, admin_headers):
    """Создаём бейдж через admin endpoint → он появляется в списке."""
    badge_name = f"Test Badge {uuid.uuid4().hex[:6]}"
    resp = await client.post(
        "/api/v1/admin/badges",
        json={
            "name": badge_name,
            "description": "Routing fix badge",
            "icon_url": "https://example.com/badge.png",
            "condition": "test_condition",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, f"Create badge failed: {resp.text}"
    created_id = resp.json()["id"]

    # Проверяем что бейдж появился в списке
    resp = await client.get("/api/v1/admin/badges", headers=admin_headers)
    assert resp.status_code == 200
    ids = [b["id"] for b in resp.json()["items"]]
    assert created_id in ids, "Созданный бейдж должен быть в списке"


# =========================================================
# Bug #6: Admin XP transactions endpoint работает (не 404)
# =========================================================

async def test_admin_xp_transactions_returns_list(client, admin_headers):
    """GET /api/v1/admin/xp/transactions → 200, список транзакций."""
    resp = await client.get("/api/v1/admin/xp/transactions", headers=admin_headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert "items" in body
    assert "total" in body
    assert isinstance(body["items"], list)


async def test_admin_xp_grant_appears_in_transactions(client, admin_headers):
    """Начисляем XP → транзакция появляется в журнале."""
    user_id = str(uuid.uuid4())

    # Начисляем XP
    resp = await client.post(
        "/api/v1/admin/xp/grant",
        json={"user_id": user_id, "amount": 100, "description": "Routing test grant"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, f"Grant XP failed: {resp.text}"
    tx_id = resp.json()["id"]

    # Проверяем что транзакция в журнале
    resp = await client.get(
        f"/api/v1/admin/xp/transactions?user_id={user_id}",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    tx_ids = [tx["id"] for tx in body["items"]]
    assert tx_id in tx_ids, "Созданная транзакция должна быть в журнале"


async def test_admin_xp_transactions_filter_by_user(client, admin_headers):
    """Фильтрация транзакций по user_id работает корректно."""
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    # Начисляем XP обоим
    for uid, amount in [(user_a, 150), (user_b, 250)]:
        resp = await client.post(
            "/api/v1/admin/xp/grant",
            json={"user_id": uid, "amount": amount, "description": "Filter test"},
            headers=admin_headers,
        )
        assert resp.status_code == 201

    # Фильтруем только user_a
    resp = await client.get(
        f"/api/v1/admin/xp/transactions?user_id={user_a}",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    # Все транзакции должны принадлежать user_a
    for tx in body["items"]:
        assert tx["user_id"] == user_a, f"Найдена транзакция чужого пользователя: {tx}"


# =========================================================
# users/xp-bulk маршрутизируется в gamification-service
# =========================================================

async def test_users_xp_bulk_accessible(client, admin_headers):
    """POST /api/v1/admin/users/xp-bulk → 200 (не 404)."""
    resp = await client.post(
        "/api/v1/admin/users/xp-bulk",
        json={"user_ids": [str(uuid.uuid4())]},
        headers=admin_headers,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert "users" in body


async def test_admin_quests_requires_admin(client, user_headers):
    """Обычный пользователь → 403 для всех admin-квестов."""
    resp = await client.get("/api/v1/admin/quests", headers=user_headers)
    assert resp.status_code == 403


async def test_admin_badges_requires_admin(client, user_headers):
    """Обычный пользователь → 403 для admin-бейджей."""
    resp = await client.get("/api/v1/admin/badges", headers=user_headers)
    assert resp.status_code == 403


async def test_admin_xp_transactions_requires_admin(client, user_headers):
    """Обычный пользователь → 403 для XP транзакций."""
    resp = await client.get("/api/v1/admin/xp/transactions", headers=user_headers)
    assert resp.status_code == 403
