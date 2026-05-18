from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AgentArtifact, AgentCommand, AgentSession, AgentStep
from .serializers import (
    AgentArtifactSerializer,
    AgentCommandSerializer,
    AgentSessionListSerializer,
    AgentSessionSerializer,
    AgentStepSerializer,
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
        return Response({
            "session": AgentSessionSerializer(session, context={"request": request}).data,
            "steps": steps_data,
            "artifacts": artifacts_data,
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
