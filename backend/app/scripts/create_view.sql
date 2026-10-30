-- Recria a view v_tierlist_consensus (idempotente).
-- Espelhado em alembic/versions/e5f6a7b8c9d0_add_tierlist_aggregator.py.
-- Útil pra dev rápido sem rodar migration inteira.

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
LEFT JOIN tiers_sorted ts ON ts.character_slug = a.character_slug;
