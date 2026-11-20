"""add weapon obtain_source and text_translations cache table

Revision ID: h3c4d5e6f7a8
Revises: g2b3c4d5e6f7
Create Date: 2026-11-20

Adiciona:
- `weapons.obtain_source`: origem de obtenção da arma (gacha_limited, gacha,
  craftable, event, battle_pass, fishing, starglitter, quest, world).
- `text_translations`: cache persistente de traduções de notas/textos de guias
  (KQM, Game8, GameWith, Genshin.gg, Helper Sheet) por SHA-256 + idioma.
"""
from alembic import op
import sqlalchemy as sa

revision = "h3c4d5e6f7a8"
down_revision = "g2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "weapons",
        sa.Column("obtain_source", sa.String(length=32), nullable=True),
    )
    op.create_index("ix_weapons_obtain_source", "weapons", ["obtain_source"], unique=False)

    op.create_table(
        "text_translations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("target_lang", sa.String(length=10), nullable=False),
        sa.Column("source_text", sa.Text(), nullable=False),
        sa.Column("translated_text", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default="google"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("source_hash", "target_lang", name="uq_text_trans_hash_lang"),
    )
    op.create_index(
        "ix_text_translations_lang_hash",
        "text_translations",
        ["target_lang", "source_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_text_translations_lang_hash", table_name="text_translations")
    op.drop_table("text_translations")
    op.drop_index("ix_weapons_obtain_source", table_name="weapons")
    op.drop_column("weapons", "obtain_source")
