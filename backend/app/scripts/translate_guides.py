#!/usr/bin/env python3
"""
translate_guides.py — Traduz em lote as notas e descrições vindas de guias externos
(KQM, Game8, GameWith, Genshin.gg, Helper Sheet) e salva no cache `text_translations`.

Provedores suportados (`--provider`):
  - auto   : usa `gemini` se GEMINI_API_KEY estiver setada, senão `deepl` se DEEPL_API_KEY, senão `google`
  - google : Google Translate gratuito (sem API key — usa endpoint HTTP público)
  - gemini : Google Gemini API (`GEMINI_API_KEY`, melhor qualidade para termos de Genshin)
  - deepl  : DeepL API Free/Pro (`DEEPL_API_KEY`, 500k caracteres/mês grátis)

Uso:
    # Ver quantas strings únicas precisam ser traduzidas (sem chamar API)
    python -m app.scripts.translate_guides --lang pt --dry-run

    # Traduzir para PT usando Google Translate gratuito (sem chave)
    python -m app.scripts.translate_guides --lang pt --provider google

    # Traduzir para PT usando Gemini (melhor qualidade gamer/Genshin)
    GEMINI_API_KEY=... python -m app.scripts.translate_guides --lang pt --provider gemini

    # Traduzir para ES usando DeepL Free
    DEEPL_API_KEY=... python -m app.scripts.translate_guides --lang es --provider deepl
"""
from __future__ import annotations

import argparse
import json
import os
import re
import time
from typing import Sequence

import httpx

from app.database import SessionLocal
from app.models import CharacterBuildPreset, TeamCharacter, TeamTemplate, TextTranslation
from app.services.guide_i18n import (
    collect_build_data_texts,
    collect_substitutes_texts,
    normalize_source_text,
    text_hash,
)

LANG_NAMES = {
    "pt": "Brazilian Portuguese (pt-BR)",
    "es": "Spanish (es)",
    "fr": "French (fr)",
    "de": "German (de)",
    "jp": "Japanese (ja)",
    "kr": "Korean (ko)",
}

DEEPL_LANG_MAP = {
    "pt": "PT-BR",
    "es": "ES",
    "fr": "FR",
    "de": "DE",
    "jp": "JA",
    "kr": "KO",
}

GOOGLE_LANG_MAP = {
    "pt": "pt",
    "es": "es",
    "fr": "fr",
    "de": "de",
    "jp": "ja",
    "kr": "ko",
}

# Prefixos/frases que já estão em português geradas pelo próprio importador
_PT_HINTS_RE = re.compile(
    r"(?:^alternativa direta sugerida|^listado em categoria do kqm|^build importada de|"
    r"\b(?:personagem|personagens|substituto|substitutos|sinergia|habilidade|supremo|"
    r"dano elemental|recarga de energia|taxa cr[ií]tica|dano cr[ií]tico|profici[eê]ncia|"
    r"recomenda[çc][aã]o|melhor op[çc][aã]o|tamb[eé]m|voc[eê]|n[aã]o|para o time)\b)",
    re.IGNORECASE,
)

# Termos curtos de Genshin que NÃO devem ser traduzidos literalmente pelo Google/DeepL
_PROTECT_PATTERNS = [
    re.compile(r"\b(?:4pc|2pc|C[0-6]\+?|R[1-5]|ER%|CRIT|EM|HP%|ATK%|DEF%|DPS|Sub-DPS|F2P|BiS|AoE|ICD|ICD's|N[1-5]C|N[1-5]D)\b"),
]

