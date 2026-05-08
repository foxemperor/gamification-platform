"""Создание таблицы users + поля department/project

Revision ID: 0001
Revises: 
Create Date: 2026-05-08 09:54:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True, index=True),
        sa.Column('username', sa.String(50), nullable=False, unique=True, index=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        # Профиль
        sa.Column('full_name', sa.String(100), nullable=True),
        sa.Column('avatar_url', sa.Text, nullable=True),
        sa.Column('bio', sa.Text, nullable=True),
        # Организационная принадлежность
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('project', sa.String(100), nullable=True),
        # Роль
        sa.Column('role', sa.String(20), nullable=False, server_default='employee'),
        # Геймификация
        sa.Column('xp', sa.Integer, nullable=False, server_default='0'),
        sa.Column('level', sa.Integer, nullable=False, server_default='1'),
        sa.Column('coins', sa.Integer, nullable=False, server_default='0'),
        # Статус
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('is_verified', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('is_superuser', sa.Boolean, nullable=False, server_default='false'),
        # Таймстампы
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_users_email',    'users', ['email'],    unique=True)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_id',       'users', ['id'],       unique=False)


def downgrade() -> None:
    op.drop_index('ix_users_email',    table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_index('ix_users_id',       table_name='users')
    op.drop_table('users')
