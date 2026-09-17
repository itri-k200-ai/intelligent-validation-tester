"""情境 → 外部平台的控制器 / 方案對應。

外部 API 的即時遙測要 (cid, ref):cid 從 GET /api/ctrl-conns 拿、ref 是控制器代號
(例如 amr-01)。驗測流程要 plan_id(GET /api/pipeline-plans)。
這些是部署時才知道的值,所以放 settings.FIELD_TEST_TARGETS(env 可覆蓋)。
"""

from __future__ import annotations

from django.conf import settings

from .client import PerfTesterError

SCENARIOS = ("outdoor", "indoor")


def target(scenario: str) -> dict:
    if scenario not in SCENARIOS:
        raise PerfTesterError(f"不認得的情境:{scenario}", status=404)
    conf = dict(getattr(settings, "FIELD_TEST_TARGETS", {}).get(scenario) or {})
    if not conf.get("cid") or not conf.get("ref"):
        raise PerfTesterError(
            f"情境 {scenario} 還沒設定控制器(FIELD_TEST_TARGETS.{scenario}.cid / ref)",
            status=503,
        )
    return conf


def ctrl_path(scenario: str, suffix: str = "") -> str:
    """/ctrl-conns/{cid}/controllers/{ref}{suffix}"""
    conf = target(scenario)
    return f"/ctrl-conns/{conf['cid']}/controllers/{conf['ref']}{suffix}"
