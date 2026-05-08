"""Удаление осиротевшей таблицы users из public-схемы
(была создана до введения изоляции по схемам)

Revision ID: 0003
Revises: 0001
Create Date: 2026-05-08 10:51:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0003'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Удаляем таблицу users из public-схемы если она там осталась
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'users'
            ) THEN
                DROP TABLE public.users CASCADE;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    pass  # Необратимо — таблица принадлежит auth-service
