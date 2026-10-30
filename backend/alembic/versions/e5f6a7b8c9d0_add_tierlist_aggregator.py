"""add tierlist aggregator: tier_master, consensus view, sites, travelers

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6g7h8i9
Create Date: 2026-10-30

Idempotente: usa IF NOT EXISTS / ON CONFLICT. Pode rodar em banco já
populado sem duplicar nem quebrar.
"""
from alembic import op


revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6g7h8i9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Coluna tier_master (master 6-tier: S+/S/A/B/C/D)
    op.execute("""
        ALTER TABLE tierlist_entries
        ADD COLUMN IF NOT EXISTS tier_master VARCHAR(10)
    """)

    # 2. Fix game8.scale_size (estava 5, correto é 7)
    op.execute("""
        UPDATE tierlist_sites SET scale_size = 7
        WHERE slug = 'game8' AND scale_size <> 7
    """)

    # 3. Site genshin-gg (não estava cadastrado)
    op.execute("""
        INSERT INTO tierlist_sites (slug, name, url, scale_size)
        VALUES ('genshin-gg', 'Genshin.gg', 'https://genshin.gg/tier-list/', 5)
        ON CONFLICT (slug) DO NOTHING
    """)

    # 4. Travelers (7 variantes, stats placeholder — user vai refinar 1:1)
    op.execute("""
        INSERT INTO characters
            (slug, name, rarity, element, weapon_type, icon,
             base_hp, base_atk, base_def, max_hp, max_atk, max_def)
        VALUES
            ('traveler-anemo',   'Traveler (Anemo)',   5, 'anemo',   'sword',
             '/travelers/traveler-anemo.png',
             912, 18, 57, 10875, 212, 683),
            ('traveler-geo',     'Traveler (Geo)',     5, 'geo',     'sword',
             '/travelers/traveler-geo.png',
             912, 18, 57, 10875, 212, 683),
            ('traveler-electro', 'Traveler (Electro)', 5, 'electro', 'sword',
             '/travelers/traveler-electro.png',
             912, 18, 57, 10875, 212, 683),
            ('traveler-dendro',  'Traveler (Dendro)',  5, 'dendro',  'sword',
             '/travelers/traveler-dendro.png',
             912, 18, 57, 10875, 212, 683),
            ('traveler-hydro',   'Traveler (Hydro)',   5, 'hydro',   'sword',
             '/travelers/traveler-hydro.png',
             912, 18, 57, 10875, 212, 683),
            ('traveler-pyro',    'Traveler (Pyro)',    5, 'pyro',    'sword',
             '/travelers/traveler-pyro.png',
             912, 18, 57, 10875, 212, 683),
            ('traveler-cryo',    'Traveler (Cryo)',    5, 'cryo',    'sword',
             '/travelers/traveler-cryo.png',
             912, 18, 57, 10875, 212, 683)
        ON CONFLICT (name) DO NOTHING
    """)

    # 5. View de consenso (fonte do frontend /tierlist)
    # Espelhada em backend/app/scripts/create_view.sql
    op.execute("""
        CREATE OR REPLACE VIEW v_tierlist_consensus AS
        WITH per_entry AS (
            SELECT character_slug, role, tier_master, normalized_value, site_id
            FROM tierlist_entries
            WHERE tier_master IS NOT NULL
        ),
        agg AS (
            SELECT
                character_slug,
                COUNT(*) AS votes,
                COUNT(DISTINCT site_id) AS site_count,
                AVG(normalized_value)::float AS avg_normalized,
                MIN(normalized_value)::float AS min_normalized,
                MAX(normalized_value)::float AS max_normalized
            FROM per_entry
            GROUP BY character_slug
        ),
        tier_counts AS (
            SELECT character_slug, tier_master, COUNT(*) AS cnt
            FROM per_entry
            GROUP BY character_slug, tier_master
        ),
        consensus_tier AS (
            SELECT DISTINCT ON (character_slug)
                character_slug,
                tier_master AS consensus_tier,
                cnt AS consensus_votes
            FROM tier_counts
            ORDER BY character_slug, cnt DESC,
                CASE tier_master WHEN 'S+' THEN 1 WHEN 'S' THEN 2 WHEN 'A' THEN 3
                                 WHEN 'B' THEN 4 WHEN 'C' THEN 5 WHEN 'D' THEN 6 END
        ),
        dominant_role AS (
            SELECT DISTINCT ON (character_slug)
                character_slug, role
            FROM per_entry
            WHERE role IS NOT NULL
            GROUP BY character_slug, role
            ORDER BY character_slug, COUNT(*) DESC,
                CASE role WHEN 'main_dps' THEN 1 WHEN 'sub_dps' THEN 2
                          WHEN 'support' THEN 3 ELSE 4 END
        ),
        tiers_sorted AS (
            SELECT character_slug,
                   array_agg(tier_master ORDER BY
                        CASE tier_master WHEN 'S+' THEN 1 WHEN 'S' THEN 2 WHEN 'A' THEN 3
                                         WHEN 'B' THEN 4 WHEN 'C' THEN 5 WHEN 'D' THEN 6 END
                   ) AS tiers_voted
            FROM (SELECT DISTINCT character_slug, tier_master FROM per_entry) d
            GROUP BY character_slug
        )
        SELECT
            a.character_slug,
            c.name,
            c.element,
            c.rarity,
            c.icon,
            a.votes,
            a.site_count,
            dr.role AS dominant_role,
            ct.consensus_tier,
            ct.consensus_votes,
            CASE
                WHEN a.avg_normalized >= 0.9 THEN 'S+'
                WHEN a.avg_normalized >= 0.7 THEN 'S'
                WHEN a.avg_normalized >= 0.5 THEN 'A'
                WHEN a.avg_normalized >= 0.3 THEN 'B'
                WHEN a.avg_normalized >= 0.1 THEN 'C'
                ELSE 'D'
            END AS tier_by_avg,
            a.avg_normalized,
            a.min_normalized,
            a.max_normalized,
            (a.max_normalized - a.min_normalized)::float AS spread,
            ts.tiers_voted
        FROM agg a
        LEFT JOIN characters c ON c.slug = a.character_slug
        LEFT JOIN consensus_tier ct ON ct.character_slug = a.character_slug
        LEFT JOIN dominant_role dr ON dr.character_slug = a.character_slug
        LEFT JOIN tiers_sorted ts ON ts.character_slug = a.character_slug
    """)

    # 6. Icons dos travelers (fix pontual: Yatta não tem variantes por elemento,
    #    Mobalytics CDN tem. Idempotente — só atualiza quem não tem URL ainda.)
    op.execute("""
        UPDATE characters SET icon = CASE slug
            WHEN 'traveler-anemo'   THEN '/travelers/traveler-anemo.png'
            WHEN 'traveler-geo'     THEN '/travelers/traveler-geo.png'
            WHEN 'traveler-electro' THEN '/travelers/traveler-electro.png'
            WHEN 'traveler-dendro'  THEN '/travelers/traveler-dendro.png'
            WHEN 'traveler-hydro'   THEN '/travelers/traveler-hydro.png'
            WHEN 'traveler-pyro'    THEN '/travelers/traveler-pyro.png'
            WHEN 'traveler-cryo'    THEN '/travelers/traveler-cryo.png'
        END
        WHERE slug LIKE 'traveler-%' AND (icon IS NULL OR icon NOT LIKE 'http%')
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_tierlist_consensus")
    op.execute("ALTER TABLE tierlist_entries DROP COLUMN IF EXISTS tier_master")
    # Não removemos travelers, sites nem entries — podem estar em uso
    # (team_characters, presets, etc). Rollback seguro exige dropar dados
    # em ordem de dependência; fora do escopo dessa migration.
