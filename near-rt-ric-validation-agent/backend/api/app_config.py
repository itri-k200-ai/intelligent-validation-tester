"""Application config endpoint — exposes domain/config.json to the frontend.

The frontend's Hero, AppHeader, Sidebar and Login pages all read this so
they can render domain-specific content (app name, description, features
list, suggested prompts) without baking strings into i18n.ts.

Feature flags (`features.knowledge_tab`, `features.artifacts`, …) also
flow through here so the frontend can hide UI for unused features instead
of carrying a `domain==='xapp' ? <X/> : null` branch everywhere.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET


DEFAULT_CONFIG: dict = {
    "app": {
        "name": {"en": "Agent", "zh": "Agent"},
        "slug": "agent",
        "description": {"en": "", "zh": ""},
    },
    "default_lang": "en",
    "features": {
        "knowledge_tab": True,
        "growth_timeline": True,
        "file_upload": True,
        "artifacts": False,
        "personas": False,
    },
    "hero": {
        "title": {"en": "What do you want to do today?", "zh": "今天想做什麼？"},
        "subtitle": {"en": "", "zh": ""},
        "features": [],
        "prompts": [],
    },
}


def _config_path() -> Path:
    return Path(settings.REPO_ROOT) / "domain" / "config.json"


@lru_cache(maxsize=1)
def load_config() -> dict:
    """Read domain/config.json. Missing file or parse error → DEFAULT_CONFIG.

    Cached for the process lifetime. To pick up edits without restarting
    the worker, call `load_config.cache_clear()`.
    """
    p = _config_path()
    if not p.is_file():
        return DEFAULT_CONFIG
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return DEFAULT_CONFIG
    return _merge_with_defaults(raw, DEFAULT_CONFIG)


def _merge_with_defaults(user: dict, defaults: dict) -> dict:
    """Shallow merge so a partial config still has every expected key."""
    out: dict = {}
    for key, default_val in defaults.items():
        if isinstance(default_val, dict):
            out[key] = {**default_val, **(user.get(key) or {})}
        else:
            out[key] = user.get(key, default_val)
    # Preserve user-only keys (custom feature flags, extra hero fields).
    for key, val in user.items():
        if key not in out:
            out[key] = val
    return out


@require_GET
def app_config(request):
    return JsonResponse(load_config())
