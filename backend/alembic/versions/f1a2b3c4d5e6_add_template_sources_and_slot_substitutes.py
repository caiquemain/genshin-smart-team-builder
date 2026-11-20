"""add multi-source sources and slot_substitutes to team_templates

Revision ID: f1a2b3c4d5e6
Revises: 2041a237fb91
Create Date: 2026-11-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "2041a237fb91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "team_templates",
        sa.Column("sources", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column(
        "team_templates",
        sa.Column("slot_substitutes", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    # Backfill sources a partir de source/source_url já existentes
    op.execute(
        """
        UPDATE team_templates
        SET sources = jsonb_build_array(
            jsonb_build_object(
                'source', COALESCE(source, 'KQM'),
                'url', source_url
            )
        )
        WHERE sources = '[]'::jsonb
        """
    )


def downgrade() -> None:
    op.drop_column("team_templates", "slot_substitutes")
    op.drop_column("team_templates", "sources")
