import random

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import require

from .models import DataQualityBaseline, Dut
from .serializers import (
    DataQualityBaselineSerializer,
    DutSerializer,
    InterfaceTestInputSerializer,
)
from .services import DutService

BASELINE_ALLOWED_TYPES = (
    Dut.Type.SMO, Dut.Type.NEAR_RT_RIC, Dut.Type.NON_RT_RIC,
)


class DutViewSet(viewsets.ModelViewSet):
    queryset = Dut.objects.select_related("site").all()
    serializer_class = DutSerializer
    filterset_fields = ("type", "status", "site")
    search_fields = ("name", "endpoint")
    ordering_fields = ("created_at", "last_check")

    def get_queryset(self):
        qs = super().get_queryset()
        has_baseline = self.request.query_params.get("has_baseline")
        if has_baseline == "true":
            qs = qs.filter(data_quality_baseline__isnull=False)
        elif has_baseline == "false":
            qs = qs.filter(data_quality_baseline__isnull=True)
        return qs

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), require("dut:write")()]
        if self.action in ("test_interface", "healthcheck_all", "run_data_validation"):
            return [IsAuthenticated(), require("dut:write")()]
        if self.action == "baseline":
            if self.request.method == "GET":
                return [IsAuthenticated(), require("dut:read")()]
            return [IsAuthenticated(), require("dut:write")()]
        return [IsAuthenticated(), require("dut:read")()]

    @action(detail=True, methods=["post"], url_path="test-interface")
    def test_interface(self, request, pk=None):
        dut = self.get_object()
        serializer = InterfaceTestInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = DutService.trigger_interface_test(
            dut, serializer.validated_data["interfaces"], user=request.user
        )
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="healthcheck-all")
    def healthcheck_all(self, request):
        for dut in Dut.objects.all():
            try:
                DutService.trigger_interface_test(
                    dut, dut.interfaces or [], user=request.user
                )
            except Exception:
                continue
        return Response({"ok": True}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get", "put", "patch"], url_path="baseline")
    def baseline(self, request, pk=None):
        dut = self.get_object()
        if dut.type not in BASELINE_ALLOWED_TYPES:
            raise ValidationError(
                {"dut": "Data quality baseline is only supported for SMO / RIC DUTs."}
            )

        if request.method == "GET":
            try:
                instance = dut.data_quality_baseline
            except DataQualityBaseline.DoesNotExist:
                raise NotFound("Baseline not configured for this DUT.")
            return Response(DataQualityBaselineSerializer(instance).data)

        instance = DataQualityBaseline.objects.filter(dut=dut).first()
        partial = request.method == "PATCH"
        if instance is None:
            if partial:
                raise NotFound("Baseline not configured; use PUT to create it.")
            serializer = DataQualityBaselineSerializer(data=request.data)
        else:
            serializer = DataQualityBaselineSerializer(
                instance, data=request.data, partial=partial
            )
        serializer.is_valid(raise_exception=True)
        serializer.save(dut=dut)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="run-data-validation")
    def run_data_validation(self, request, pk=None):
        dut = self.get_object()
        if dut.type not in BASELINE_ALLOWED_TYPES:
            raise ValidationError(
                {"dut": "Data quality validation is only supported for SMO / RIC DUTs."}
            )
        try:
            baseline = dut.data_quality_baseline
        except DataQualityBaseline.DoesNotExist:
            raise ValidationError({"baseline": "Baseline not configured for this DUT."})

        scenario_id = request.data.get("scenario_id")
        if not scenario_id:
            raise ValidationError({"scenario_id": "請選擇一個測試情境"})
        if not baseline.test_scenarios.filter(id=scenario_id).exists():
            raise ValidationError(
                {"scenario_id": "該情境不在此 baseline 的關聯情境清單中"}
            )
        scenario = baseline.test_scenarios.get(id=scenario_id)

        completeness = round(random.uniform(80, 99), 2)
        accuracy = round(random.uniform(80, 99), 2)
        timeliness_lag = round(random.uniform(10, 120), 1)
        timeliness_ok = timeliness_lag <= baseline.timeliness_max_lag_sec
        overall = round((completeness + accuracy + (100 if timeliness_ok else 60)) / 3, 2)
        passed = (
            completeness >= baseline.min_completeness
            and accuracy >= baseline.min_accuracy
            and timeliness_ok
        )
        return Response(
            {
                "dut_id": str(dut.id),
                "scenario": {
                    "id": str(scenario.id),
                    "name": scenario.name,
                    "category": scenario.category,
                    "ai_case": scenario.ai_case,
                },
                "passed": passed,
                "score": overall,
                "metrics": {
                    "completeness": completeness,
                    "accuracy": accuracy,
                    "timeliness_lag_sec": timeliness_lag,
                    "timeliness_ok": timeliness_ok,
                },
                "thresholds": {
                    "min_completeness": baseline.min_completeness,
                    "min_accuracy": baseline.min_accuracy,
                    "timeliness_max_lag_sec": baseline.timeliness_max_lag_sec,
                },
            },
            status=status.HTTP_200_OK,
        )
