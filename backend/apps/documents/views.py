"""Document CRUD + 上傳 + 下載 redirect。

下載走 server 端產 presigned URL → 302 redirect 給 client。這樣：
- client 不必知道 MinIO 連線資訊
- 權限檢查留在 Django
- 大檔不過 Django，client 直接從 MinIO 拉
"""

import uuid
from pathlib import PurePosixPath

from django.conf import settings
from django.shortcuts import redirect
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core import storage

from .models import Document
from .serializers import DocumentSerializer, DocumentUploadSerializer

_BUCKET = getattr(settings, "DOCUMENTS_BUCKET", "documents")


class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.select_related("uploaded_by").all()
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("doc_type",)
    search_fields = ("name", "version", "description")
    ordering_fields = ("uploaded_at", "name")
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def create(self, request, *args, **kwargs):
        """POST /api/documents/  — multipart upload。

        必填 file + doc_type；name 預設取檔名。"""
        s = DocumentUploadSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        uploaded = s.validated_data["file"]
        data = uploaded.read()

        name = s.validated_data.get("name") or uploaded.name
        # storage key 用 uuid 避免衝突 + 保留副檔名方便瀏覽器辨識。
        ext = PurePosixPath(uploaded.name).suffix
        key = f"{uuid.uuid4()}{ext}"

        meta = storage.upload_bytes(
            bucket=_BUCKET,
            key=key,
            data=data,
            content_type=uploaded.content_type or "application/octet-stream",
        )

        doc = Document.objects.create(
            name=name,
            doc_type=s.validated_data["doc_type"],
            version=s.validated_data.get("version", ""),
            source_url=s.validated_data.get("source_url", ""),
            description=s.validated_data.get("description", ""),
            uploaded_by=request.user if request.user.is_authenticated else None,
            **meta,
        )
        return Response(
            DocumentSerializer(doc, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def perform_destroy(self, instance):
        # 先試刪 MinIO object，失敗也不擋 DB row delete（孤兒由 cron 收）。
        storage.delete_object(_BUCKET, instance.storage_key)
        instance.delete()

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        """302 → MinIO presigned URL（預設 1 小時有效）。"""
        doc = self.get_object()
        url = storage.presigned_download_url(_BUCKET, doc.storage_key, expires_seconds=3600)
        return redirect(url)
