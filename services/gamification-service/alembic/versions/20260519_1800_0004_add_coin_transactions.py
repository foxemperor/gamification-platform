"""OBSOLETE — coin_transactions перенесена в 0001

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-19 18:00:00
"""
from typing import Sequence, Union
from alembic import op

revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Таблица coin_transactions теперь создаётся в миграции 0001.
    # Этот файл оставлен только для сохранения цепочки revision в alembic_version.
    # Если таблица уже есть (свежая БД от 0001) — ничего не делаем.
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'gamification'
                  AND table_name = 'coin_transactions'
            ) THEN
                RAISE EXCEPTION 'coin_transactions missing — run from scratch';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    pass
