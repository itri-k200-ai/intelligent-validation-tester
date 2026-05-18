from rest_framework.routers import DefaultRouter

from .views import (
    AgentArtifactViewSet,
    AgentCommandViewSet,
    AgentSessionViewSet,
    AgentStepViewSet,
    EvidenceViewSet,
    TestCaseResultViewSet,
)

router = DefaultRouter()
router.register("agent-sessions", AgentSessionViewSet, basename="agent-session")
router.register("agent-steps", AgentStepViewSet, basename="agent-step")
router.register("agent-commands", AgentCommandViewSet, basename="agent-command")
router.register("agent-artifacts", AgentArtifactViewSet, basename="agent-artifact")
router.register("testcase-results", TestCaseResultViewSet, basename="testcase-result")
router.register("evidence", EvidenceViewSet, basename="evidence")

urlpatterns = router.urls
