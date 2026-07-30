#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GEOPÓLEM · SENTINEL — Ingesta diaria de eventos de conflicto desde GDELT.

Consulta el API público de GDELT 2.0 (DOC API, sin clave ni dependencias de
pago), filtra los artículos por relevancia geopolítica con un sistema de
puntuación transparente y escribe un JSON estático que el panel SENTINEL del
frontend consume directamente.

Diseño:
  - Solo biblioteca estándar de Python 3 (urllib, json, hashlib, etc.).
  - Determinista y auditable: cada evento lleva su desglose de puntuación.
  - Robusto: si no hay eventos nuevos relevantes NO es un error; un fallo real
    de red/API/parción SÍ termina con código distinto de cero.
  - --dry-run / GDELT_DRY_RUN=1 genera una muestra sintética sin tocar la red,
    para verificación local y CI sin acceso externo.

Salida: data/sentinel/conflict-events.json

Para afinar la relevancia, edita las constantes de CONFIGURACIÓN abajo
(CONFLICT_THEMES, REGION_KEYWORDS, TONE_*, los umbrales TIER_*). El esquema y
los pesos están versionados en FILTERS_VERSION para que el frontend pueda
detectar cambios de metodología.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

# ----------------------------------------------------------------------------
# CONFIGURACIÓN — afina aquí la relevancia geopolítica de SENTINEL
# ----------------------------------------------------------------------------

# Versión del esquema + metodología de filtrado. Súbela cuando cambies pesos,
# umbrales o el formato del JSON, para que el frontend pueda invalidar caché.
FILTERS_VERSION = "1.0.0"

SOURCE = "GDELT 2.0 DOC API"
GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"

# Ventana temporal por defecto (horas hacia atrás desde "ahora").
DEFAULT_WINDOW_HOURS = 24

# Máximo de artículos a pedir a GDELT por ejecución (tope del API: 250).
MAX_RECORDS = 250

# Cuántos eventos relevantes conservar en el JSON final (los de mayor score).
MAX_EVENTS_OUT = 120

# Consulta GDELT: temas/violencia/seguridad. GDELT indexa por palabras y por
# "themes" del taxonomy GKG; usamos términos amplios en inglés (idioma base del
# índice) combinados con OR. Mantener anti-amarillista: términos factuales.
# NOTA: el DOC 2.0 API de GDELT rechaza queries por longitud con el mensaje de
# error "Your query was too short or too long." si la cadena de la query supera
# un umbral (no documentado oficialmente, mesurado empíricamente en producción:
# el listado original de 21 términos + 2 frases entre comillas, 253 caracteres,
# era rechazado de forma sistemática). Mantener este bloque OR por debajo de
# ~180 caracteres para evitar el rechazo.
GDELT_QUERY = (
    '(conflict OR war OR military OR offensive OR airstrike OR shelling OR '
    'clashes OR insurgency OR ceasefire OR missile OR sanctions OR coup OR '
    'escalation)'
)

# Temas de conflicto/violencia/seguridad → suman al score si aparecen en título.
CONFLICT_THEMES: dict[str, float] = {
    "war": 3.0, "warfare": 3.0, "conflict": 2.5, "offensive": 2.5,
    "airstrike": 3.0, "air strike": 3.0, "shelling": 3.0, "bombard": 3.0,
    "clash": 2.0, "clashes": 2.0, "fighting": 2.0, "combat": 2.0,
    "insurgency": 2.5, "militant": 2.0, "militants": 2.0, "rebel": 2.0,
    "ceasefire": 1.5, "truce": 1.5, "escalation": 2.5, "escalate": 2.0,
    "missile": 2.5, "drone": 2.0, "strike": 1.5, "casualties": 2.5,
    "killed": 2.0, "wounded": 1.5, "coup": 2.5, "mobiliz": 1.5,
    "sanction": 1.5, "sanctions": 1.5, "blockade": 2.0, "siege": 2.5,
    "occupation": 2.0, "invasion": 3.0, "invade": 3.0, "nuclear": 2.0,
    "terror": 2.0, "attack": 1.5, "assault": 1.5, "deploy": 1.5,
    "troops": 1.5, "frontline": 2.0, "front line": 2.0,
}

