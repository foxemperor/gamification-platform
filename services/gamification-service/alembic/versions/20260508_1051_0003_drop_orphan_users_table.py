"""Drop orphan users table from gamification_db

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-08 10:51:00
"""
from typing import Sequence, Union
from alembic import op

revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Таблица users — дубликат из auth_db, создана старым create_all.
    # Gamification Service работает только с user_id (UUID), хранить
    # пользователей здесь не нужно.
    op.drop_table('users')


def downgrade() -> None:
    # Восстанавливать не нужно — таблица была лишней
    pass
