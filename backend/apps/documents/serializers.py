from rest_framework import serializers

from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.username", read_only=True)
    download_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Document
        fields = (
            "id", "name", "doc_type",
            "issuing_body", "doc_number", "version",
            "publication_date", "status",
            "source_url",
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
        # 回相對路徑，避免 nginx 不帶 port 的 Host header 讓
        # build_absolute_uri 算出 http://localhost/... 跳到 :80。
        # 瀏覽器收到相對 URL 自己用 current origin 補。
        return f"/api/documents/{obj.id}/download/"


class DocumentUploadSerializer(serializers.Serializer):
    """multipart/form-data 上傳專用。其他欄位（doc_type 等）走 form。"""
    file = serializers.FileField()
    name = serializers.CharField(max_length=300, required=False, allow_blank=True)
    doc_type = serializers.ChoiceField(choices=Document.DocType.choices)
    issuing_body = serializers.ChoiceField(
        choices=Document.IssuingBody.choices, required=False, allow_blank=True,
    )
    doc_number = serializers.CharField(max_length=64, required=False, allow_blank=True)
    version = serializers.CharField(max_length=64, required=False, allow_blank=True)
    publication_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.ChoiceField(
        choices=Document.Status.choices, required=False, allow_blank=True,
    )
    source_url = serializers.URLField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
