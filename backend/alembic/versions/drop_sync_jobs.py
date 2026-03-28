"""drop sync_jobs table

Revision ID: d1e2f3a4b5c6
Revises: c3d4e5f6a7b2
Create Date: 2026-03-28 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('sync_jobs')


def downgrade() -> None:
    op.create_table(
        'sync_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('server_id', sa.Integer(), nullable=True),
        sa.Column('source_path', sa.String(length=512), nullable=False),
        sa.Column('dest_path', sa.String(length=512), nullable=False),
        sa.Column('last_run', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_status', sa.String(length=64), nullable=True),
        sa.Column('scheduled', sa.Boolean(), nullable=True),
        sa.Column('dry_run', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['server_id'], ['servers.id']),
    )
