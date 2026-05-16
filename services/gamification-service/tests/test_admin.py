"""
Тесты административных эндпоинтов Gamification Service.
Покрывают CRUD квестов и бейджей, выдачу XP, журнал транзакций
и проверку что обычный пользователь получает 403.
"""

from __future__ import annotations

import uuid

import pytest


pytestmark = pytest.mark.asyncio


# ===================================
# Авторизация
# ===================================

async def test_quests_list_requires_auth(client):
    resp = await client.get("/api/v1/admin/quests")
    assert resp.status_code in (401, 403)


async def test_user_token_gets_403(client, user_headers):
    resp = await client.get("/api/v1/admin/quests", headers=user_headers)
    assert resp.status_code == 403


async def test_gateway_header_grants_admin(client, gateway_headers):
    resp = await client.get("/api/v1/admin/quests", headers=gateway_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_gateway_role_header_grants_admin(client):
    resp = await client.get(
        "/api/v1/admin/badges", headers={"X-User-Role": "admin"}
    )
    assert resp.status_code == 200


async def test_public_create_quest_requires_admin(client, user_headers):
    payload = {"title": "Quest 1", "xp_reward": 100, "coins_reward": 5}
    resp = await client.post("/api/v1/quests", json=payload, headers=user_headers)
    assert resp.status_code == 403


# ===================================
# CRUD квестов
# ===================================

async def test_quests_full_crud(client, admin_headers):
    # Create
    resp = await client.post(
        "/api/v1/admin/quests",
        json={
            "title": "Daily standup",
            "description": "Прийти на стендап",
            "quest_type": "daily",
            "difficulty": "easy",
            "xp_reward": 50,
            "coins_reward": 5,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    created = resp.json()
    quest_id = created["id"]
    assert created["title"] == "Daily standup"
    assert created["xp_reward"] == 50

    # List
    resp = await client.get("/api/v1/admin/quests", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == quest_id

    # Search filter
    resp = await client.get(
        "/api/v1/admin/quests",
        params={"search": "standup"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    resp = await client.get(
        "/api/v1/admin/quests",
        params={"search": "nonexistent-marker"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 0

    # Update
    resp = await client.patch(
        f"/api/v1/admin/quests/{quest_id}",
        json={"title": "Daily standup updated", "status": "archived", "xp_reward": 75},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    updated = resp.json()
    assert updated["title"] == "Daily standup updated"
    assert updated["status"] == "archived"
    assert updated["xp_reward"] == 75

    # Delete
    resp = await client.delete(
        f"/api/v1/admin/quests/{quest_id}", headers=admin_headers
    )
    assert resp.status_code == 204

    resp = await client.get("/api/v1/admin/quests", headers=admin_headers)
    assert resp.json()["total"] == 0


async def test_update_missing_quest_returns_404(client, admin_headers):
    resp = await client.patch(
        f"/api/v1/admin/quests/{uuid.uuid4()}",
        json={"title": "X" * 5},
        headers=admin_headers,
    )
    assert resp.status_code == 404


# ===================================
# CRUD бейджей
# ===================================

async def test_badges_full_crud(client, admin_headers):
    resp = await client.post(
        "/api/v1/admin/badges",
        json={
            "name": "First Quest",
            "description": "Выполни первый квест",
            "rarity": "common",
            "condition_type": "quests_completed",
            "condition_value": 1,
            "xp_bonus": 25,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    created = resp.json()
    badge_id = created["id"]
    assert created["name"] == "First Quest"

    # Дубль по name → 409
    resp = await client.post(
        "/api/v1/admin/badges",
        json={"name": "First Quest"},
        headers=admin_headers,
    )
    assert resp.status_code == 409

    # List + поиск
    resp = await client.get(
        "/api/v1/admin/badges", params={"search": "First"}, headers=admin_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == badge_id

    # Update
    resp = await client.patch(
        f"/api/v1/admin/badges/{badge_id}",
        json={"description": "Обновлённое описание", "xp_bonus": 50},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["description"] == "Обновлённое описание"
    assert updated["xp_bonus"] == 50

    # Delete
    resp = await client.delete(
        f"/api/v1/admin/badges/{badge_id}", headers=admin_headers
    )
    assert resp.status_code == 204


async def test_badges_user_forbidden(client, user_headers):
    resp = await client.post(
        "/api/v1/admin/badges",
        json={"name": "Hacker"},
        headers=user_headers,
    )
    assert resp.status_code == 403


# ===================================
# XP grant + журнал
# ===================================

async def test_xp_grant_and_filter(client, admin_headers):
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    # Положительная транзакция
    resp = await client.post(
        "/api/v1/admin/xp/grant",
        json={"user_id": user_a, "amount": 250, "description": "Bonus"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    tx_a = resp.json()
    assert tx_a["amount"] == 250
    assert tx_a["source"] == "admin"
    assert tx_a["description"] == "Bonus"

    # Отрицательная — penalty
    resp = await client.post(
        "/api/v1/admin/xp/grant",
        json={"user_id": user_a, "amount": -50, "description": "Late"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    tx_pen = resp.json()
    assert tx_pen["source"] == "penalty"

    # Транзакция другого пользователя
    resp = await client.post(
        "/api/v1/admin/xp/grant",
        json={"user_id": user_b, "amount": 10},
        headers=admin_headers,
    )
    assert resp.status_code == 201

    # Список — все
    resp = await client.get(
        "/api/v1/admin/xp/transactions", headers=admin_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3

    # Фильтрация по user_id
    resp = await client.get(
        "/api/v1/admin/xp/transactions",
        params={"user_id": user_a},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert all(item["user_id"] == user_a for item in body["items"])

    # Фильтрация по source
    resp = await client.get(
        "/api/v1/admin/xp/transactions",
        params={"source": "penalty"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["source"] == "penalty"


async def test_xp_grant_user_forbidden(client, user_headers):
    resp = await client.post(
        "/api/v1/admin/xp/grant",
        json={"user_id": str(uuid.uuid4()), "amount": 100},
        headers=user_headers,
    )
    assert resp.status_code == 403


async def test_xp_grant_validation(client, admin_headers):
    # amount выходит за границу (> 50000) → 422
    resp = await client.post(
        "/api/v1/admin/xp/grant",
        json={"user_id": str(uuid.uuid4()), "amount": 99999},
        headers=admin_headers,
    )
    assert resp.status_code == 422

    # amount выходит за границу (< -50000) → 422
    resp = await client.post(
        "/api/v1/admin/xp/grant",
        json={"user_id": str(uuid.uuid4()), "amount": -99999},
        headers=admin_headers,
    )
    assert resp.status_code == 422

    # пропущен обязательный user_id → 422
    resp = await client.post(
        "/api/v1/admin/xp/grant",
        json={"amount": 10},
        headers=admin_headers,
    )
    assert resp.status_code == 422
