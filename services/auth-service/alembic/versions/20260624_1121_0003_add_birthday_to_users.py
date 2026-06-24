"""
add birthday to users

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-24 11:21:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('birthday', sa.Date(), nullable=True),
        schema='auth',
    )


def downgrade() -> None:
    op.drop_column('users', 'birthday', schema='auth')
