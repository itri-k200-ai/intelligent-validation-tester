"""Generated-artifact lifecycle: filesystem ↔ DB sync, listing, archive, delete.

The agent writes artifacts to `/workspace/generated/<name>/` and may drop a
`_metadata.json` sidecar capturing type / persona / controls / notes /
based_on_paper / session_id. We use that as the source of truth for the
Instance row.

Archive delivery:
  - If a matching pre-built archive sits at /workspace/uploads/<name>.<ext>,
    we serve that (smaller, already-zipped).
  - Otherwise we tar.gz the directory live on `/api/generated/<name>/archive`.
"""

import io
import json
import shutil
import tarfile
from pathlib import Path

from django.conf import settings
from django.http import (
    HttpResponseNotFound,
    JsonResponse,
    StreamingHttpResponse,
)
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from ..models import Instance, Session


_ARCHIVE_EXTS = (".tar.gz", ".tgz", ".tar", ".zip", ".gz")


# ────────── domain service ──────────


def _archive_stem(name: str) -> str:
    """uploads/foo.tar.gz  → foo; uploads/foo.zip → foo."""
    n = name
    for ext in _ARCHIVE_EXTS:
        if n.lower().endswith(ext):
            return n[: -len(ext)]
    return n


def _read_sidecar(p: Path) -> dict:
    meta_path = p / "_metadata.json"
    if not meta_path.is_file():
        return {}
    try:
        return json.loads(meta_path.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def _scan_directories(gen_dir: Path, base: Path) -> dict[str, dict]:
    """Walk generated/* → entry dict keyed by name, also upsert Instance rows."""
    by_name: dict[str, dict] = {}
    if not gen_dir.is_dir():
        return by_name
    for p in sorted(gen_dir.iterdir()):
        if not p.is_dir():
            continue
        files = [f for f in p.rglob("*") if f.is_file()]
        meta = _read_sidecar(p)
        entry = {
            "name": p.name,
            "path": str(p.relative_to(base)),
            "file_count": len(files),
            "size": sum(f.stat().st_size for f in files),
            "mtime": p.stat().st_mtime,
            "download_url": f"/api/generated/{p.name}/archive",
            "format": "tar.gz",
            "xapp_type": meta.get("type", ""),
            "persona": meta.get("persona", ""),
            "notes": meta.get("notes", ""),
            "based_on": meta.get("based_on_paper", "") or meta.get("based_on", ""),
            "controls": meta.get("controls", {}) or {},
            "session_id": meta.get("session_id", "") or "",
        }
        _upsert_instance(p, entry)
        by_name[p.name] = entry
    return by_name


def _upsert_instance(p: Path, entry: dict) -> None:
    """Mirror filesystem state into the DB. Idempotent."""
    session_obj = None
    sid = entry["session_id"]
    if sid:
        try:
            session_obj = Session.objects.get(id=sid)
        except (Session.DoesNotExist, ValueError):
            session_obj = None
    try:
        Instance.objects.update_or_create(
            name=p.name,
            defaults={
                "persona": entry["persona"],
                "controls": entry["controls"],
                "output_path": entry["path"],
                "status": "generated",
                "session": session_obj,
            },
        )
    except Exception:
        # listing must never fail because of a DB hiccup
        pass


def _add_uploaded_archives(by_name: dict[str, dict], uploads_dir: Path, base: Path) -> None:
    """Merge pre-built archive metadata in. If we have both a source dir
    and a matching archive, the archive's download_url wins (cheaper)."""
    if not uploads_dir.is_dir():
        return
    for p in sorted(uploads_dir.iterdir()):
        if not p.is_file():
            continue
        if p.suffix.lower() not in {".zip", ".gz", ".tgz", ".tar"}:
            continue
        stem = _archive_stem(p.name)
        existing = by_name.get(stem)
        if existing:
            existing["size"] = p.stat().st_size
            existing["download_url"] = f"/api/files/?path={p.relative_to(base)}"
            existing["format"] = p.suffix.lstrip(".")
            continue
        by_name[stem] = {
            "name": stem,
            "path": str(p.relative_to(base)),
            "size": p.stat().st_size,
            "mtime": p.stat().st_mtime,
            "download_url": f"/api/files/?path={p.relative_to(base)}",
            "format": p.suffix.lstrip("."),
        }


# ────────── HTTP endpoints ──────────


@require_GET
def list_generated(request):
    base = Path(settings.REPO_ROOT)
    by_name = _scan_directories(base / "generated", base)
    _add_uploaded_archives(by_name, base / "uploads", base)
    items = sorted(by_name.values(), key=lambda x: x["mtime"], reverse=True)
    return JsonResponse({"items": items})


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_generated(request, name):
    """Remove the source tree under `generated/<name>/` AND any
    matching pre-built archive directly under `uploads/`."""
    base = Path(settings.REPO_ROOT)
    safe = name.replace("/", "_").replace("\\", "_")
    deleted: list[str] = []

    gen_dir = base / "generated" / safe
    if gen_dir.is_dir():
        shutil.rmtree(gen_dir)
        deleted.append(str(gen_dir.relative_to(base)))

    uploads_dir = base / "uploads"
    if uploads_dir.is_dir():
        for p in uploads_dir.iterdir():
            if p.is_file() and _archive_stem(p.name) == safe:
                p.unlink()
                deleted.append(str(p.relative_to(base)))

    if not deleted:
        return HttpResponseNotFound("xapp not found")
    return JsonResponse({"deleted": deleted})


@require_GET
def generated_archive(request, name):
    """Stream a tar.gz of `generated/<name>/` on demand."""
    base = Path(settings.REPO_ROOT)
    safe = name.replace("/", "_").replace("\\", "_")
    target = base / "generated" / safe
    if not target.is_dir():
        return HttpResponseNotFound("xapp not found")

    def stream():
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            tar.add(str(target), arcname=safe)
        buf.seek(0)
        while True:
            chunk = buf.read(64 * 1024)
            if not chunk:
                break
            yield chunk

    response = StreamingHttpResponse(stream(), content_type="application/gzip")
    response["Content-Disposition"] = f'attachment; filename="{safe}.tar.gz"'
    return response