# Pós-limpeza de glossário Genshin para traduções automáticas em PT-BR
_GLOSSARY_POST_PT: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bExplosão Elemental\b", re.IGNORECASE), "Supremo"),
    (re.compile(r"\bEstouro Elemental\b", re.IGNORECASE), "Supremo"),
    (re.compile(r"\bRajada Elemental\b", re.IGNORECASE), "Supremo"),
    (re.compile(r"\bHabilidade de Explosão\b", re.IGNORECASE), "Supremo"),
    (re.compile(r"\bTaxa de Crítico\b", re.IGNORECASE), "Taxa Crítica"),
    (re.compile(r"\bMaestria Elemental\b", re.IGNORECASE), "Proficiência Elemental"),
    (re.compile(r"\bfora do campo\b", re.IGNORECASE), "fora de campo"),
    (re.compile(r"\bno campo\b", re.IGNORECASE), "em campo"),
]


def looks_already_in_target_lang(text: str, target_lang: str) -> bool:
    norm = normalize_source_text(text)
    if len(norm) < 4:
        return True
    if target_lang == "pt" and _PT_HINTS_RE.search(norm):
        return True
    return False


def post_clean_translation(text: str, target_lang: str) -> str:
    out = text.strip()
    if target_lang == "pt":
        for pat, repl in _GLOSSARY_POST_PT:
            out = pat.sub(repl, out)
    return out


def _protect_tokens(text: str) -> tuple[str, dict[str, str]]:
    tokens: dict[str, str] = {}
    idx = 0

    def _repl(m: re.Match) -> str:
        nonlocal idx
        key = f"__GT{idx}__"
        tokens[key] = m.group(0)
        idx += 1
        return key

    protected = text
    for pat in _PROTECT_PATTERNS:
        protected = pat.sub(_repl, protected)
    return protected, tokens


def _restore_tokens(text: str, tokens: dict[str, str]) -> str:
    out = text
    for key, val in tokens.items():
        out = out.replace(key, val)
    return out


# ===== Provedores =====

def translate_batch_google(
    client: httpx.Client,
    texts: Sequence[str],
    target_lang: str,
    delay: float = 0.25,
) -> list[str]:
    """Traduz via endpoint gratuito do Google Translate (sem API key)."""
    tl = GOOGLE_LANG_MAP.get(target_lang, target_lang)
    results: list[str] = []
    for text in texts:
        protected, tok_map = _protect_tokens(text)
        resp = client.get(
            "https://translate.googleapis.com/translate_a/single",
            params={
                "client": "gtx",
                "sl": "en",
                "tl": tl,
                "dt": "t",
                "q": protected,
            },
            timeout=20.0,
        )
        resp.raise_for_status()
        data = resp.json()
        translated = "".join(part[0] for part in (data[0] or []) if part and part[0])
        translated = _restore_tokens(translated, tok_map)
        results.append(post_clean_translation(translated, target_lang))
        if delay > 0:
            time.sleep(delay)
    return results


def translate_batch_deepl(
    client: httpx.Client,
    texts: Sequence[str],
    target_lang: str,
    api_key: str,
) -> list[str]:
    """Traduz via DeepL REST API (suporta Free `:fx` e Pro automaticamente)."""
    tl = DEEPL_LANG_MAP.get(target_lang, target_lang.upper())
    base = "https://api-free.deepl.com" if api_key.endswith(":fx") else "https://api.deepl.com"
    protected_list = []
    tok_maps = []
    for t in texts:
        p, m = _protect_tokens(t)
        protected_list.append(p)
        tok_maps.append(m)

    resp = client.post(
        f"{base}/v2/translate",
        headers={"Authorization": f"DeepL-Auth-Key {api_key}"},
        json={
            "text": protected_list,
            "source_lang": "EN",
            "target_lang": tl,
        },
        timeout=30.0,
    )
    resp.raise_for_status()
    items = resp.json().get("translations") or []
    if len(items) != len(texts):
        raise RuntimeError(f"DeepL retornou {len(items)} traduções para {len(texts)} entradas")
    out: list[str] = []
    for item, tok_map in zip(items, tok_maps):
        restored = _restore_tokens(item.get("text", ""), tok_map)
        out.append(post_clean_translation(restored, target_lang))
    return out


def translate_batch_gemini(
    client: httpx.Client,
    texts: Sequence[str],
    target_lang: str,
    api_key: str,
    model: str = "gemini-2.5-flash",
) -> list[str]:
    """Traduz em lote via Gemini REST API com glossário de Genshin Impact."""
    lang_label = LANG_NAMES.get(target_lang, target_lang)
    prompt = (
        f"You are a professional Genshin Impact guide translator.\n"
        f"Translate each string in the JSON array below from English to {lang_label}.\n"
        "Rules:\n"
        "- Preserve exact Genshin Impact character names, weapon names, artifact set names, and abbreviations (ER, EM, CRIT, HP%, ATK%, DEF%, 4pc, 2pc, R1-R5, C0-C6, DPS, Sub-DPS, BiS, F2P, AoE).\n"
        "- For pt-BR use official/community Genshin terms: Elemental Skill -> Habilidade Elemental, Elemental Burst -> Supremo, Normal Attack -> Ataque Normal, Charged Attack -> Ataque Carregado, Plunging Attack -> Ataque Imersivo, Off-field -> fora de campo, On-field -> em campo, Elemental Mastery -> Proficiência Elemental, Energy Recharge -> Recarga de Energia.\n"
        "- Keep translations natural, concise, and faithful to the original technical meaning.\n"
        "- Return ONLY a valid JSON array of strings with the EXACT same length and order as the input array.\n\n"
        f"Input JSON array:\n{json.dumps(list(texts), ensure_ascii=False)}"
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    resp = client.post(
        url,
        params={"key": api_key},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    data = resp.json()
    raw_text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
        .strip()
    )
    # Remove eventuais cercas markdown ```json ... ```
    raw_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text, flags=re.DOTALL).strip()
    parsed = json.loads(raw_text)
    if not isinstance(parsed, list) or len(parsed) != len(texts):
        raise RuntimeError(
            f"Gemini retornou {len(parsed) if isinstance(parsed, list) else type(parsed).__name__} itens para lote de {len(texts)}"
        )
    return [post_clean_translation(str(x), target_lang) for x in parsed]


def collect_guide_strings(db) -> dict[str, str]:
    """Coleta todas as strings únicas de guias no banco: `{source_hash: normalized_text}`."""
    unique: dict[str, str] = {}

    def _add(raw: str | None) -> None:
        if not raw:
            return
        norm = normalize_source_text(raw)
        if not norm:
            return
        h = text_hash(norm)
        if h not in unique:
            unique[h] = norm

    for preset in db.query(CharacterBuildPreset).all():
        for txt in collect_build_data_texts(preset.build_data):
            _add(txt)

    for tc in db.query(TeamCharacter).all():
        for txt in collect_build_data_texts(tc.build_data):
            _add(txt)
        for txt in collect_substitutes_texts(tc.substitutes):
            _add(txt)

    for tpl in db.query(TeamTemplate).all():
        _add(tpl.description)
        _add(tpl.notes)
        for subs in (tpl.slot_substitutes or {}).values():
            for txt in collect_substitutes_texts(subs):
                _add(txt)

    return unique


def resolve_provider(requested: str) -> str:
    if requested != "auto":
        return requested
    if os.getenv("GEMINI_API_KEY"):
        return "gemini"
    if os.getenv("DEEPL_API_KEY"):
        return "deepl"
    return "google"


