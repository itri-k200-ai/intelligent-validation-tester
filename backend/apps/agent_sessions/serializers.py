from rest_framework import serializers

from .models import (
    AgentArtifact, AgentCommand, AgentSession, AgentStep,
    Evidence, TestCaseResult,
)


class TestCaseResultSerializer(serializers.ModelSerializer):
    test_case_label = serializers.SerializerMethodField(read_only=True)
    evidence_count = serializers.IntegerField(source="evidence.count", read_only=True)

    class Meta:
        model = TestCaseResult
        fields = ("id", "session", "test_case", "case_id_raw", "case_name",
                  "status", "observed", "notes", "executed_at",
                  "test_case_label", "evidence_count")
        read_only_fields = ("id", "executed_at", "test_case_label", "evidence_count")

    def get_test_case_label(self, obj):
        if obj.test_case:
            return f"{obj.test_case.case_id} {obj.test_case.name}"
        return obj.case_id_raw or obj.case_name


class EvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Evidence
        fields = ("id", "session", "result", "kind", "name",
                  "text_content", "storage_key", "content_type", "size_bytes",
                  "sha256", "captured_with", "captured_at",
                  "description", "created_at")
        read_only_fields = ("id", "created_at")


class AgentCommandSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentCommand
        fields = ("id", "step", "command", "stdout", "stderr",
                  "exit_code", "duration_ms", "created_at")
        read_only_fields = ("id", "created_at")


class AgentArtifactSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentArtifact
        fields = ("id", "session", "relpath", "text_content", "storage_key",
                  "content_type", "size_bytes", "sha256", "description",
                  "created_at")
        read_only_fields = ("id", "created_at")


class AgentStepSerializer(serializers.ModelSerializer):
    commands = AgentCommandSerializer(many=True, read_only=True)

    class Meta:
        model = AgentStep
        fields = ("id", "session", "seq", "role", "text", "created_at", "commands")
        read_only_fields = ("id", "created_at", "commands")


class AgentSessionSerializer(serializers.ModelSerializer):
    steps = AgentStepSerializer(many=True, read_only=True)
    started_by_name = serializers.CharField(source="started_by.username", read_only=True)
    dut_name = serializers.CharField(source="dut.name", read_only=True)
    cited_documents_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AgentSession
        fields = (
            "id", "agent_session_id", "title", "mode",
            "dut", "dut_name", "scenario",
            "status", "summary", "cited_documents", "cited_documents_detail",
            "started_at", "ended_at", "started_by", "started_by_name",
            "steps",
        )
        read_only_fields = ("id", "started_at", "started_by", "started_by_name",
                            "dut_name", "cited_documents_detail", "steps")

    def get_cited_documents_detail(self, obj):
        return [
            {"id": str(d.id), "doc_number": d.doc_number, "name": d.name,
             "issuing_body": d.issuing_body, "status": d.status}
            for d in obj.cited_documents.all()
        ]


class AgentSessionListSerializer(serializers.ModelSerializer):
    """List view — 不帶 steps 避免大 payload。"""
    dut_name = serializers.CharField(source="dut.name", read_only=True)
    step_count = serializers.IntegerField(source="steps.count", read_only=True)
    command_count = serializers.SerializerMethodField(read_only=True)
    artifact_count = serializers.IntegerField(source="artifacts.count", read_only=True)
    case_result_count = serializers.SerializerMethodField(read_only=True)
    pass_count = serializers.SerializerMethodField(read_only=True)
    fail_count = serializers.SerializerMethodField(read_only=True)
    evidence_count = serializers.IntegerField(source="evidence.count", read_only=True)

    class Meta:
        model = AgentSession
        fields = (
            "id", "agent_session_id", "title", "mode", "dut", "dut_name",
            "status", "summary",
            "started_at", "ended_at",
            "step_count", "command_count", "artifact_count",
            "case_result_count", "pass_count", "fail_count", "evidence_count",
        )

    def get_command_count(self, obj):
        from .models import AgentCommand
        return AgentCommand.objects.filter(step__session=obj).count()

    def get_case_result_count(self, obj):
        return obj.case_results.count()

    def get_pass_count(self, obj):
        return obj.case_results.filter(status="pass").count()

    def get_fail_count(self, obj):
        return obj.case_results.filter(status="fail").count()
