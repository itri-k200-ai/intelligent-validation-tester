"""Agent knowledge endpoints — what we've "taught" the agent.

Returns four buckets that together make up the agent's effective intelligence:

  - prompt          : prompt.md (system prompt appended on every call)
  - subagents       : .claude/agents/*.md (named sub-agents the LLM can delegate to)
  - memory          : .claude-home/projects/.../memory/*.md (auto-saved memories
                      from past conversations + MEMORY.md index)
  - personas        : domain/personas/*.json (already exposed via /api/personas/, included
                      here only for the version sidebar convenience)

Also returns runtime info: claude CLI version and config dir.
"""

import os
import re
import subprocess
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET


def _claude_config_dir() -> Path:
    return Path(os.environ.get("CLAUDE_CONFIG_DIR") or
                (Path(settings.REPO_ROOT) / ".claude"))


def _read_text(path: Path, max_bytes: int = 256 * 1024) -> str:
    try:
        if path.stat().st_size > max_bytes:
            return path.read_text(errors="replace")[:max_bytes] + "\n…（截斷）"
        return path.read_text(errors="replace")
    except OSError:
        return ""


_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)


def _parse_frontmatter(text: str) -> dict:
    """Lightweight YAML-ish frontmatter parser. Accepts both shapes used by
    Claude Code memories:
      shape A (legacy): top-level `type: feedback`
      shape B (current): nested under `metadata: { type: feedback }`
    """
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}
    block = m.group(1)
    out: dict = {}
    in_metadata = False
    for raw in block.splitlines():
        line = raw.rstrip()
        if not line:
            continue
        # Nested metadata: items indented 2+ spaces under "metadata:" stay in scope.
        if line.startswith("metadata:"):
            in_metadata = True
            tail = line[len("metadata:"):].strip()
            if tail:  # inline e.g. "metadata: {type: feedback}" — skip parsing, rare
                in_metadata = False
            continue
        if in_metadata and (line.startswith(" ") or line.startswith("\t")):
            k, _, v = line.strip().partition(":")
            if k and v:
                out.setdefault("metadata", {})[k.strip()] = v.strip().strip('"').strip("'")
            continue
        in_metadata = False
        k, _, v = line.partition(":")
        if k and v:
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


_WHY_RE = re.compile(
    r"\*\*Why:\*\*\s*(.+?)(?=\n\s*\n|\*\*How to apply|\*\*How|\Z)", re.S
)
_HOW_RE = re.compile(
    r"\*\*How to apply:\*\*\s*(.+?)(?=\n\s*\n|\*\*Why|\Z)", re.S
)


def _extract_section(pattern: re.Pattern, text: str) -> str:
    m = pattern.search(text)
    if not m:
        return ""
    return " ".join(m.group(1).strip().split())[:600]


def _file_entry(path: Path) -> dict:
    stat = path.stat()
    content = _read_text(path)
    fm = _parse_frontmatter(content)
    body = _FRONTMATTER_RE.sub("", content, count=1)
    nested_type = (fm.get("metadata") or {}).get("type", "")
    return {
        "name": path.name,
        "path": str(path.relative_to(settings.REPO_ROOT))
                if path.is_relative_to(settings.REPO_ROOT) else str(path),
        "size": stat.st_size,
        "mtime": stat.st_mtime,
        "content": content,
        "title": fm.get("name", path.stem),
        "description": fm.get("description", ""),
        "kind": nested_type or fm.get("type", ""),
        "why": _extract_section(_WHY_RE, body),
        "how": _extract_section(_HOW_RE, body),
    }


def _prompt() -> dict | None:
    p = Path(settings.REPO_ROOT) / "domain" / "prompt.md"
    return _file_entry(p) if p.is_file() else None


def _subagents() -> list[dict]:
    base = Path(settings.REPO_ROOT) / ".claude" / "agents"
    if not base.is_dir():
        return []
    return [_file_entry(p) for p in sorted(base.glob("*.md"))]


def _memory_dir() -> Path | None:
    """Find the auto-memory dir. Claude Code derives the project key from cwd,
    so /workspace becomes -workspace under projects/."""
    config_dir = _claude_config_dir()
    if not config_dir.is_dir():
        return None
    candidate = config_dir / "projects" / "-workspace" / "memory"
    if candidate.is_dir():
        return candidate
    projects_dir = config_dir / "projects"
    if projects_dir.is_dir():
        for proj in projects_dir.glob("*"):
            m = proj / "memory"
            if m.is_dir():
                return m
    return None


def _memory() -> dict:
    mdir = _memory_dir()
    if mdir is None:
        return {"dir": "", "entries": [], "index": ""}
    entries = []
    for p in sorted(mdir.glob("*.md")):
        if p.name == "MEMORY.md":
            continue
        entries.append(_file_entry(p))
    index = _read_text(mdir / "MEMORY.md") if (mdir / "MEMORY.md").is_file() else ""
    return {"dir": str(mdir), "entries": entries, "index": index}


def _claude_version() -> str:
    try:
        out = subprocess.run(
            ["claude", "--version"],
            capture_output=True, text=True, timeout=5,
        )
        text = (out.stdout or out.stderr).strip()
        # Pick the first version-looking token (e.g. "2.1.140 (Claude Code)")
        m = re.search(r"\d+\.\d+\.\d+", text)
        return m.group(0) if m else text
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return ""


@require_GET
def knowledge(request):
    return JsonResponse({
        "prompt": _prompt(),
        "subagents": _subagents(),
        "memory": _memory(),
    })


@require_GET
def info(request):
    mdir = _memory_dir()
    from .models import Instance, Message, Session
    return JsonResponse({
        "claude_version": _claude_version(),
        "claude_config_dir": str(_claude_config_dir()),
        "memory_dir": str(mdir) if mdir else "",
        "repo_root": str(settings.REPO_ROOT),
        "session_count": Session.objects.count(),
        "message_count": Message.objects.count(),
        "instance_count": Instance.objects.count(),
    })
