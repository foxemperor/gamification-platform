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
    # 1. Создаём ENUM-тип coinsource
    coinsource = postgresql.ENUM(
        'quest', 'badge', 'admin', 'penalty',
        name='coinsource',
        schema=SCHEMA,
        create_type=True,
    )
    coinsource.create(op.get_bind(), checkfirst=True)

    # 2. Создаём таблицу coin_transactions
    op.create_table(
        'coin_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column(
            'source',
            sa.Enum('quest', 'badge', 'admin', 'penalty',
                    name='coinsource', schema=SCHEMA, create_type=False),
            nullable=False,
        ),
        sa.Column('source_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('description', sa.String(300), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
        ),
        schema=SCHEMA,
    )

    # 3. Индекс по user_id для быстрых выборок
    op.create_index(
        'ix_coin_transactions_user_id',
        'coin_transactions',
        ['user_id'],
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_index('ix_coin_transactions_user_id',
                  table_name='coin_transactions', schema=SCHEMA)
    op.drop_table('coin_transactions', schema=SCHEMA)
    op.execute(f'DROP TYPE IF EXISTS {SCHEMA}.coinsource')
