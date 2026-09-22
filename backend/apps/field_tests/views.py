"""場域測試(智慧網路中牆)對外代理。

前端只打這裡,不直打 Performance_tester:金鑰只在後端,而且只有後端那台
連得到場域網段。回傳形狀已經轉成前端要的樣子(見 transform)。
"""

from __future__ import annotations

import logging
import time

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import client, transform
from .targets import ctrl_path, target

logger = logging.getLogger(__name__)


def _error(exc: client.PerfTesterError) -> Response:
    return Response({"detail": exc.detail}, status=exc.status)


class WallReadView(APIView):
    """牆面唯讀資料的基底。

    中牆是無人看顧的展示機(沒有人會去登入),和 apps/selection 一樣開 AllowAny。
    這裡全是唯讀代理,寫入動作(觸發 / 中止驗測)另外要求登入。

    authentication_classes 也要清掉:光給 AllowAny 不夠 —— DRF 會先跑認證,
    瀏覽器帶著過期 JWT 時會直接 401,牆面就整片變「—」。不認證就不會有這問題。
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]


def _vehicle_extras(scenario: str) -> tuple[dict | None, dict | None]:
    """/live 以外的載具狀態:AMR 的速度 / 電量 / 定位品質在 /robot,UAV 的電量在 /targets。

    都是附帶的 —— 拿不到就讓那幾格空著,不要連訊號一起沒有。回 (robot, targets)。
    """
    robot = targets = None
    try:
        if scenario == "indoor":
            robot = client.get(ctrl_path(scenario, "/robot"))
        else:
            targets = client.get(ctrl_path(scenario, "/targets"))
    except client.PerfTesterError as exc:
        logger.info("載具狀態(%s)拿不到(%s),只顯示 /live 的部分", scenario, exc.detail)
    return robot, targets


class LiveView(WallReadView):
    """GET /api/field-tests/live/<scenario>/ —— 即時數值(建議 1~2 秒輪詢)。

    AMR 多打 /robot(速度、電量、定位品質不在 /live);UAV 多打 /targets(電量)。
    """

    def get(self, request, scenario: str):
        """/live 是主角(訊號、位置、yaw 都在裡面);其餘見 _vehicle_extras。"""
        try:
            live = (client.get(ctrl_path(scenario, "/live")) or {}).get("live") or {}
        except client.PerfTesterError as exc:
            return _error(exc)

        robot, targets = _vehicle_extras(scenario)

        return Response(
            {
                "ts": live.get("ts"),
                "link": transform.link(live),
                "vehicle": transform.vehicle(scenario, live, robot, None, targets),
                "position": transform.position(scenario, live, None),
                # UAV 的即時位置是 GPS,不能放進 position(那是公尺座標),由前端換算
                "geo": transform.geo(live) if scenario != "indoor" else None,
            }
        )


class MissionView(WallReadView):
    """GET /api/field-tests/missions/<scenario>/ —— 這次驗測的兩趟資料。

    ?run_id= 指定某次(省略就用 FIELD_TEST_TARGETS 設的 plan 最新一次);
    ?since_seq= 增量拉樣本(把上次回應的 next_seq 帶回來)。
    路徑幾何(route)不在這裡 —— 那是前端 config 的場域規劃,不是量測結果。
    """

    def get(self, request, scenario: str):
        run_id = request.query_params.get("run_id")
        since_seq = request.query_params.get("since_seq", "0")
        try:
            conf = target(scenario)
            if not run_id:
                run_id = _latest_run_id(conf.get("plan_id"))
            if not run_id:
                return Response({"detail": "目前沒有可顯示的驗測紀錄"}, status=404)

            status_payload = client.get(f"/ext/validations/{run_id}")
            samples_payload = client.get(
                f"/ext/validations/{run_id}/samples",
                params={"source": "ue", "since_seq": since_seq, "limit": 5000},
            )
        except client.PerfTesterError as exc:
            return _error(exc)

        # 即時遙測是附帶的:拿不到就只回驗測數據,不要整包失敗
        live: dict = {}
        robot = targets = None
        try:
            live = (client.get(ctrl_path(scenario, "/live")) or {}).get("live") or {}
            robot, targets = _vehicle_extras(scenario)
        except client.PerfTesterError as exc:
            logger.info("即時遙測拿不到(%s),只回驗測數據", exc.detail)

        runs = transform.build_runs(status_payload, samples_payload.get("samples") or [])
        current = 1 if runs[1]["status"] != "pending" else 0
        if runs[current]["status"] == "running":
            runs[current]["position"] = transform.position(scenario, live, None)

        return Response(
            {
                "runId": run_id,
                "status": status_payload.get("status"),
                "nextSeq": samples_payload.get("next_seq"),
                "phases": status_payload.get("phases") or {},
                "currentRun": current,
                "runs": runs,
                "vehicle": transform.vehicle(scenario, live, robot, None, targets),
                "link": transform.link(live),
            }
        )


def _latest_run_id(plan_id: str | None) -> str | None:
    """沒指定 run_id:拿這個 plan 最新一次(執行中的優先)。

    A6(GET /ext/validations)的回應形狀文件沒寫明,所以同時容忍「直接一個
    list」與幾種常見的包裝鍵;真的對接上之後可以把這裡收斂成實際那一種。
    """
    payload = client.get("/ext/validations")
    if isinstance(payload, list):
        runs = payload
    else:
        runs = (
            payload.get("validations")
            or payload.get("runs")
            or payload.get("items")
            or payload.get("results")
            or []
        )
    runs = [r for r in runs if isinstance(r, dict)]
    if plan_id:
        runs = _runs_of_plan(runs, plan_id)
    if not runs:
        return None
    running = [r for r in runs if r.get("status") in {"running", "ready"}]
    if running:
        return running[0].get("run_id") or running[0].get("id")

    # 沒有在跑的就挑最新一次(created 是 epoch 秒)。但平台上留著不少半途失敗的紀錄:
    # 有的一筆樣本都沒收到(status=error、phases={}),有的只跑完第一趟 —— 這張卡是
    # 「啟用前後」比較,抓到這種牆上會整片或半片變「—」。所以已結束的紀錄優先挑
    # 最近一次兩趟都有資料的,退而求其次才是最近一次有任何資料的。
    # (正在跑的那筆在上面就先回掉了,不會被這裡的偏好蓋掉。)
    newest = sorted(runs, key=lambda r: r.get("created") or 0, reverse=True)
    complete = [r for r in newest if _has_both_passes(r)]
    with_samples = [r for r in newest if r.get("n_samples") is None or r.get("n_samples")]
    pick = (complete or with_samples or newest)[0]
    return pick.get("run_id") or pick.get("id")


_PLAN_ENV_TTL_S = 300.0
_plan_env_cache: dict[str, tuple[float, str | None]] = {}


def _plan_env_id(plan_id: str) -> str | None:
    """方案的環境 ID(spec.env_id)。方案很少改,快取 5 分鐘,不用每次多打一支。"""
    hit = _plan_env_cache.get(plan_id)
    if hit and time.monotonic() - hit[0] < _PLAN_ENV_TTL_S:
        return hit[1]
    payload = client.get(f"/pipeline-plans/{plan_id}") or {}
    plan = payload.get("plan") or payload
    env_id = (plan.get("spec") or {}).get("env_id")
    _plan_env_cache[plan_id] = (time.monotonic(), env_id)
    return env_id


def _runs_of_plan(runs: list[dict], plan_id: str) -> list[dict]:
    """只留這個方案的驗測紀錄。

    平台的驗測紀錄實測沒有 plan_id(/ext/validations 與 /validation-runs 都是 None),
    只有 meta.environment_id;而室內、室外兩個方案的 env_id 不同。所以先照 plan_id 對,
    對不到再用方案的 env_id 對。兩者都對不到就是「沒有這個情境的紀錄」—— 寧可空著,
    也不要把另一個情境的資料放上牆(之前就發生過室外牆顯示室內 AMR 的驗測)。
    """
    by_plan = [r for r in runs if str(r.get("plan_id") or "") == str(plan_id)]
    if by_plan:
        return by_plan
    env_id = _plan_env_id(plan_id)
    if not env_id:
        return []
    return [r for r in runs if str((r.get("meta") or {}).get("environment_id") or "") == env_id]


def _has_both_passes(run: dict) -> bool:
    """兩趟都收到足夠的資料。

    phases 是 {階段名: 筆數},階段名由平台決定,所以只看值。實測會出現
    {優化前: 62, 優化後: 1} 這種「第二趟剛起步就斷掉」的紀錄 —— 一筆樣本畫不成
    對照,所以要求短的那趟至少有長的一半(比用絕對筆數更不怕取樣週期改變)。
    """
    counts = list((run.get("phases") or {}).values())
    return len(counts) >= 2 and all(counts) and min(counts) * 2 >= max(counts)


class PlanListView(WallReadView):
    """GET /api/field-tests/plans/ —— 可觸發的方案(A1)。"""

    def get(self, request):
        try:
            return Response(client.get("/pipeline-plans"))
        except client.PerfTesterError as exc:
            return _error(exc)


class RunCreateView(APIView):
    """寫入動作保留登入要求(牆面只看不按)。"""

    permission_classes = [IsAuthenticated]

    """POST /api/field-tests/runs/ —— 觸發一次驗測(A2)。"""

    def post(self, request):
        plan_id = request.data.get("plan_id")
        if not plan_id:
            return Response({"detail": "缺 plan_id"}, status=422)
        body = {"plan_id": plan_id}
        for key in ("collect_period_s", "mode"):
            if key in request.data:
                body[key] = request.data[key]
        try:
            return Response(client.post("/ext/validations", json=body))
        except client.PerfTesterError as exc:
            return _error(exc)


class RunAbortView(APIView):
    permission_classes = [IsAuthenticated]

    """POST /api/field-tests/runs/<run_id>/abort/ —— 中止(A5)。"""

    def post(self, request, run_id: str):
        try:
            return Response(client.post(f"/ext/validations/{run_id}/abort"))
        except client.PerfTesterError as exc:
            return _error(exc)


class CameraStreamView(WallReadView):
    """GET /api/field-tests/camera/<scenario>/stream —— 車載影像(B6,MJPEG)。

    這是長連線:nginx 那段要 proxy_buffering off,否則畫面出不來。
    上游同時最多 3 路,前端不看就要把 <img> 移除。
    """

    suffix = "/camera/stream"

    def get(self, request, scenario: str):
        try:
            content_type, chunks = client.stream(ctrl_path(scenario, self.suffix))
        except client.PerfTesterError as exc:
            return _error(exc)
        resp = StreamingHttpResponse(chunks, content_type=content_type)
        resp["Cache-Control"] = "no-store"
        # 給 nginx 的提示,免得被 buffer 住
        resp["X-Accel-Buffering"] = "no"
        return resp


class CameraSnapshotView(CameraStreamView):
    """GET /api/field-tests/camera/<scenario>/snapshot —— 單張 JPEG。"""

    suffix = "/camera/snapshot"


class CameraStatusView(WallReadView):
    """GET /api/field-tests/camera/<scenario>/ —— 先查有沒有在推流再開(B6)。"""

    def get(self, request, scenario: str):
        try:
            payload = client.get(ctrl_path(scenario, "/camera"))
        except client.PerfTesterError as exc:
            return _error(exc)
        # 前端要的是「能不能播」與播放位址,位址一律走我們自己的代理
        if not isinstance(payload, dict):
            payload = {"camera": payload}
        payload["stream_url"] = f"/api/field-tests/camera/{scenario}/stream"
        payload["snapshot_url"] = f"/api/field-tests/camera/{scenario}/snapshot"
        return Response(payload)


class TargetsView(WallReadView):
    """GET /api/field-tests/targets/ —— 目前設定對到哪個控制器,部署時對帳用。"""

    def get(self, request):
        conf = dict(getattr(settings, "FIELD_TEST_TARGETS", {}) or {})
        return Response({"targets": conf, "base": getattr(settings, "PERF_TESTER_BASE", "")})


# ── 室外底圖:平台場景的向量地圖 ─────────────────────────────────────────

_SCENE_TTL_S = 600.0
_scene_cache: dict[str, tuple[float, dict]] = {}


def _scene_id(scenario: str) -> str | None:
    """情境對應的平台場景。設定有指定 scene_id 就用它;沒有就找「綁在這台載具連線下」
    的場景(平台的 /scenes 每筆都有 ctrl_conn_id,室外大草皮就綁在無人機那組)。"""
    conf = target(scenario)
    if conf.get("scene_id"):
        return str(conf["scene_id"])
    payload = client.get("/scenes") or {}
    scenes = payload.get("scenes") if isinstance(payload, dict) else payload
    for scene in scenes or []:
        if isinstance(scene, dict) and str(scene.get("ctrl_conn_id") or "") == str(conf["cid"]):
            return str(scene.get("id"))
    return None


class SceneView(WallReadView):
    """GET /api/field-tests/scene/<scenario>/ —— 室外路線圖的底圖(向量地圖)。

    代理平台的 /scenes/{id}/geometry:建築輪廓、道路、綠地(公尺座標)加上
    center_lonlat(經緯度原點)。前端用同一個原點把 GPS 換成公尺,軌跡才疊得上。
    場景幾乎不會變,快取 10 分鐘。
    """

    def get(self, request, scenario: str):
        try:
            scene_id = _scene_id(scenario)
            if not scene_id:
                return Response({"detail": "這個情境在平台上沒有對應的場景"}, status=404)
            hit = _scene_cache.get(scene_id)
            if hit and time.monotonic() - hit[0] < _SCENE_TTL_S:
                return Response(hit[1])
            geometry = client.get(f"/scenes/{scene_id}/geometry") or {}
        except client.PerfTesterError as exc:
            return _error(exc)

        center = geometry.get("center_lonlat") or []
        body = {
            "sceneId": scene_id,
            # 平台給的是 [lon, lat];轉成具名欄位,前端不必記順序
            "center": (
                {"lon": center[0], "lat": center[1]}
                if isinstance(center, list) and len(center) == 2
                else None
            ),
            "bounds": geometry.get("bounds_m"),
            # 建築帶高度(公尺),3D 地圖依它立起來
            "buildings": [
                {"footprint": b.get("footprint"), "height": b.get("height")}
                for b in geometry.get("buildings") or []
                if b.get("footprint")
            ],
            "roads": [r.get("line") for r in geometry.get("roads") or [] if r.get("line")],
            "greens": [
                g.get("footprint") for g in geometry.get("greens") or [] if g.get("footprint")
            ],
        }
        _scene_cache[scene_id] = (time.monotonic(), body)
        return Response(body)
