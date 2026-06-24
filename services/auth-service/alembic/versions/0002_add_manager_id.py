"""add manager_id to users

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

SCHEMA = "auth"


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "manager_id",
            UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        schema=SCHEMA,
    )
    op.create_index("ix_users_manager_id", "users", ["manager_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_index("ix_users_manager_id", table_name="users", schema=SCHEMA)
    op.drop_column("users", "manager_id", schema=SCHEMA)
