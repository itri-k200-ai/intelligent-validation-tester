"""Agent growth-timeline endpoint — what we've taught the agent over time.

Aggregates four event sources into one reverse-chronological feed so the
investor / partner can see "how the agent got smarter through guidance":

  - memory     : when each .claude/.../memory/*.md was last touched
  - rule       : git commits touching prompt.md / .claude/agents/* / personas/*
  - milestone  : DB-derived first-of-its-kind events
                 (first session, first artifact per type, turn-count thresholds)
  - generated  : each artifact produced (notes from _metadata.json sidecar)

Pure read endpoint, no side effects. Designed to be polled rarely
(SWR refresh on knowledge / growth pages).
"""

from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import Instance, Message, Persona, Session, Turn, TurnEvent


@dataclass
class Event:
    ts: str          # ISO 8601 UTC
    kind: str        # memory | rule | milestone | generated
    title: str
    desc: str = ""
    source: str = ""  # repo-relative file path or commit short SHA
    icon: str = ""    # frontend hint: brain | scroll | flag | package


def _claude_config_dir() -> Path:
    return Path(
        os.environ.get("CLAUDE_CONFIG_DIR")
        or (Path(settings.REPO_ROOT) / ".claude")
    )


def _memory_dirs() -> Iterable[Path]:
    """Find all memory/ dirs the agent might write to. Bind-mount paths
    differ between host and container; we glob both shapes."""
    cfg = _claude_config_dir()
    if not cfg.exists():
        return []
    return list((cfg / "projects").glob("*/memory")) if (cfg / "projects").exists() else []


def _memory_events() -> list[Event]:
    out: list[Event] = []
    seen: set[str] = set()
    for memdir in _memory_dirs():
        for md in sorted(memdir.glob("*.md")):
            if md.name == "MEMORY.md" or md.name in seen:
                continue
            seen.add(md.name)
            try:
                stat = md.stat()
                title = md.stem.replace("_", " ")
                first_line = ""
                with md.open(encoding="utf-8", errors="replace") as f:
                    for line in f:
                        s = line.strip()
                        if s and not s.startswith(("---", "name:", "description:", "metadata:", "type:")):
                            first_line = s[:160]
                            break
                out.append(Event(
                    ts=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    kind="memory",
                    title=f"Agent learned: {title}",
                    desc=first_line,
                    source=str(md.relative_to(settings.REPO_ROOT))
                        if str(md).startswith(str(settings.REPO_ROOT))
                        else md.name,
                    icon="brain",
                ))
            except OSError:
                continue
    return out


_TEACHING_GLOBS = (
    "domain/prompt.md",
    "domain/agents/*.md",
    "domain/personas/*.json",
    "domain/config.json",
    ".claude/agents/*.md",
)


def _rule_events(limit: int = 30) -> list[Event]:
    """Git commits that modified any teaching file."""
    repo = Path(settings.REPO_ROOT)
    if not (repo / ".git").exists():
        return []
    cmd = [
        "git", "log",
        f"-{limit}",
        "--pretty=format:%H%x1f%aI%x1f%s",
        "--",
        *_TEACHING_GLOBS,
    ]
    try:
        result = subprocess.run(
            cmd, cwd=repo, capture_output=True, text=True, timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return []
    if result.returncode != 0:
        return []
    out: list[Event] = []
    for line in result.stdout.splitlines():
        parts = line.split("\x1f")
        if len(parts) != 3:
            continue
        sha, ts, subject = parts
        out.append(Event(
            ts=ts,
            kind="rule",
            title=subject,
            desc="Updated teaching docs (prompt.md / sub-agent / persona)",
            source=sha[:8],
            icon="scroll",
        ))
    return out


def _milestone_events() -> list[Event]:
    out: list[Event] = []
    first_session = Session.objects.order_by("created_at").first()
    if first_session:
        out.append(Event(
            ts=first_session.created_at.isoformat(),
            kind="milestone",
            title="First conversation",
            desc=f"Session #{str(first_session.id)[:8]}",
            icon="flag",
        ))
    seen_types: dict[str, datetime] = {}
    for inst in Instance.objects.exclude(persona="").order_by("created_at"):
        key = inst.persona or inst.name.split("_")[0]
        if key not in seen_types:
            seen_types[key] = inst.created_at
            out.append(Event(
                ts=inst.created_at.isoformat(),
                kind="milestone",
                title=f"First {key.upper()} artifact",
                desc=f"Generated as `{inst.name}`",
                icon="flag",
            ))
    turn_count = Turn.objects.count()
    for threshold in (10, 25, 50, 100, 250, 500):
        if turn_count >= threshold:
            t = Turn.objects.order_by("started_at")[threshold - 1]
            out.append(Event(
                ts=t.started_at.isoformat(),
                kind="milestone",
                title=f"{threshold}th conversation round",
                desc="Cumulative turn count milestone",
                icon="flag",
            ))
    return out


def _generated_events() -> list[Event]:
    """Each generated artifact, sourced from generated/<name>/_metadata.json."""
    repo = Path(settings.REPO_ROOT)
    gen_dir = repo / "generated"
    if not gen_dir.exists():
        return []
    out: list[Event] = []
    for sub in sorted(gen_dir.iterdir()):
        if not sub.is_dir():
            continue
        meta_file = sub / "_metadata.json"
        title = f"Generated `{sub.name}`"
        desc = ""
        if meta_file.exists():
            try:
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                xapp_type = meta.get("xapp_type") or ""
                notes = meta.get("notes") or ""
                if xapp_type:
                    title = f"Generated {xapp_type} artifact `{sub.name}`"
                desc = (notes[:200] + "…") if len(notes) > 200 else notes
            except (OSError, json.JSONDecodeError):
                pass
        try:
            mtime = sub.stat().st_mtime
        except OSError:
            continue
        out.append(Event(
            ts=datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
            kind="generated",
            title=title,
            desc=desc,
            source=f"generated/{sub.name}",
            icon="package",
        ))
    return out


def _stats() -> dict:
    cfg = _claude_config_dir()
    memory_count = 0
    for memdir in _memory_dirs():
        memory_count += len([
            p for p in memdir.glob("*.md")
            if p.name != "MEMORY.md"
        ])
    prompt_path = Path(settings.REPO_ROOT) / "domain" / "prompt.md"
    prompt_size = prompt_path.stat().st_size if prompt_path.exists() else 0
    subagent_dir = cfg / "agents"
    subagent_count = (
        len(list(subagent_dir.glob("*.md"))) if subagent_dir.exists() else 0
    )
    artifact_types_generated = (
        Instance.objects.exclude(persona="")
        .values_list("persona", flat=True)
        .distinct()
        .count()
    )
    return {
        "memory_count": memory_count,
        "prompt_size_bytes": prompt_size,
        "subagent_count": subagent_count,
        "persona_count": Persona.objects.count(),
        "artifact_types_generated": artifact_types_generated,
        "total_sessions": Session.objects.count(),
        "total_turns": Turn.objects.count(),
        "total_messages": Message.objects.count(),
        "total_turn_events": TurnEvent.objects.count(),
    }


@require_GET
def growth(request):
    events: list[Event] = []
    events.extend(_memory_events())
    events.extend(_rule_events())
    events.extend(_milestone_events())
    events.extend(_generated_events())
    events.sort(key=lambda e: e.ts, reverse=True)
    return JsonResponse({
        "stats": _stats(),
        "timeline": [e.__dict__ for e in events],
    })
