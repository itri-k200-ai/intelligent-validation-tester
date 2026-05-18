from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    AgentArtifact, AgentCommand, AgentSession, AgentStep,
    Evidence, TestCaseResult,
)
from .serializers import (
    AgentArtifactSerializer,
    AgentCommandSerializer,
    AgentSessionListSerializer,
    AgentSessionSerializer,
    AgentStepSerializer,
    EvidenceSerializer,
    TestCaseResultSerializer,
)


class AgentSessionViewSet(viewsets.ModelViewSet):
    queryset = AgentSession.objects.select_related("dut", "scenario", "started_by") \
        .prefetch_related("cited_documents", "steps", "artifacts").all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ("status", "mode", "dut", "scenario")
    search_fields = ("title", "summary", "agent_session_id")
    ordering_fields = ("started_at", "ended_at")

    def get_serializer_class(self):
        if self.action == "list":
            return AgentSessionListSerializer
        return AgentSessionSerializer

    def perform_create(self, serializer):
        serializer.save(
            started_by=self.request.user if self.request.user.is_authenticated else None
        )

    @action(detail=True, methods=["get"], url_path="trace")
    def trace(self, request, pk=None):
        """完整 audit trail：steps + 每個 step 的 commands + artifacts。
        給 IVT 戰情室 UI 渲染回朔頁面用。"""
        session = self.get_object()
        steps_data = []
        for step in session.steps.all().prefetch_related("commands"):
            steps_data.append({
                "seq": step.seq,
                "role": step.role,
                "text": step.text,
                "created_at": step.created_at.isoformat(),
                "commands": [
                    {"command": c.command, "stdout": c.stdout[:2000],
                     "stderr": c.stderr[:2000], "exit_code": c.exit_code,
                     "duration_ms": c.duration_ms}
                    for c in step.commands.all()
                ],
            })
        artifacts_data = [
            {"relpath": a.relpath, "size_bytes": a.size_bytes, "sha256": a.sha256,
             "content_type": a.content_type, "description": a.description}
            for a in session.artifacts.all()
        ]
        case_results_data = [
            {
                "case_id": (r.test_case.case_id if r.test_case else r.case_id_raw),
                "case_name": (r.test_case.name if r.test_case else r.case_name),
                "status": r.status,
                "observed": r.observed[:500] if r.observed else "",
                "notes": r.notes[:500] if r.notes else "",
                "executed_at": r.executed_at.isoformat() if r.executed_at else None,
                "evidence_count": r.evidence.count(),
            }
            for r in session.case_results.all().select_related("test_case")
        ]
        evidence_data = [
            {"kind": e.kind, "name": e.name, "size_bytes": e.size_bytes,
             "captured_with": e.captured_with, "description": e.description,
             "result_id": str(e.result_id) if e.result_id else None}
            for e in session.evidence.all()
        ]
        return Response({
            "session": AgentSessionSerializer(session, context={"request": request}).data,
            "steps": steps_data,
            "artifacts": artifacts_data,
            "case_results": case_results_data,
            "evidence": evidence_data,
        })


class AgentStepViewSet(viewsets.ModelViewSet):
    queryset = AgentStep.objects.all()
    serializer_class = AgentStepSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("session", "role")


class AgentCommandViewSet(viewsets.ModelViewSet):
    queryset = AgentCommand.objects.all()
    serializer_class = AgentCommandSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("step",)


class AgentArtifactViewSet(viewsets.ModelViewSet):
    queryset = AgentArtifact.objects.all()
    serializer_class = AgentArtifactSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("session",)


class TestCaseResultViewSet(viewsets.ModelViewSet):
    queryset = TestCaseResult.objects.select_related("session", "test_case").all()
    serializer_class = TestCaseResultSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("session", "test_case", "status")
    search_fields = ("case_id_raw", "case_name")


class EvidenceViewSet(viewsets.ModelViewSet):
    queryset = Evidence.objects.select_related("session", "result").all()
    serializer_class = EvidenceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("session", "result", "kind")
    search_fields = ("name", "description")
