"""Начальная схема Gamification Service (актуальная, консолидированная)

Revision ID: 0001
Revises: -
Create Date: 2026-05-08 10:44:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = 'gamification'


def upgrade() -> None:
    op.execute(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"')

    # ── character_types ──
    op.create_table(
        'character_types',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('slug', sa.Enum('warrior','mage','rogue','engineer', name='charactertypeslugs', schema=SCHEMA), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('icon_url', sa.String(500), nullable=True),
        sa.Column('coin_multiplier_base', sa.Float, nullable=False, server_default='1.0'),
        sa.Column('xp_multiplier_base', sa.Float, nullable=False, server_default='1.0'),
        sa.Column('bonus_description', sa.String(300), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('slug', name='uq_character_types_slug'),
        schema=SCHEMA,
    )

    # ── characters ──
    op.create_table(
        'characters',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('character_type_id', postgresql.UUID(as_uuid=False),
                  sa.ForeignKey(f'{SCHEMA}.character_types.id'), nullable=False),
        sa.Column('level', sa.Integer, nullable=False, server_default='1'),
        sa.Column('experience', sa.Integer, nullable=False, server_default='0'),
        sa.Column('coin_multiplier', sa.Float, nullable=False, server_default='1.0'),
        sa.Column('xp_multiplier', sa.Float, nullable=False, server_default='1.0'),
        sa.Column('skin_color', sa.String(7), nullable=True, server_default="'#F5C5A3'"),
        sa.Column('hair_color', sa.String(7), nullable=True, server_default="'#2C1810'"),
        sa.Column('eyes_color', sa.String(7), nullable=True, server_default="'#4A90D9'"),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', name='uq_characters_user_id'),
        schema=SCHEMA,
    )
    op.create_index('ix_characters_user_id', 'characters', ['user_id'], schema=SCHEMA)

    # ── cosmetic_items ──
    op.create_table(
        'cosmetic_items',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('preview_url', sa.String(500), nullable=True),
        sa.Column('slot', sa.Enum(
            'hair','head','head_accessory','eyes','face_expression',
            'torso','torso_accessory','legs','weapon_main','weapon_secondary',
            name='cosmeticslot', schema=SCHEMA
        ), nullable=False),
        sa.Column('rarity', sa.Enum('common','rare','epic','legendary', name='badgerarity', schema=SCHEMA), nullable=False, server_default="'common'"),
        sa.Column('visibility', sa.Enum('open','locked','hidden', name='cosmeticvisibility', schema=SCHEMA), nullable=False, server_default="'open'"),
        sa.Column('unlock_type', sa.Enum('none','quest','achievement','level','admin', name='unlocktype', schema=SCHEMA), nullable=False, server_default="'none'"),
        sa.Column('unlock_ref', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('unlock_value', sa.Integer, nullable=True),
        sa.Column('allowed_character_types', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('slug', name='uq_cosmetic_items_slug'),
        schema=SCHEMA,
    )
    op.create_index('ix_cosmetic_items_slot', 'cosmetic_items', ['slot'], schema=SCHEMA)
    op.create_index('ix_cosmetic_items_visibility', 'cosmetic_items', ['visibility'], schema=SCHEMA)

    # ── character_equipment ──
    op.create_table(
        'character_equipment',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('character_id', postgresql.UUID(as_uuid=False),
                  sa.ForeignKey(f'{SCHEMA}.characters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('cosmetic_item_id', postgresql.UUID(as_uuid=False),
                  sa.ForeignKey(f'{SCHEMA}.cosmetic_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('slot', sa.Enum(
            'hair','head','head_accessory','eyes','face_expression',
            'torso','torso_accessory','legs','weapon_main','weapon_secondary',
            name='cosmeticslot', schema=SCHEMA
        ), nullable=False),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('equipped_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('character_id', 'slot', name='uq_character_slot'),
        schema=SCHEMA,
    )
    op.create_index('ix_character_equipment_character', 'character_equipment', ['character_id'], schema=SCHEMA)

    # ── unlocked_cosmetics ──
    op.create_table(
        'unlocked_cosmetics',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('cosmetic_item_id', postgresql.UUID(as_uuid=False),
                  sa.ForeignKey(f'{SCHEMA}.cosmetic_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('unlocked_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('unlocked_by', postgresql.UUID(as_uuid=False), nullable=True),
        sa.UniqueConstraint('user_id', 'cosmetic_item_id', name='uq_user_cosmetic'),
        schema=SCHEMA,
    )
    op.create_index('ix_unlocked_cosmetics_user', 'unlocked_cosmetics', ['user_id'], schema=SCHEMA)

    # ── quests ──
    op.create_table(
        'quests',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('quest_type', sa.Enum('personal','team','daily','skill','integration', name='questtype', schema=SCHEMA), nullable=False, server_default="'personal'"),
        sa.Column('difficulty', sa.Enum('easy','medium','hard','epic', name='questdifficulty', schema=SCHEMA), nullable=False, server_default="'medium'"),
        sa.Column('status', sa.Enum('draft','active','archived', name='queststatus', schema=SCHEMA), nullable=False, server_default="'active'"),
        sa.Column('xp_reward', sa.Integer, nullable=False, server_default='150'),
        sa.Column('coins_reward', sa.Integer, nullable=False, server_default='10'),
        sa.Column('time_limit_hours', sa.Integer, nullable=True),
        sa.Column('integration_trigger', sa.String(100), nullable=True),
        sa.Column('integration_target', sa.Integer, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_index('ix_quests_status', 'quests', ['status'], schema=SCHEMA)
    op.create_index('ix_quests_type', 'quests', ['quest_type'], schema=SCHEMA)

    # ── user_quests ──
    op.create_table(
        'user_quests',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('quest_id', postgresql.UUID(as_uuid=False),
                  sa.ForeignKey(f'{SCHEMA}.quests.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.Enum('in_progress','completed','failed','abandoned', name='userqueststatus', schema=SCHEMA), nullable=False, server_default="'in_progress'"),
        sa.Column('progress', sa.Integer, nullable=False, server_default='0'),
        sa.Column('target', sa.Integer, nullable=False, server_default='1'),
        sa.Column('is_viewed', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deadline_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('user_id', 'quest_id', name='uq_user_quest'),
        schema=SCHEMA,
    )
    op.create_index('ix_user_quests_user_status', 'user_quests', ['user_id', 'status'], schema=SCHEMA)

    # ── badges ──
    op.create_table(
        'badges',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('icon_url', sa.String(500), nullable=True),
        sa.Column('rarity', sa.Enum('common','rare','epic','legendary', name='badgerarity', schema=SCHEMA), nullable=False, server_default="'common'"),
        sa.Column('condition_type', sa.String(50), nullable=True),
        sa.Column('condition_value', sa.Integer, nullable=True),
        sa.Column('xp_bonus', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('name', name='uq_badges_name'),
        schema=SCHEMA,
    )

    # ── user_badges ──  (is_new добавлен согласно модели)
    op.create_table(
        'user_badges',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('badge_id', postgresql.UUID(as_uuid=False),
                  sa.ForeignKey(f'{SCHEMA}.badges.id', ondelete='CASCADE'), nullable=False),
        sa.Column('earned_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('granted_by', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('is_revoked', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('is_new', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('user_id', 'badge_id', name='uq_user_badge'),
        schema=SCHEMA,
    )

    # ── xp_transactions ──
    op.create_table(
        'xp_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('source', sa.Enum(
            'quest','badge','github_commit','github_pr','jira_task','admin','penalty','character_level',
            name='xpsource', schema=SCHEMA
        ), nullable=False),
        sa.Column('source_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('description', sa.String(300), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_index('ix_xp_transactions_user_created', 'xp_transactions', ['user_id', 'created_at'], schema=SCHEMA)

    # ── coin_transactions ──
    op.create_table(
        'coin_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('source', sa.Enum(
            'quest','badge','admin','penalty',
            name='coinsource', schema=SCHEMA
        ), nullable=False),
        sa.Column('source_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('description', sa.String(300), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_index('ix_coin_transactions_user_id', 'coin_transactions', ['user_id'], schema=SCHEMA)

    # ── leaderboard_snapshots ──
    op.create_table(
        'leaderboard_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('full_name', sa.String(150), nullable=True),
        sa.Column('total_xp', sa.Integer, nullable=False, server_default='0'),
        sa.Column('level', sa.Integer, nullable=False, server_default='1'),
        sa.Column('total_coins', sa.Integer, nullable=False, server_default='0'),
        sa.Column('quests_completed', sa.Integer, nullable=False, server_default='0'),
        sa.Column('badges_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('rank', sa.Integer, nullable=False, server_default='0'),
        sa.Column('period', sa.String(20), nullable=False),
        sa.Column('snapshot_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_index('ix_leaderboard_period_rank', 'leaderboard_snapshots', ['period', 'rank'], schema=SCHEMA)
    op.create_index('ix_leaderboard_user_period', 'leaderboard_snapshots', ['user_id', 'period'], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table('leaderboard_snapshots', schema=SCHEMA)
    op.drop_table('coin_transactions', schema=SCHEMA)
    op.drop_table('xp_transactions', schema=SCHEMA)
    op.drop_table('user_badges', schema=SCHEMA)
    op.drop_table('badges', schema=SCHEMA)
    op.drop_table('user_quests', schema=SCHEMA)
    op.drop_table('quests', schema=SCHEMA)
    op.drop_table('unlocked_cosmetics', schema=SCHEMA)
    op.drop_table('character_equipment', schema=SCHEMA)
    op.drop_table('cosmetic_items', schema=SCHEMA)
    op.drop_table('characters', schema=SCHEMA)
    op.drop_table('character_types', schema=SCHEMA)
    op.execute(f'DROP SCHEMA IF EXISTS "{SCHEMA}" CASCADE')