def main() -> None:
    ap = argparse.ArgumentParser(description="Traduz notas de guias em lote e salva no cache text_translations")
    ap.add_argument("--lang", default="pt", help="Idioma de destino (ex.: pt, es, fr)")
    ap.add_argument(
        "--provider",
        choices=["auto", "google", "gemini", "deepl"],
        default="auto",
        help="Provedor de tradução",
    )
    ap.add_argument("--gemini-model", default=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
    ap.add_argument("--batch-size", type=int, default=20, help="Strings por lote/checkpoint")
    ap.add_argument("--delay", type=float, default=0.25, help="Delay entre chamadas (segundos)")
    ap.add_argument("--limit", type=int, default=0, help="Máximo de strings a traduzir nesta execução (0 = todas)")
    ap.add_argument("--force", action="store_true", help="Re-traduz mesmo strings já presentes no cache")
    ap.add_argument("--dry-run", action="store_true", help="Apenas mostra quantas strings seriam traduzidas")
    args = ap.parse_args()

    provider = resolve_provider(args.provider)
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    deepl_key = os.getenv("DEEPL_API_KEY", "")
    if not args.dry_run:
        if provider == "gemini" and not gemini_key:
            raise SystemExit("❌ Defina GEMINI_API_KEY para usar --provider gemini (ou use --provider google)")
        if provider == "deepl" and not deepl_key:
            raise SystemExit("❌ Defina DEEPL_API_KEY para usar --provider deepl (ou use --provider google)")

    db = SessionLocal()
    try:
        all_strings = collect_guide_strings(db)
        existing_hashes = {
            h for (h,) in db.query(TextTranslation.source_hash).filter(
                TextTranslation.target_lang == args.lang
            ).all()
        }

        pending: list[tuple[str, str]] = []
        skipped_native = 0
        skipped_cached = 0
        for h, text in all_strings.items():
            if looks_already_in_target_lang(text, args.lang):
                skipped_native += 1
                continue
            if not args.force and h in existing_hashes:
                skipped_cached += 1
                continue
            pending.append((h, text))

        if args.limit > 0:
            pending = pending[:args.limit]

        total_chars = sum(len(t) for _, t in pending)
        print(
            f"🌐 [translate_guides] lang={args.lang} · provider={provider} · "
            f"total_únicas={len(all_strings)} · já_em_{args.lang}={skipped_native} · "
            f"em_cache={skipped_cached} · pendentes={len(pending)} ({total_chars:,} chars)"
        )

        if args.dry_run or not pending:
            if args.dry_run:
                print("🔎 DRY RUN — nenhuma chamada de API feita.")
                for _, sample in pending[:8]:
                    print(f"   • {sample[:100]}")
            else:
                print("✅ Tudo já está traduzido no cache!")
            return

        done = 0
        errors = 0
        with httpx.Client(headers={"User-Agent": "GenshinSmartTeamBuilder/1.0"}) as client:
            for start in range(0, len(pending), args.batch_size):
                chunk = pending[start : start + args.batch_size]
                chunk_texts = [t for _, t in chunk]
                try:
                    if provider == "gemini":
                        translated = translate_batch_gemini(
                            client, chunk_texts, args.lang, gemini_key, model=args.gemini_model
                        )
                    elif provider == "deepl":
                        translated = translate_batch_deepl(client, chunk_texts, args.lang, deepl_key)
                    else:
                        translated = translate_batch_google(
                            client, chunk_texts, args.lang, delay=args.delay
                        )
                except Exception as exc:
                    print(f"⚠️  Lote {start + 1}-{start + len(chunk)} falhou: {exc}")
                    errors += len(chunk)
                    time.sleep(max(1.5, args.delay * 4))
                    continue

                for (h, orig), tr in zip(chunk, translated):
                    row = db.query(TextTranslation).filter(
                        TextTranslation.source_hash == h,
                        TextTranslation.target_lang == args.lang,
                    ).one_or_none()
                    if row:
                        row.translated_text = tr
                        row.provider = provider
                    else:
                        db.add(TextTranslation(
                            source_hash=h,
                            target_lang=args.lang,
                            source_text=orig,
                            translated_text=tr,
                            provider=provider,
                        ))
                db.commit()
                done += len(chunk)
                print(f"   ✅ Progresso: {done}/{len(pending)} strings salvas no cache")
                if provider in ("gemini", "deepl") and args.delay > 0:
                    time.sleep(args.delay)

        print(f"\n🏁 Concluído! Traduzidas={done} · Erros={errors}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
