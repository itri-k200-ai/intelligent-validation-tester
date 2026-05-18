"""Generic safe-download endpoint: `GET /api/files/?path=<rel>`.

Used by:
  - the chat UI's `linkifyWorkspaceFiles` (turns /workspace/X.zip into clickable)
  - the Outputs panel for prebuilt archives
"""

import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import (
    FileResponse,
    HttpResponseBadRequest,
    HttpResponseNotFound,
)
from django.views.decorators.http import require_GET

from ._safe_path import safe_join


_ARCHIVE_EXTS = {".zip", ".gz", ".tar", ".tgz", ".7z"}


@require_GET
def workspace_file(request):
    rel = request.GET.get("path", "")
    if not rel:
        return HttpResponseBadRequest("missing path")
    base = Path(settings.REPO_ROOT)
    target = safe_join(base, rel)
    if target is None:
        return HttpResponseNotFound("outside workspace")
    if not target.is_file():
        return HttpResponseNotFound("file not found")

    content_type, _ = mimetypes.guess_type(target.name)
    # Force download for archives; inline-render (browser-default) otherwise.
    force_download = (
        request.GET.get("download") == "1"
        or target.suffix.lower() in _ARCHIVE_EXTS
    )
    response = FileResponse(
        open(target, "rb"),
        content_type=content_type or "application/octet-stream",
    )
    if force_download:
        response["Content-Disposition"] = f'attachment; filename="{target.name}"'
    return response
