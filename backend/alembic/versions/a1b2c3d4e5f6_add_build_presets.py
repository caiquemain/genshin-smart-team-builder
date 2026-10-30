"""add build presets

Revision ID: a1b2c3d4e5f6
Revises: fb1aa6e3f965
Create Date: 2026-10-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a1b2c3d4e5f6'
down_revision = 'fb1aa6e3f965'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('character_build_presets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('character_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('build_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.add_column('team_characters', sa.Column('preset_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_team_characters_preset_id', 'team_characters', 'character_build_presets', ['preset_id'], ['id'], ondelete='SET NULL')

def downgrade():
    op.drop_constraint('fk_team_characters_preset_id', 'team_characters', type_='foreignkey')
    op.drop_column('team_characters', 'preset_id')
    op.drop_table('character_build_presets')
