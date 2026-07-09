from rest_framework import serializers

from .models import DataQualityBaseline, Dut


class DutSerializer(serializers.ModelSerializer):
    site_name = serializers.CharField(source="site.name", read_only=True)
    site_environment = serializers.CharField(source="site.environment", read_only=True)

    class Meta:
        model = Dut
        fields = (
            "id", "site", "site_name", "site_environment",
            "name", "type", "endpoint",
            "interfaces", "status", "response_time_ms", "data_format",
            "last_check", "created_at",
            "access_mode", "access_notes",
            "vendor", "model", "firmware_version", "serial_number",
            "deployed_at", "contact_email", "config_snapshot",
            # 對齊 RICtester（Near-RT RIC）
            "description", "product", "version",
            "e2_mcc", "e2_mnc", "e2_gnb_id", "e2_cell_id",
            "e2_address", "a1_address", "o1_address", "o1_username", "o1_password",
        )
        read_only_fields = ("id", "site_name", "site_environment", "status",
                            "response_time_ms", "data_format", "last_check", "created_at")


class InterfaceTestInputSerializer(serializers.Serializer):
    interfaces = serializers.ListField(child=serializers.ChoiceField(choices=["O1", "A1", "E2"]))


class DataQualityBaselineSerializer(serializers.ModelSerializer):
    test_scenarios_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DataQualityBaseline
        fields = (
            "dut",
            "test_category",
            "supported_ai_cases",
            "test_scenarios",
            "test_scenarios_detail",
            "timeliness_max_lag_sec",
            "min_completeness",
            "min_accuracy",
            "notes",
            "updated_at",
        )
        read_only_fields = ("dut", "test_scenarios_detail", "updated_at")

    def get_test_scenarios_detail(self, obj):
        return [
            {
                "id": str(s.id),
                "name": s.name,
                "category": s.category,
                "ai_case": s.ai_case,
            }
            for s in obj.test_scenarios.all()
        ]
