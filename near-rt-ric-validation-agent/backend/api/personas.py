"""Sync personas/*.json from repo into the Persona table.

File system is the source of truth; DB is a read view for the UI.
Persona JSON shape: {"meta": {...}, "controls_overlay": {...}}.
"""

import json
from pathlib import Path

from django.conf import settings

from .models import Persona


def _personas_dir() -> Path:
    return Path(settings.REPO_ROOT) / "domain" / "personas"


def sync_from_disk():
    pdir = _personas_dir()
    if not pdir.is_dir():
        return

    seen = set()
    for path in sorted(pdir.glob("*.json")):
        try:
            data = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        meta = data.get("meta") or {}
        slug = meta.get("id") or path.stem
        display = meta.get("label_zh") or meta.get("label_en") or slug
        description = meta.get("description_zh") or meta.get("description_en") or ""
        overlay = data.get("controls_overlay") or {}
        Persona.objects.update_or_create(
            slug=slug,
            defaults={
                "display_name": display,
                "description": description,
                "controls_overlay": overlay,
                "source_file": str(path.relative_to(settings.REPO_ROOT)),
            },
        )
        seen.add(slug)

    Persona.objects.exclude(slug__in=seen).delete()