# Regiones/países alineados con la taxonomía GEOPÓLEM (REGIONS en data.js).
# keyword en minúscula → (etiqueta de región GEOPÓLEM, peso).
REGION_KEYWORDS: dict[str, tuple[str, float]] = {
    # Europa del Este / Eurasia
    "ukraine": ("Europa del Este", 2.0), "russia": ("Eurasia", 2.0),
    "russian": ("Eurasia", 1.5), "kyiv": ("Europa del Este", 1.5),
    "moscow": ("Eurasia", 1.5), "donbas": ("Europa del Este", 1.5),
    "crimea": ("Europa del Este", 1.5), "belarus": ("Europa del Este", 1.0),
    # MENA
    "israel": ("MENA", 2.0), "gaza": ("MENA", 2.0), "palestin": ("MENA", 1.5),
    "iran": ("MENA", 2.0), "iranian": ("MENA", 1.5), "lebanon": ("MENA", 1.5),
    "hezbollah": ("MENA", 1.5), "hamas": ("MENA", 1.5), "syria": ("MENA", 1.5),
    "yemen": ("MENA", 1.5), "houthi": ("MENA", 1.5), "iraq": ("MENA", 1.0),
    "saudi": ("MENA", 1.0), "red sea": ("MENA", 1.5), "hormuz": ("MENA", 1.5),
    # Sahel / Cuerno de África
    "sahel": ("Sahel", 1.5), "mali": ("Sahel", 1.5), "niger": ("Sahel", 1.5),
    "burkina": ("Sahel", 1.5), "sudan": ("Cuerno de África", 1.5),
    "somalia": ("Cuerno de África", 1.5), "ethiopia": ("Cuerno de África", 1.0),
    # Asia del Sur / Asia-Pacífico
    "india": ("Asia del Sur", 1.0), "pakistan": ("Asia del Sur", 1.5),
    "afghan": ("Asia del Sur", 1.0), "kashmir": ("Asia del Sur", 1.5),
    "china": ("Asia-Pacífico", 2.0), "taiwan": ("Asia-Pacífico", 2.0),
    "north korea": ("Asia-Pacífico", 1.5), "south china sea": ("Asia-Pacífico", 1.5),
    "myanmar": ("Asia-Pacífico", 1.0), "philippines": ("Asia-Pacífico", 1.0),
    # América Latina / Norteamérica
    "venezuela": ("América Latina", 1.5), "haiti": ("América Latina", 1.0),
    "mexico": ("América Latina", 1.0), "colombia": ("América Latina", 1.0),
    "cuba": ("América Latina", 1.0),
    "united states": ("Norteamérica", 1.0), "nato": ("Global", 1.5),
}

# Tono GDELT (V2Tone, -100..+100; negativo = noticia negativa/conflicto).
# Premiamos tono marcadamente negativo (más probable que sea conflicto real).
TONE_NEGATIVE_BONUS = 1.5   # si tone <= TONE_NEGATIVE_THRESHOLD
TONE_NEGATIVE_THRESHOLD = -5.0

# Umbrales de relevancia (tiers). Ajusta para hacer SENTINEL más/menos estricto.
TIER_HIGH = 6.0      # score >= → "high"
TIER_MEDIUM = 3.5    # score >= → "medium"
TIER_MONITOR = 1.5   # score >= → "monitor"; por debajo se descarta

# ----------------------------------------------------------------------------
# UTILIDADES
# ----------------------------------------------------------------------------


def _now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _gdelt_ts(d: dt.datetime) -> str:
    """GDELT espera timestamps YYYYMMDDHHMMSS en UTC."""
    return d.strftime("%Y%m%d%H%M%S")


def _stable_id(url: str, title: str) -> str:
    """ID estable y determinista para de-duplicación entre ejecuciones."""
    basis = (url or "").strip().lower() or (title or "").strip().lower()
    return "evt_" + hashlib.sha1(basis.encode("utf-8")).hexdigest()[:16]


# ----------------------------------------------------------------------------
# INGESTA
# ----------------------------------------------------------------------------


