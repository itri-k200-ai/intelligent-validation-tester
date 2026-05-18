"""File upload endpoint — stores attachments under uploads/<session_id>/.

Files land on the bind-mounted workspace volume so the claude CLI subprocess
can read them via its Read tool using absolute paths.
"""

import re
import unicodedata
from pathlib import Path

from django.conf import settings
from django.http import HttpResponseBadRequest, HttpResponseNotFound, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Session


MAX_FILES = 8
MAX_BYTES = 50 * 1024 * 1024  # 50 MiB per file


def _safe_name(name: str) -> str:
    name = unicodedata.normalize("NFKD", name)
    name = name.replace("/", "_").replace("\\", "_")
    name = re.sub(r"[^A-Za-z0-9._\-一-鿿]", "_", name)
    return name[:200] or "file"


def _session_dir(session_id) -> Path:
    base = Path(settings.REPO_ROOT) / "uploads" / str(session_id)
    base.mkdir(parents=True, exist_ok=True)
    return base


@csrf_exempt
@require_http_methods(["POST", "GET"])
def session_uploads(request, session_id):
    try:
        Session.objects.get(id=session_id)
    except Session.DoesNotExist:
        return HttpResponseNotFound("session not found")

    sdir = _session_dir(session_id)

    if request.method == "GET":
        files = [
            {"filename": p.name, "size": p.stat().st_size,
             "path": str(p.relative_to(settings.REPO_ROOT))}
            for p in sorted(sdir.iterdir())
            if p.is_file()
        ]
        return JsonResponse({"files": files})

    incoming = request.FILES.getlist("files") or (
        [request.FILES["file"]] if "file" in request.FILES else []
    )
    if not incoming:
        return HttpResponseBadRequest("no files in 'files' or 'file' field")
    if len(incoming) > MAX_FILES:
        return HttpResponseBadRequest(f"max {MAX_FILES} files per request")

    saved = []
    for f in incoming:
        if f.size > MAX_BYTES:
            return HttpResponseBadRequest(
                f"{f.name}: exceeds {MAX_BYTES // (1024 * 1024)} MiB limit"
            )
        target = sdir / _safe_name(f.name)
        with open(target, "wb") as out:
            for chunk in f.chunks():
                out.write(chunk)
        saved.append({
            "filename": target.name,
            "size": target.stat().st_size,
            "path": str(target.relative_to(settings.REPO_ROOT)),
            "abs_path": str(target),
        })
    return JsonResponse({"files": saved}, status=201)
