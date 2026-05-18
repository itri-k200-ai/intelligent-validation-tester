"""Instance-scoped file endpoints — list / preview / tarball of an
Instance's `output_path` directory.

Currently underused (instances are rarely created from chat), but kept
for the `/instances/<id>` page and future programmatic flows.
"""

import io
import mimetypes
import tarfile
from pathlib import Path

from django.conf import settings
from django.http import (
    FileResponse,
    HttpResponseBadRequest,
    HttpResponseNotFound,
    JsonResponse,
    StreamingHttpResponse,
)
from django.views.decorators.http import require_GET

from ..models import Instance
from ._safe_path import safe_child


_MAX_PREVIEW_BYTES = 256 * 1024


def _resolve_output(instance: Instance) -> Path | None:
    if not instance.output_path:
        return None
    base = Path(settings.REPO_ROOT)
    candidate = (base / instance.output_path).resolve()
    try:
        candidate.relative_to(base.resolve())
    except ValueError:
        return None
    return candidate if candidate.is_dir() else None


@require_GET
def list_files(request, instance_id):
    try:
        instance = Instance.objects.get(id=instance_id)
    except Instance.DoesNotExist:
        return HttpResponseNotFound("instance not found")
    root = _resolve_output(instance)
    if root is None:
        return JsonResponse({"files": [], "note": "no output_path set"})
    entries = []
    for path in sorted(root.rglob("*")):
        if path.is_file():
            entries.append({
                "path": path.relative_to(root).as_posix(),
                "size": path.stat().st_size,
            })
    return JsonResponse({
        "root": str(root.relative_to(settings.REPO_ROOT)),
        "files": entries,
    })


@require_GET
def read_file(request, instance_id, relpath):
    try:
        instance = Instance.objects.get(id=instance_id)
    except Instance.DoesNotExist:
        return HttpResponseNotFound("instance not found")
    root = _resolve_output(instance)
    if root is None:
        return HttpResponseNotFound("no output_path")
    target = safe_child(root, relpath)
    if target is None or not target.is_file():
        return HttpResponseNotFound("file not found")
    if target.stat().st_size > _MAX_PREVIEW_BYTES:
        return HttpResponseBadRequest("file too large for inline preview")
    content_type, _ = mimetypes.guess_type(target.name)
    return FileResponse(
        open(target, "rb"), content_type=content_type or "text/plain"
    )


@require_GET
def tarball(request, instance_id):
    try:
        instance = Instance.objects.get(id=instance_id)
    except Instance.DoesNotExist:
        return HttpResponseNotFound("instance not found")
    root = _resolve_output(instance)
    if root is None:
        return HttpResponseNotFound("no output to package")

    arcname = instance.name or root.name

    def stream():
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            tar.add(str(root), arcname=arcname)
        buf.seek(0)
        while True:
            chunk = buf.read(64 * 1024)
            if not chunk:
                break
            yield chunk

    response = StreamingHttpResponse(stream(), content_type="application/gzip")
    response["Content-Disposition"] = f'attachment; filename="{arcname}.tar.gz"'
    return response
