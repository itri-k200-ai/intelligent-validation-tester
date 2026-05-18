from django.db.models import Avg, Count, Q

from apps.applications.models import Application
from apps.platforms.models import Platform
from apps.validations.models import ValidationRun


class OverviewService:
    @classmethod
    def summary(cls) -> dict:
        return {
            "kpis": cls._kpis(),
            "distribution": cls._distribution(),
            "platform_status": cls._platform_status(),
            "recent_runs": cls._recent_runs(),
        }

    @staticmethod
    def _pass_rate(target_type_filter) -> float:
        base = ValidationRun.objects.filter(target_type_filter)
        total = base.exclude(status__in=["pending", "running", "cancelled"]).count()
        if total == 0:
            return 0.0
        passed = base.filter(status="passed").count()
        return round(passed / total, 3)

    @classmethod
    def _kpis(cls) -> dict:
        smo_platform_ids = Platform.objects.filter(type="SMO").values_list("id", flat=True)
        ric_platform_ids = Platform.objects.filter(
            type__in=["Near-RT RIC", "Non-RT RIC"]
        ).values_list("id", flat=True)
        smo_q = Q(target_type="platform", target_id__in=list(smo_platform_ids))
        ric_q = Q(target_type="platform", target_id__in=list(ric_platform_ids))
        return {
            "smo_pass_rate": cls._pass_rate(smo_q),
            "ric_pass_rate": cls._pass_rate(ric_q),
            "intelligence_avg_score": round(
                Application.objects.aggregate(avg=Avg("intelligence_score"))["avg"] or 0, 2
            ),
            "running_tests": ValidationRun.objects.filter(status="running").count(),
        }

    @staticmethod
    def _distribution() -> dict:
        data = ValidationRun.objects.aggregate(
            data_passed=Count("id", filter=Q(status="passed", target_type="platform")),
            data_total=Count("id", filter=Q(target_type="platform")),
            intel_passed=Count("id", filter=Q(status="passed", target_type="application")),
            intel_total=Count("id", filter=Q(target_type="application")),
        )
        return {
            "data_validation": {"passed": data["data_passed"], "total": data["data_total"]},
            "intelligence_validation": {
                "passed": data["intel_passed"], "total": data["intel_total"],
            },
        }

    @staticmethod
    def _platform_status() -> dict:
        smo = Platform.objects.filter(type="SMO").aggregate(
            total=Count("id"),
            passed=Count("id", filter=Q(status="passed")),
        )
        ric = Platform.objects.filter(
            type__in=["Near-RT RIC", "Non-RT RIC"]
        ).aggregate(
            total=Count("id"),
            passed=Count("id", filter=Q(status="passed")),
        )
        return {"smo": smo, "ric": ric}

    @staticmethod
    def _recent_runs(limit: int = 10) -> list[dict]:
        rows = (
            ValidationRun.objects.select_related("scenario")
            .order_by("-started_at")[:limit]
        )
        return [
            {
                "id": str(r.id),
                "target_type": r.target_type,
                "target_id": str(r.target_id),
                "status": r.status,
                "score": r.score,
                "started_at": r.started_at.isoformat(),
            }
            for r in rows
        ]
