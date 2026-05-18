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

    def create(self, validated):
        return _auto_decode_binary_then_create(Evidence, validated, bucket="evidence")


# ─── 共用 helper ───────────────────────────────────────────────────────
import base64 as _b64
import uuid as _uuid
from core import storage as _storage


_BINARY_MAGICS = {
    "JVBER": ("application/pdf", "%PDF"),   # PDF base64
    "iVBOR": ("image/png", b"\x89PNG"),     # PNG base64
    "/9j/":  ("image/jpeg", b"\xff\xd8\xff"),  # JPEG base64
}


def _auto_decode_binary_then_create(model_cls, validated, bucket):
    """如果 text_content 看起來是 binary base64（PDF/PNG/JPEG），自動 decode
    + 上 MinIO + 用 storage_key，不污染 DB row。
    Agent prompt 例子裡 text_content 是給「小文字檔」用的，不該塞 binary
    base64—這層攔截避免 download endpoint 吐出 base64 字串。"""
    tc = (validated.get("text_content") or "").strip()
    if not tc:
        return model_cls.objects.create(**validated)
    matched_ct, magic = None, None
    for prefix, (ct, m) in _BINARY_MAGICS.items():
        if tc.startswith(prefix):
            matched_ct, magic = ct, m
            break
    if not matched_ct:
        return model_cls.objects.create(**validated)
    try:
        binary = _b64.b64decode(tc, validate=False)
    except Exception:
        return model_cls.objects.create(**validated)
    if not binary.startswith(magic if isinstance(magic, bytes) else magic.encode()):
        return model_cls.objects.create(**validated)
    # 真的是 binary，移到 MinIO
    ext = {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg"}[matched_ct]
    key = f"{_uuid.uuid4()}{ext}"
    meta = _storage.upload_bytes(bucket, key, binary, matched_ct)
    validated["text_content"] = ""
    validated["storage_key"] = meta["storage_key"]
    validated["size_bytes"] = meta["size_bytes"]
    validated["sha256"] = meta["sha256"]
    if not validated.get("content_type"):
        validated["content_type"] = matched_ct
    return model_cls.objects.create(**validated)


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

    def create(self, validated):
        return _auto_decode_binary_then_create(AgentArtifact, validated, bucket="agent-artifacts")


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
