"""
add birthday to users

Revision ID: 20260624_0003
Revises: 0002_add_manager_id
Create Date: 2026-06-24 11:21:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260624_0003'
down_revision = '0002_add_manager_id'
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
