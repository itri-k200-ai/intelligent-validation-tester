from rest_framework import viewsets

from .models import TestCase, TestScenario
from .serializers import TestCaseSerializer, TestScenarioSerializer


class TestScenarioViewSet(viewsets.ModelViewSet):
    queryset = TestScenario.objects.select_related(
        "site", "source_dut", "source_document"
    ).all()
    serializer_class = TestScenarioSerializer
    filterset_fields = ("validation_type", "category", "dut_type", "ai_case", "site",
                        "source_document")
    search_fields = ("name", "source_section")


class TestCaseViewSet(viewsets.ModelViewSet):
    queryset = TestCase.objects.select_related("scenario").prefetch_related(
        "spec_references", "results"
    ).all()
    serializer_class = TestCaseSerializer
    filterset_fields = ("scenario", "priority")
    search_fields = ("case_id", "name", "tags")
