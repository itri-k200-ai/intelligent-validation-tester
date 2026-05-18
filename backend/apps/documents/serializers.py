from rest_framework import serializers

from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.username", read_only=True)
    download_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Document
        fields = (
            "id", "name", "doc_type", "version", "source_url",
            "storage_key", "size_bytes", "sha256", "content_type",
            "description",
            "uploaded_by", "uploaded_by_name", "uploaded_at",
            "download_url",
        )
        read_only_fields = (
            "id", "storage_key", "size_bytes", "sha256", "content_type",
            "uploaded_by", "uploaded_by_name", "uploaded_at", "download_url",
        )

    def get_download_url(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        # 走自己的 download endpoint，server 端再產 presigned URL。
        # 這樣 client 不必直接跟 MinIO 講話、權限也由 Django 控。
        return request.build_absolute_uri(f"/api/documents/{obj.id}/download/")


class DocumentUploadSerializer(serializers.Serializer):
    """multipart/form-data 上傳專用。其他欄位（doc_type 等）走 form。"""
    file = serializers.FileField()
    name = serializers.CharField(max_length=300, required=False, allow_blank=True)
    doc_type = serializers.ChoiceField(choices=Document.DocType.choices)
    version = serializers.CharField(max_length=64, required=False, allow_blank=True)
    source_url = serializers.URLField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