def build_query_url(window_hours: int) -> str:
    end = _now_utc()
    start = end - dt.timedelta(hours=window_hours)
    params = {
        "query": GDELT_QUERY,
        "mode": "ArtList",
        "format": "json",
        "maxrecords": str(MAX_RECORDS),
        "sort": "DateDesc",
        "startdatetime": _gdelt_ts(start),
        "enddatetime": _gdelt_ts(end),
    }
    return GDELT_DOC_API + "?" + urllib.parse.urlencode(params)


# GDELT pide explícitamente no superar 1 petición cada 5s desde una misma IP.
# Los runners de GitHub Actions comparten rangos de IP con muchísimos otros
# consumidores del API, así que es habitual chocar con su rate-limit (HTTP 429,
# o incluso HTTP 200 con un cuerpo de texto plano avisando del límite) aunque
# SENTINEL solo haga una petición al día. Reintentamos con backoff exponencial
# antes de declarar fallo real.
GDELT_MAX_RETRIES = 6
GDELT_RETRY_BASE_SECONDS = 15.0


def _is_rate_limit_body(raw: str) -> bool:
    """GDELT a veces devuelve 200 OK pero con un aviso de rate-limit en texto
    plano en vez de JSON. Lo detectamos por contenido, no solo por status code.
    """
    lowered = raw[:300].lower()
    return "please limit requests" in lowered or "one every" in lowered


