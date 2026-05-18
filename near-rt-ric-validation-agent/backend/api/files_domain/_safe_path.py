"""Path safety helpers — used everywhere a user-controllable path
component is resolved under REPO_ROOT.
"""

from pathlib import Path


def safe_join(base: Path, rel: str) -> Path | None:
    """Resolve `rel` under `base`. Returns None if the result escapes
    `base` (path traversal attempt) or `rel` is empty."""
    rel = (rel or "").lstrip("/")
    if not rel:
        return None
    candidate = (base / rel).resolve()
    try:
        candidate.relative_to(base.resolve())
    except ValueError:
        return None
    return candidate


def safe_child(root: Path, rel: str) -> Path | None:
    """Same as safe_join but `root` is already resolved."""
    candidate = (root / rel).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate
