"""add manager_id to users

Revision ID: 0002_add_manager_id
Revises: 0001_initial
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0002_add_manager_id"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "manager_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_users_manager_id", "users", ["manager_id"])


def downgrade() -> None:
    op.drop_index("ix_users_manager_id", table_name="users")
    op.drop_column("users", "manager_id")
