"""add icon to reactions

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-10-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6g7h8'
down_revision = 'b2c3d4e5f6g7'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('elemental_reactions', sa.Column('icon', sa.String(length=150), nullable=True))

def downgrade():
    op.drop_column('elemental_reactions', 'icon')
