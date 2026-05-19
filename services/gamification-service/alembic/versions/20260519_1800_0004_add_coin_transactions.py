"""OBSOLETE — coin_transactions перенесена в 0001

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-19 18:00:00
"""
from typing import Sequence, Union

revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
