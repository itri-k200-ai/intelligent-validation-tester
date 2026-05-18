"""File-domain endpoints, grouped by what they expose.

Layout (single-responsibility per file):
  workspace.py  — generic safe download of any path under REPO_ROOT
  instances.py  — file tree / preview / tarball, scoped to an Instance
  generated.py  — generated artifact listing / download / delete + sidecar→DB sync

Public surface (imported by urls.py) is re-exported below.
"""

from .generated import delete_generated, generated_archive, list_generated
from .instances import list_files, read_file, tarball
from .workspace import workspace_file

__all__ = [
    "workspace_file",
    "list_files",
    "read_file",
    "tarball",
    "list_generated",
    "generated_archive",
    "delete_generated",
]