def fetch_gdelt(window_hours: int) -> list[dict[str, Any]]:
    """Descarga artículos del DOC API de GDELT, con reintentos ante rate-limit.

    Lanza excepción ante fallo real (agotados los reintentos o error no
    recuperable).
    """
    url = build_query_url(window_hours)
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "GEOPOLEM-SENTINEL/1.0 (+https://geopolem.com)"},
    )

    last_error: Exception | None = None
    for attempt in range(1, GDELT_MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < GDELT_MAX_RETRIES:
                wait = GDELT_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
                print(
                    f"[sentinel] GDELT devolvió 429 (intento {attempt}/"
                    f"{GDELT_MAX_RETRIES}); esperando {wait:.0f}s antes de reintentar",
                    file=sys.stderr,
                )
                time.sleep(wait)
                last_error = exc
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt < GDELT_MAX_RETRIES:
                wait = GDELT_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
                print(
                    f"[sentinel] Error de red con GDELT (intento {attempt}/"
                    f"{GDELT_MAX_RETRIES}): {exc}; esperando {wait:.0f}s",
                    file=sys.stderr,
                )
                time.sleep(wait)
                last_error = exc
                continue
            raise

        raw = raw.strip()
        if not raw:
            # GDELT a veces devuelve cuerpo vacío cuando no hay coincidencias.
            return []

        if _is_rate_limit_body(raw):
            if attempt < GDELT_MAX_RETRIES:
                wait = GDELT_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
                print(
                    f"[sentinel] GDELT devolvió aviso de rate-limit en el cuerpo "
                    f"(intento {attempt}/{GDELT_MAX_RETRIES}); esperando {wait:.0f}s",
                    file=sys.stderr,
                )
                time.sleep(wait)
                last_error = RuntimeError(raw[:200])
                continue
            raise RuntimeError(f"GDELT rate-limit persistente tras reintentos: {raw[:200]!r}")

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            # Un cuerpo no-JSON con texto suele ser un mensaje de error del API.
            raise RuntimeError(f"Respuesta GDELT no es JSON válido: {raw[:200]!r}") from exc
        return payload.get("articles", []) or []

    # No debería llegarse aquí, pero por seguridad:
    raise RuntimeError(f"GDELT: reintentos agotados sin éxito ({last_error})")


def sample_articles() -> list[dict[str, Any]]:
    """Muestra sintética para --dry-run (sin red). Refleja el esquema de GDELT."""
    return [
        {
            "url": "https://example.org/news/ukraine-frontline-shelling",
            "title": "Heavy shelling reported along Ukraine frontline as offensive escalates",
            "seendate": "20260617T060000Z",
            "domain": "example.org",
            "sourcecountry": "Ukraine",
            "language": "English",
            "tone": "-7.2",
        },
        {
            "url": "https://example.org/news/gaza-airstrike",
            "title": "Airstrike on Gaza kills several as ceasefire talks stall",
            "seendate": "20260617T050000Z",
            "domain": "example.org",
            "sourcecountry": "Israel",
            "language": "English",
            "tone": "-9.1",
        },
        {
            "url": "https://example.org/news/taiwan-drills",
            "title": "China launches military drills near Taiwan amid rising tension",
            "seendate": "20260617T040000Z",
            "domain": "example.org",
            "sourcecountry": "Taiwan",
            "language": "English",
            "tone": "-4.0",
        },
        {
            "url": "https://example.org/news/sahel-coup",
            "title": "Coup leaders in Mali announce new security measures",
            "seendate": "20260617T030000Z",
            "domain": "example.org",
            "sourcecountry": "Mali",
            "language": "English",
            "tone": "-3.5",
        },
        {
            # Ruido: noticia no-conflicto → debe quedar por debajo del umbral.
            "url": "https://example.org/news/tech-earnings",
            "title": "Tech company reports record quarterly earnings",
            "seendate": "20260617T020000Z",
            "domain": "example.org",
            "sourcecountry": "United States",
            "language": "English",
            "tone": "3.1",
        },
    ]


# ----------------------------------------------------------------------------
# PUNTUACIÓN / FILTRADO (transparente y auditable)
# ----------------------------------------------------------------------------


def _parse_tone(article: dict[str, Any]) -> float | None:
    val = article.get("tone")
    if val in (None, ""):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def score_article(article: dict[str, Any]) -> dict[str, Any]:
    """Devuelve dict con score, tier, región, actores y el desglose de factores."""
    title = (article.get("title") or "").strip()
    title_l = title.lower()
    url = (article.get("url") or "").strip()

    breakdown: dict[str, float] = {}

    # 1) Temas de conflicto/violencia/seguridad en el título.
    theme_score = 0.0
    matched_themes: list[str] = []
    for kw, weight in CONFLICT_THEMES.items():
        if kw in title_l:
            theme_score += weight
            matched_themes.append(kw)
    # Acotamos para que un titular lleno de keywords no domine.
    theme_score = min(theme_score, 6.0)
    breakdown["themes"] = round(theme_score, 3)

    # 2) Región / país (taxonomía GEOPÓLEM) + geolocalización del medio.
    region = "Global"
    region_score = 0.0
    matched_regions: list[str] = []
    best_weight = 0.0
    for kw, (reg_label, weight) in REGION_KEYWORDS.items():
        if kw in title_l:
            region_score += weight
            matched_regions.append(kw)
            if weight > best_weight:
                best_weight = weight
                region = reg_label
    region_score = min(region_score, 4.0)
    breakdown["region"] = round(region_score, 3)

    # 3) Tono GDELT (señal de negatividad → más probable conflicto real).
    tone = _parse_tone(article)
    tone_score = 0.0
    if tone is not None and tone <= TONE_NEGATIVE_THRESHOLD:
        tone_score = TONE_NEGATIVE_BONUS
    breakdown["tone"] = round(tone_score, 3)

    total = round(theme_score + region_score + tone_score, 3)

    if total >= TIER_HIGH:
        tier = "high"
    elif total >= TIER_MEDIUM:
        tier = "medium"
    elif total >= TIER_MONITOR:
        tier = "monitor"
    else:
        tier = "discard"

    # Actores: medio de origen y país declarado por GDELT.
    actors: list[str] = []
    src_country = (article.get("sourcecountry") or "").strip()
    if src_country:
        actors.append(src_country)

    return {
        "id": _stable_id(url, title),
        "title": title,
        "url": url,
        "domain": (article.get("domain") or "").strip(),
        "source_country": src_country,
        "language": (article.get("language") or "").strip(),
        "seen_date": (article.get("seendate") or "").strip(),
        "region": region,
        "tone": tone,
        "score": total,
        "tier": tier,
        "matched_themes": matched_themes,
        "matched_regions": matched_regions,
        "score_breakdown": breakdown,
        "actors": actors,
    }


def process(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Puntúa, filtra por umbral, de-duplica por ID estable y ordena por score."""
    by_id: dict[str, dict[str, Any]] = {}
    for art in articles:
        scored = score_article(art)
        if scored["tier"] == "discard":
            continue
        prev = by_id.get(scored["id"])
        # De-duplicación: conservamos el de mayor score.
        if prev is None or scored["score"] > prev["score"]:
            by_id[scored["id"]] = scored
    events = sorted(by_id.values(), key=lambda e: e["score"], reverse=True)
    return events[:MAX_EVENTS_OUT]


# ----------------------------------------------------------------------------
# SALIDA
# ----------------------------------------------------------------------------


def build_document(
    events: list[dict[str, Any]], window_hours: int, dry_run: bool
) -> dict[str, Any]:
    tier_counts = {"high": 0, "medium": 0, "monitor": 0}
    for e in events:
        tier_counts[e["tier"]] = tier_counts.get(e["tier"], 0) + 1
    return {
        "generated_at": _now_utc().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": SOURCE + (" (dry-run sample)" if dry_run else ""),
        "query_window": f"last {window_hours}h",
        "total_events": len(events),
        "tier_counts": tier_counts,
        "filters": {
            "version": FILTERS_VERSION,
            "tiers": {"high": TIER_HIGH, "medium": TIER_MEDIUM, "monitor": TIER_MONITOR},
            "tone_negative_threshold": TONE_NEGATIVE_THRESHOLD,
            "query": GDELT_QUERY,
            "max_records": MAX_RECORDS,
        },
        "events": events,
    }


def write_if_changed(path: str, document: dict[str, Any]) -> bool:
    """Escribe el JSON ignorando generated_at para decidir si hubo cambio real.

    Devuelve True si el contenido sustantivo cambió (o el archivo no existía).
    """
    new_text = json.dumps(document, ensure_ascii=False, indent=2, sort_keys=True)

    def _strip_volatile(text: str) -> Any:
        obj = json.loads(text)
        obj.pop("generated_at", None)
        return obj

    changed = True
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as fh:
                old_text = fh.read()
            if _strip_volatile(old_text) == _strip_volatile(new_text):
                changed = False
        except (OSError, json.JSONDecodeError):
            changed = True

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(new_text + "\n")
    return changed


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------


def default_output_path() -> str:
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(repo_root, "data", "sentinel", "conflict-events.json")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="GEOPÓLEM SENTINEL — ingesta de eventos de conflicto (GDELT)."
    )
    parser.add_argument(
        "--output", default=default_output_path(),
        help="Ruta del JSON de salida (por defecto data/sentinel/conflict-events.json).",
    )
    parser.add_argument(
        "--window-hours", type=int, default=DEFAULT_WINDOW_HOURS,
        help="Ventana temporal hacia atrás en horas (por defecto 24).",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="No usa red; genera una muestra sintética (verificación local/CI).",
    )
    args = parser.parse_args(argv)

    dry_run = args.dry_run or os.environ.get("GDELT_DRY_RUN") == "1"

    try:
        if dry_run:
            articles = sample_articles()
            print(f"[sentinel] dry-run: {len(articles)} artículos de muestra", file=sys.stderr)
        else:
            articles = fetch_gdelt(args.window_hours)
            print(f"[sentinel] GDELT devolvió {len(articles)} artículos", file=sys.stderr)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, RuntimeError) as exc:
        # Fallo real de red/API/parción → error de build.
        print(f"[sentinel] ERROR de ingesta: {exc}", file=sys.stderr)
        return 1

    events = process(articles)
    document = build_document(events, args.window_hours, dry_run)

    try:
        changed = write_if_changed(args.output, document)
    except OSError as exc:
        print(f"[sentinel] ERROR escribiendo {args.output}: {exc}", file=sys.stderr)
        return 1

    print(
        f"[sentinel] {len(events)} eventos relevantes → {args.output} "
        f"({'cambios' if changed else 'sin cambios'})",
        file=sys.stderr,
    )
    # Sin eventos relevantes NO es error: salida 0.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
