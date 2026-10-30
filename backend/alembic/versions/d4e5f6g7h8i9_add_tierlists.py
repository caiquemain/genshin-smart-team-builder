"""add tierlists

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-10-31
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6g7h8i9'
down_revision = 'c3d4e5f6g7h8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tierlist_sites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('slug', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('url', sa.String(length=300), nullable=False),
        sa.Column('scale_size', sa.Integer(), nullable=False),
        sa.Column('last_scraped_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tierlist_sites_slug', 'tierlist_sites', ['slug'], unique=True)

    op.create_table(
        'tierlist_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('site_id', sa.Integer(), nullable=False),
        sa.Column('character_slug', sa.String(length=100), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('tier_label', sa.String(length=20), nullable=False),
        sa.Column('tier_index', sa.Integer(), nullable=False),
        sa.Column('normalized_value', sa.Float(), nullable=False),
        sa.Column('version', sa.String(length=20), nullable=True),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['site_id'], ['tierlist_sites.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('site_id', 'character_slug', 'role', 'version', name='uq_tierlist_entry'),
    )
    op.create_index('ix_tierlist_entries_character_slug', 'tierlist_entries', ['character_slug'])
    op.create_index('ix_tierlist_entries_role', 'tierlist_entries', ['role'])


def downgrade():
    op.drop_index('ix_tierlist_entries_role', 'tierlist_entries')
    op.drop_index('ix_tierlist_entries_character_slug', 'tierlist_entries')
    op.drop_table('tierlist_entries')
    op.drop_index('ix_tierlist_sites_slug', 'tierlist_sites')
    op.drop_table('tierlist_sites')
