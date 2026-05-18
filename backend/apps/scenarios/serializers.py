from rest_framework import serializers

from .models import TestScenario


class TestScenarioSerializer(serializers.ModelSerializer):
    site_name = serializers.CharField(source="site.name", read_only=True)
    site_region = serializers.CharField(source="site.region", read_only=True)
    site_location = serializers.JSONField(source="site.location", read_only=True)
    source_dut_name = serializers.CharField(source="source_dut.name", read_only=True)
    source_dut_type = serializers.CharField(source="source_dut.type", read_only=True)

    # Provenance — UI 直接拿這幾個欄位 render「來自 X 文件 §Y」+ 下載鈕。
    source_document_name = serializers.CharField(source="source_document.name", read_only=True)
    source_document_type = serializers.CharField(source="source_document.doc_type", read_only=True)
    source_document_version = serializers.CharField(source="source_document.version", read_only=True)
    source_document_download_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TestScenario
        fields = (
            "id", "name",
            "site", "site_name", "site_region", "site_location",
            "source_dut", "source_dut_name", "source_dut_type",
            "validation_type", "dut_type", "ai_case", "category",
            "collected_at", "row_count",
            "description", "parameters",
            "source_document", "source_section",
            "source_document_name", "source_document_type",
            "source_document_version", "source_document_download_url",
            "created_at",
        )
        read_only_fields = (
            "id", "created_at",
            "site_name", "site_region", "site_location",
            "source_dut_name", "source_dut_type",
            "source_document_name", "source_document_type",
            "source_document_version", "source_document_download_url",
        )

    def get_source_document_download_url(self, obj):
        if not obj.source_document_id:
            return None
        request = self.context.get("request")
        path = f"/api/documents/{obj.source_document_id}/download/"
        return request.build_absolute_uri(path) if request else path
