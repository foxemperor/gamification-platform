"""
add coin_transactions table and coinsource enum

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-19 18:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None

SCHEMA = 'gamification'


def upgrade() -> None:
    # 1. Создаём ENUM-тип coinsource (если вдруг уже есть — пропускаем)
    op.execute(f"""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE t.typname = 'coinsource'
                  AND n.nspname = '{SCHEMA}'
            ) THEN
                CREATE TYPE {SCHEMA}.coinsource AS ENUM ('quest', 'badge', 'admin', 'penalty');
            END IF;
        END $$;
    """)

    # 2. Создаём таблицу coin_transactions (если вдруг уже есть — пропускаем)
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.coin_transactions (
            id          UUID        NOT NULL PRIMARY KEY,
            user_id     UUID        NOT NULL,
            amount      INTEGER     NOT NULL,
            source      {SCHEMA}.coinsource NOT NULL,
            source_id   UUID,
            description VARCHAR(300),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)

    # 3. Индекс по user_id
    op.execute(f"""
        CREATE INDEX IF NOT EXISTS ix_coin_transactions_user_id
        ON {SCHEMA}.coin_transactions (user_id);
    """)


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {SCHEMA}.ix_coin_transactions_user_id")
    op.execute(f"DROP TABLE IF EXISTS {SCHEMA}.coin_transactions")
    op.execute(f"DROP TYPE IF EXISTS {SCHEMA}.coinsource")
