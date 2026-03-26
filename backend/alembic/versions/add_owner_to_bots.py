"""add owner_discord_id to bots

Revision ID: d4e5f6a7b8c3
Revises: c3d4e5f6a7b2
Create Date: 2026-03-27 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c3'
down_revision: Union[str, None] = 'c3d4e5f6a7b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bots', sa.Column('owner_discord_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('bots', 'owner_discord_id')
