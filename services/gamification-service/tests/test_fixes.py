"""
Тесты для трёх исправленных проблем (сессия 2):
  1. bulk XP endpoint — GET /admin/users должен возвращать реальный XP
  2. accept_quest — повторный accept и UniqueConstraint
  3. accept_quest — корректный HTTP-статус при конфликте (409)

Покрывают все три бага:
  Bug #1: 0 XP / уровень 1 в панели Пользователи
  Bug #3: ошибка при нажатии «Принять» квест
"""

from __future__ import annotations

import uuid

import pytest


pytestmark = pytest.mark.asyncio


# =========================================================
# Bug #1: Bulk XP endpoint
# POST /api/v1/admin/users/xp-bulk
# =========================================================


async def test_bulk_xp_empty_list(client, admin_headers):
    """Пустой список → пустой ответ, 200."""
    resp = await client.post(
        "/api/v1/admin/users/xp-bulk",
        json={"user_ids": []},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["users"] == []


async def test_bulk_xp_unknown_users(client, admin_headers):
    """Пользователи без XP-транзакций → xp=0, level=1."""
    uid1 = str(uuid.uuid4())
    uid2 = str(uuid.uuid4())

    resp = await client.post(
        "/api/v1/admin/users/xp-bulk",
        json={"user_ids": [uid1, uid2]},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["users"]) == 2

    for entry in body["users"]:
        assert entry["xp"] == 0
        assert entry["level"] == 1


async def test_bulk_xp_with_real_xp(client, admin_headers):
    """Пользователь с начисленным XP → реальные xp и level > 1."""
    user_id = str(uuid.uuid4())

    # Начисляем XP через grant
    resp = await client.post(
        "/api/v1/admin/xp/grant",
        json={"user_id": user_id, "amount": 500, "description": "Test XP"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    # Проверяем bulk endpoint
    resp = await client.post(
        "/api/v1/admin/users/xp-bulk",
        json={"user_ids": [user_id]},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["users"]) == 1

    entry = body["users"][0]
    assert entry["user_id"] == user_id
    assert entry["xp"] == 500
    # 500 XP → уровень > 1 (первый уровень требует 100 XP)
    assert entry["level"] > 1


async def test_bulk_xp_mixed_users(client, admin_headers):
    """Смешанный список: один с XP, другой без."""
    user_with_xp = str(uuid.uuid4())
    user_without_xp = str(uuid.uuid4())

    # Начисляем только первому
    resp = await client.post(
        "/api/v1/admin/xp/grant",
        json={"user_id": user_with_xp, "amount": 200},
        headers=admin_headers,
    )
    assert resp.status_code == 201

    resp = await client.post(
        "/api/v1/admin/users/xp-bulk",
        json={"user_ids": [user_with_xp, user_without_xp]},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    entries = {e["user_id"]: e for e in body["users"]}

    assert entries[user_with_xp]["xp"] == 200
    assert entries[user_with_xp]["level"] >= 1

    assert entries[user_without_xp]["xp"] == 0
    assert entries[user_without_xp]["level"] == 1


async def test_bulk_xp_requires_admin(client, user_headers):
    """Обычный пользователь → 403."""
    resp = await client.post(
        "/api/v1/admin/users/xp-bulk",
        json={"user_ids": [str(uuid.uuid4())]},
        headers=user_headers,
    )
    assert resp.status_code == 403


# =========================================================
# Bug #3: Accept Quest — UniqueConstraint + повторный accept
# POST /api/v1/quests/{quest_id}/accept
# =========================================================


async def _create_active_quest(client, admin_headers) -> str:
    """Вспомогательный: создаёт активный квест, возвращает его id."""
    resp = await client.post(
        "/api/v1/admin/quests",
        json={
            "title": "Test Quest",
            "description": "For testing",
            "quest_type": "personal",
            "difficulty": "easy",
            "xp_reward": 100,
            "coins_reward": 10,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def test_accept_quest_first_time(client, admin_headers, user_headers):
    """Первый accept → 201, правильный ответ."""
    quest_id = await _create_active_quest(client, admin_headers)

    resp = await client.post(
        f"/api/v1/quests/{quest_id}/accept",
        headers=user_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["quest_id"] == quest_id
    assert "принят" in body["message"].lower()


async def test_accept_quest_already_in_progress_returns_409(
    client, admin_headers, user_headers
):
    """Повторный accept того же квеста (IN_PROGRESS) → 409."""
    quest_id = await _create_active_quest(client, admin_headers)

    # Первый accept
    resp = await client.post(
        f"/api/v1/quests/{quest_id}/accept",
        headers=user_headers,
    )
    assert resp.status_code == 201

    # Второй accept того же квеста — должен вернуть 409, не 500
    resp = await client.post(
        f"/api/v1/quests/{quest_id}/accept",
        headers=user_headers,
    )
    assert resp.status_code == 409, f"Expected 409, got {resp.status_code}: {resp.text}"
    assert "процессе" in resp.json()["detail"].lower()


async def test_accept_quest_not_found(client, user_headers):
    """Несуществующий квест → 404."""
    fake_id = str(uuid.uuid4())
    resp = await client.post(
        f"/api/v1/quests/{fake_id}/accept",
        headers=user_headers,
    )
    assert resp.status_code == 404


async def test_accept_quest_requires_auth(client):
    """Без токена → 401 или 403."""
    fake_id = str(uuid.uuid4())
    resp = await client.post(f"/api/v1/quests/{fake_id}/accept")
    assert resp.status_code in (401, 403)


async def test_accept_completed_quest_resets_to_in_progress(
    client, admin_headers, user_headers
):
    """
    После завершения квеста (complete) можно принять его снова.
    Статус сбрасывается в IN_PROGRESS.
    """
    quest_id = await _create_active_quest(client, admin_headers)

    # Принять
    resp = await client.post(
        f"/api/v1/quests/{quest_id}/accept",
        headers=user_headers,
    )
    assert resp.status_code == 201

    # Завершить
    resp = await client.post(
        f"/api/v1/quests/{quest_id}/complete",
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text

    # Принять снова — должно работать, возвращать 201
    resp = await client.post(
        f"/api/v1/quests/{quest_id}/accept",
        headers=user_headers,
    )
    assert resp.status_code == 201, f"Re-accept failed: {resp.status_code}: {resp.text}"
    body = resp.json()
    assert body["quest_id"] == quest_id

    # Убеждаемся что квест снова IN_PROGRESS
    resp = await client.get("/api/v1/quests/my", headers=user_headers)
    assert resp.status_code == 200
    my_quests = resp.json()
    in_progress = [q for q in my_quests if q["quest_id"] == quest_id and q["status"] == "in_progress"]
    assert len(in_progress) == 1, "Квест должен быть IN_PROGRESS после повторного принятия"


async def test_my_quests_returns_list(client, user_headers):
    """GET /api/v1/quests/my → 200, список (может быть пустым)."""
    resp = await client.get("/api/v1/quests/my", headers=user_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_my_quests_requires_auth(client):
    """Без токена → 401 или 403."""
    resp = await client.get("/api/v1/quests/my")
    assert resp.status_code in (401, 403)
