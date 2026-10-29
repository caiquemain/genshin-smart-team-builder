from ..database import SessionLocal
from ..models import TeamTemplate, Character, Weapon, ArtifactSet
from .team_templates import TEAM_TEMPLATES
from .team_templates_batch2 import TEAM_TEMPLATES_BATCH2


ALL_TEMPLATES = TEAM_TEMPLATES + TEAM_TEMPLATES_BATCH2


def seed_templates() -> None:
    db = SessionLocal()
    try:
        valid_chars = {c.slug for c in db.query(Character.slug).all()}
        valid_weapons = {w.slug for w in db.query(Weapon.slug).all()}
        valid_artifacts = {a.slug for a in db.query(ArtifactSet.slug).all()}

        inserted = 0
        skipped = 0
        invalid_chars = 0
        invalid_weapons = 0
        invalid_artifacts = 0
        for t in ALL_TEMPLATES:
            if db.query(TeamTemplate).filter(TeamTemplate.name == t["name"]).one_or_none():
                skipped += 1
                continue

            chars_ok = all(s in valid_chars for s in t["character_slugs"])
            weapon_ok = not t.get("weapon_slug") or t["weapon_slug"] in valid_weapons
            artifact_ok = not t.get("artifact_set_slug") or t["artifact_set_slug"] in valid_artifacts

            if not chars_ok:
                missing = [s for s in t["character_slugs"] if s not in valid_chars]
                print(f"[templates] PULANDO {t['name']!r}: chars ausentes {missing}")
                invalid_chars += 1
                continue
            if not weapon_ok:
                print(f"[templates] AVISO {t['name']!r}: weapon {t['weapon_slug']!r} não existe (mantendo sem weapon)")
                t["weapon_slug"] = None
                invalid_weapons += 1
            if not artifact_ok:
                print(f"[templates] AVISO {t['name']!r}: artifact {t['artifact_set_slug']!r} não existe (mantendo sem artifact)")
                t["artifact_set_slug"] = None
                invalid_artifacts += 1

            db.add(TeamTemplate(**t))
            inserted += 1

        db.commit()
        total = db.query(TeamTemplate).count()
        print(f"[templates] inserted={inserted} skipped={skipped} total={total}")
        print(f"[templates] inválidos: chars={invalid_chars} weapons={invalid_weapons} artifacts={invalid_artifacts}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_templates()
