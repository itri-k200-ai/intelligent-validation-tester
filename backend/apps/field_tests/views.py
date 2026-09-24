"""場域測試(智慧網路中牆)對外代理。

前端只打這裡,不直打 Performance_tester:金鑰只在後端,而且只有後端那台
連得到場域網段。回傳形狀已經轉成前端要的樣子(見 transform)。
"""

from __future__ import annotations

import logging
import time

import httpx
from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import client, history, transform
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


def _last_ue(raw_samples: list[dict]) -> dict:
    """樣本裡最後一筆 ue(顯示歷史紀錄時拿它頂替 /live)。

    上游一筆樣本長 {"seq","t","wall","phase","ue":{...}};由後往前找,取第一個
    有 ue 的。拿不到就回空 dict,呼叫端的行為與「即時遙測拿不到」相同。
    """
    for raw in reversed(raw_samples):
        ue = raw.get("ue")
        if isinstance(ue, dict) and ue:
            return ue
    return {}


# 「附帶的」遙測呼叫的上限。這些都要經 relay 打到車上,載具不通時會等滿全域的
# PERF_TESTER_TIMEOUT —— 牆面的 /missions 會因此被拖到 12 秒(實測)。驗測數據本身
# 不靠它們,所以給一個短上限,拿不到就讓那幾格空著。
OPTIONAL_TELEMETRY_TIMEOUT_S = 2.0


def _vehicle_extras(scenario: str) -> tuple[dict | None, dict | None]:
    """/live 以外的載具狀態:AMR 的速度 / 電量 / 定位品質在 /robot,UAV 的電量在 /targets。

    都是附帶的 —— 拿不到就讓那幾格空著,不要連訊號一起沒有。回 (robot, targets)。
    """
    robot = targets = None
    try:
        if scenario == "indoor":
            robot = client.get(ctrl_path(scenario, "/robot"), timeout=OPTIONAL_TELEMETRY_TIMEOUT_S)
        else:
            targets = client.get(ctrl_path(scenario, "/targets"), timeout=OPTIONAL_TELEMETRY_TIMEOUT_S)
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
                run_id = _run_id_for(scenario, conf.get("plan_id"))
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
            live = (
                client.get(ctrl_path(scenario, "/live"), timeout=OPTIONAL_TELEMETRY_TIMEOUT_S) or {}
            ).get("live") or {}
            robot, targets = _vehicle_extras(scenario)
        except client.PerfTesterError as exc:
            logger.info("即時遙測拿不到(%s),只回驗測數據", exc.detail)

        # 顯示歷史紀錄時 /live 沒有意義(而且載具多半也不在線),上面那段會拿到空的。
        # 改用這次驗測最後一筆樣本的 ue —— 訊號(SINR/RSRP/RSRQ/DL/UL)與位置、yaw
        # 都在裡面,不補的話牆上那兩張小卡整片空白。
        # 速度 / 電量 / 定位品質只存在於即時的 /robot,歷史樣本沒有,那幾格仍是「—」。
        if not live:
            live = _last_ue(samples_payload.get("samples") or [])

        runs = transform.build_runs(status_payload, samples_payload.get("samples") or [])
        current = 1 if runs[1]["status"] != "pending" else 0
        # 執行中 = 車子現在在哪;已結束 = 最後一筆樣本的位置(live 已經被上面
        # 換成最後一筆樣本的 ue)。不設的話歷史紀錄的「位置 x / y」會是空的。
        position = transform.position(scenario, live, None)
        if position:
            runs[current]["position"] = position

        return Response(
            {
                "runId": run_id,
                "status": status_payload.get("status"),
                # 這一次驗測的開始時間(epoch 秒)—— 牆上要標出「現在看的是哪一筆」
                "created": status_payload.get("created"),
                "nextSeq": samples_payload.get("next_seq"),
                "phases": status_payload.get("phases") or {},
                "currentRun": current,
                "runs": runs,
                "vehicle": transform.vehicle(scenario, live, robot, None, targets),
                "link": transform.link(live),
                # 整個驗測流程走到第幾步(進度條用這個,不用行駛進度)
                "process": _process(
                    run_id,
                    status_payload,
                    conf.get("plan_id") if not request.query_params.get("run_id") else None,
                ),
            }
        )


def _validations() -> list[dict]:
    """驗測紀錄清單(A6)。

    GET /ext/validations 的回應形狀文件沒寫明,所以同時容忍「直接一個 list」
    與幾種常見的包裝鍵;真的對接上之後可以把這裡收斂成實際那一種。
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
    return [r for r in runs if isinstance(r, dict)]


def _rid(run: dict) -> str | None:
    return run.get("run_id") or run.get("id")


_ADAPTER_POLL_S = 5.0
_adapter_poll: dict[str, float] = {}


def _adapter_notified() -> dict[str, str] | None:
    """adapter 那邊被通知過的紀錄:runId → notified_at(拿不到就 None)。

    正常情況平台打 adapter 的 POST /autoTest/test/notifyHisShow 之後,adapter 會直接
    轉發到我們的 POST /api/field-tests/history/(它的 NOTIFY_FORWARD_URL),牆面馬上就跟上。
    這裡是**備援**:轉發失敗、或我們這邊剛好在重開時漏接,下次牆面輪詢就會補上。

    兩面牆各自輪詢,這裡再壓成最多每 5 秒問一次;問不到就當作沒有通知,不影響牆面。
    重複通知同一筆時 adapter 會更新 notified_at,所以比對時間就分得出來。
    """
    base = (settings.FIELD_TEST_ADAPTER_BASE or "").rstrip("/")
    if not base:
        return None
    now = time.monotonic()
    if now - _adapter_poll.get("at", 0.0) < _ADAPTER_POLL_S:
        return None
    _adapter_poll["at"] = now
    try:
        res = httpx.get(f"{base}/autoTest/history/notified", timeout=2.0)
        res.raise_for_status()
        items = res.json().get("notified") or []
    except (httpx.HTTPError, ValueError) as exc:
        logger.info("問不到 adapter 的通知清單(%s)", exc)
        return None
    out: dict[str, str] = {}
    for n in items:
        rid = isinstance(n, dict) and n.get("id")
        if rid and n.get("notified_at"):
            out[str(rid)] = str(n["notified_at"])
    return out


_ADAPTER_HISTORY_TTL_S = 30.0
_adapter_history_cache: dict[str, tuple[float, list[dict]]] = {}


def _adapter_history() -> list[dict]:
    """adapter 的歷史清單(每筆同時有平台的 runId 與 adapter 自己的 runningId)。

    平台的規格傳的是 runningId,而我們(跟 Performance_tester)認的是 run_id ——
    兩者不一定相同,所以要靠這張表換算。清單很少變,快取 30 秒。
    """
    base = (settings.FIELD_TEST_ADAPTER_BASE or "").rstrip("/")
    if not base:
        return []
    hit = _adapter_history_cache.get(base)
    if hit and time.monotonic() - hit[0] < _ADAPTER_HISTORY_TTL_S:
        return hit[1]
    try:
        res = httpx.get(f"{base}/autoTest/history", timeout=2.0)
        res.raise_for_status()
        rows = [r for r in (res.json().get("runs") or []) if isinstance(r, dict)]
    except (httpx.HTTPError, ValueError) as exc:
        logger.info("問不到 adapter 的歷史清單(%s)", exc)
        return []
    _adapter_history_cache[base] = (time.monotonic(), rows)
    return rows


def _resolve_run_id(rid: str, known: dict[str, dict]) -> str | None:
    """把平台給的 runningId 換成我們認得的 run_id(本來就是 run_id 就原樣回)。"""
    if rid in known:
        return rid
    for row in _adapter_history():
        if row.get("runningId") == rid and row.get("runId") in known:
            logger.info("runningId %s → run_id %s", rid, row["runId"])
            return row["runId"]
    return None


def _sync_adapter_notices(runs: list[dict]) -> None:
    """把 adapter 上「新被通知」的紀錄變成牆面的指定。

    第一次(Redis 還沒有那筆記錄)只記錄、不切畫面 —— 後端重開不該讓牆跳到
    某一次很久以前的通知。
    """
    notified = _adapter_notified()
    if notified is None:
        return
    seen = history.seen_notices()
    history.remember_notices(notified)
    if seen is None:
        return
    by_id = {_rid(r): r for r in runs if _rid(r)}
    for rid, at in notified.items():
        if seen.get(rid) == at:  # 同一次通知,處理過了
            continue
        run_id = _resolve_run_id(rid, by_id)
        run = by_id.get(run_id) if run_id else None
        scenario = _scenario_of(run) if run else None
        if scenario and run_id:
            history.pin(scenario, run_id)
            logger.info("adapter 通知顯示歷史驗測:%s → %s", scenario, run_id)
        else:
            logger.info("adapter 通知的 %s 對不到室內 / 室外的方案,略過", rid)


def _run_id_for(scenario: str, plan_id: str | None) -> str | None:
    """沒指定 run_id 時,這面牆要顯示哪一次驗測。

    順序:執行中的 > 平台指定的歷史紀錄(notifyHisShow,見 history.py)> 最新一次。
    一有新的驗測開跑就把指定清掉 —— 牆要回到即時,而且那次跑完之後也該跟著新的走。
    """
    runs = _validations()
    # 先看 adapter 有沒有新的「顯示這筆歷史」通知(全部情境一起看,清單只讀一次)
    _sync_adapter_notices(runs)
    if plan_id:
        runs = _runs_of_plan(runs, plan_id)
    if not runs:
        return None
    running = [r for r in runs if r.get("status") in {"running", "ready"}]
    if running:
        history.clear(scenario)
        return _rid(running[0])

    chosen = history.pinned(scenario)
    if chosen:
        if any(_rid(r) == chosen for r in runs):
            return chosen
        # 指定的那筆不屬於這個情境(或已經被平台刪了)—— 清掉,照常挑最新一次
        logger.info("歷史指定 %s 不在 %s 的紀錄裡,改用最新一次", chosen, scenario)
        history.clear(scenario)

    # 沒有在跑的就挑最新一次(created 是 epoch 秒)。但平台上留著不少半途失敗的紀錄:
    # 有的一筆樣本都沒收到(status=error、phases={}),有的只跑完第一趟 —— 這張卡是
    # 「啟用前後」比較,抓到這種牆上會整片或半片變「—」。所以已結束的紀錄優先挑
    # 最近一次兩趟都有資料的,退而求其次才是最近一次有任何資料的。
    # (正在跑的那筆在上面就先回掉了,不會被這裡的偏好蓋掉。)
    newest = sorted(runs, key=lambda r: r.get("created") or 0, reverse=True)
    complete = [r for r in newest if _has_both_passes(r)]
    with_samples = [r for r in newest if r.get("n_samples") is None or r.get("n_samples")]
    pick = (complete or with_samples or newest)[0]
    return _rid(pick)


_PLAN_ENV_TTL_S = 300.0
_plan_env_cache: dict[str, tuple[float, str | None]] = {}


def _plan_spec(plan_id: str) -> dict:
    """方案的 spec(環境 ID、步驟清單)。方案很少改,快取 5 分鐘,不用每次多打一支。"""
    hit = _plan_env_cache.get(plan_id)
    if hit and time.monotonic() - hit[0] < _PLAN_ENV_TTL_S:
        return hit[1]
    payload = client.get(f"/pipeline-plans/{plan_id}") or {}
    plan = payload.get("plan") or payload
    spec = plan.get("spec") or {}
    _plan_env_cache[plan_id] = (time.monotonic(), spec)
    return spec


def _plan_env_id(plan_id: str) -> str | None:
    """方案的環境 ID(spec.env_id)。"""
    return _plan_spec(plan_id).get("env_id")


# 已結束的驗測不會再變:算過的流程進度直接沿用,不必每秒重打平台
_process_cache: dict[str, dict] = {}


def _process(run_id: str, status_payload: dict, plan_id: str | None) -> dict | None:
    """整個驗測流程的進度(共幾步、完成幾步、現在在哪一步)。

    來源依序:
    1. /pipelines/{rid}:執行中的 pipeline,有游標(平台文件:「前端輪詢 GET /pipelines/{rid}
       看該步完成」)。⚠ 執行中的實際格式還沒實測過,欄位名稱是照文件寬鬆地猜。
    2. /validation-runs/{rid}:steps + results 一對一(實測格式,跑完一定有)。
    3. 都拿不到:方案的步驟清單 + 目前階段(優化前 / 優化後)推一個大概位置。
    都是附帶資訊,任何一步失敗都不影響整包回應。
    """
    status = str(status_payload.get("status") or "")
    if run_id in _process_cache:
        return _process_cache[run_id]
    finished = status in {"done", "error", "aborted"}

    if not finished:
        try:
            pipe = client.get(f"/pipelines/{run_id}") or {}
            pipe = pipe.get("run") or pipe.get("pipeline") or pipe
            steps = pipe.get("steps") or []
            if steps:
                cursor = pipe.get("cursor")
                return transform.process(
                    steps,
                    pipe.get("results") or [],
                    status,
                    cursor if isinstance(cursor, int) else None,
                )
        except client.PerfTesterError:
            pass

    try:
        rec = client.get(f"/validation-runs/{run_id}") or {}
        if rec.get("steps"):
            result = transform.process(rec["steps"], rec.get("results") or [], status)
            if finished:
                _process_cache[run_id] = result
            return result
    except client.PerfTesterError:
        pass

    # 退而求其次:方案步驟 + 目前階段 —— 只知道走到哪個階段標記
    if not plan_id:
        return None
    try:
        steps = _plan_spec(plan_id).get("steps") or []
    except client.PerfTesterError:
        return None
    phase = status_payload.get("phase")
    marker = next(
        (i for i, s in enumerate(steps) if s.get("type") == "phase" and s.get("name") == phase),
        None,
    )
    fake_results = [{"ok": True}] * ((marker + 1) if marker is not None else 0)
    return transform.process(steps, fake_results, status)


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


class RecordListView(WallReadView):
    """GET /api/field-tests/records/?scenario=indoor —— 驗測紀錄清單(挑歷史用)。

    左螢幕(扮演共通性測試平台)要讓人挑「顯示哪一次」時,先打這支拿清單,
    再把選到的 runId 當作 runningId 送出去(打 adapter 的 notifyHisShow,
    或直接打下面的 POST /api/field-tests/history/)。

    ?scenario= 只留該情境的紀錄(省略就全部);新的在前面。
    """

    def get(self, request):
        scenario = request.query_params.get("scenario")
        try:
            runs = _validations()
            if scenario:
                plan_id = target(scenario).get("plan_id")
                if plan_id:
                    runs = _runs_of_plan(runs, plan_id)
        except client.PerfTesterError as exc:
            return _error(exc)

        pinned = history.all_pinned()
        rows = [
            {
                "runId": _rid(r),
                "status": r.get("status"),
                # created 是 epoch 秒(上游給什麼就給什麼,格式化交給畫面)
                "created": r.get("created"),
                # {階段名: 筆數} —— 兩趟都有數字才畫得出對照
                "phases": r.get("phases") or {},
                "bothPasses": _has_both_passes(r),
                "environmentId": (r.get("meta") or {}).get("environment_id"),
                "pinned": _rid(r) in pinned.values(),
            }
            for r in sorted(runs, key=lambda r: r.get("created") or 0, reverse=True)
            if _rid(r)
        ]
        return Response({"runs": rows, "pinned": pinned})


class HistoryShowView(APIView):
    """POST /api/field-tests/history/ —— 平台指定牆上要顯示哪幾次歷史驗測。

    共通性測試平台打 IM adapter 的 POST /autoTest/test/notifyHisShow(fire-and-forget,
    body 是一串 runningId),adapter 原樣把 body 轉來這裡即可。

    - body:["<runningId>", ...];也接受 {"runningIds": [...]} / {"running_id": "..."}
    - 一次可以帶多筆:依紀錄所屬的環境分給室內 / 室外兩面牆,同一個情境有多筆就取最新的
    - 指定之後牆面就顯示那一次,直到下一次通知,或平台又開跑新的驗測(那時自動回即時)
    - GET 看目前指定了什麼、DELETE 清掉(?scenario= 只清一面牆)

    對方只看 HTTP 狀態碼,不解析回應;這裡仍然回一小段 JSON 方便對帳與除錯。
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def _denied(self, request) -> Response | None:
        want = settings.FIELD_TEST_NOTIFY_TOKEN
        if want and request.headers.get("X-Notify-Token") != want:
            return Response({"detail": "X-Notify-Token 不對"}, status=403)
        return None

    def get(self, request):
        return Response({"pinned": history.all_pinned()})

    def delete(self, request):
        denied = self._denied(request)
        if denied:
            return denied
        history.clear(request.query_params.get("scenario"))
        return Response({"pinned": history.all_pinned()})

    def post(self, request):
        denied = self._denied(request)
        if denied:
            return denied
        ids = _running_ids(request.data)
        if not ids:
            return Response({"detail": "body 要是一串 runningId"}, status=422)
        try:
            runs = {_rid(r): r for r in _validations() if _rid(r)}
        except client.PerfTesterError as exc:
            return _error(exc)

        # 同一個情境被指定好幾筆時取最新的(created 是 epoch 秒)
        best: dict[str, dict] = {}
        unknown: list[str] = []
        for rid in ids:
            # 平台送的是 runningId,不一定等於我們認的 run_id(見 _resolve_run_id)
            run = runs.get(_resolve_run_id(rid, runs) or "")
            scenario = _scenario_of(run) if run else None
            if not scenario:
                unknown.append(rid)
                continue
            cur = best.get(scenario)
            if not cur or (run.get("created") or 0) >= (cur.get("created") or 0):
                best[scenario] = run
        for scenario, run in best.items():
            history.pin(scenario, _rid(run))
            logger.info("平台指定 %s 顯示歷史驗測 %s", scenario, _rid(run))
        if unknown:
            logger.info("歷史指定裡有認不得的 runningId:%s", unknown)
        if not best:
            return Response({"detail": "沒有一筆對得上室內 / 室外的方案", "unknown": unknown}, status=404)
        return Response({"pinned": {k: _rid(v) for k, v in best.items()}, "unknown": unknown})


def _running_ids(data) -> list[str]:
    """平台的 body 是 ["<runningId>"];順手接受幾種包裝法,少一次來回。"""
    if isinstance(data, str):
        data = [data]
    if isinstance(data, dict):
        data = data.get("runningIds") or data.get("running_ids") or data.get("running_id") or []
        if isinstance(data, str):
            data = [data]
    if not isinstance(data, list):
        return []
    return [str(x) for x in data if isinstance(x, str | int) and str(x).strip()]


def _scenario_of(run: dict) -> str | None:
    """這一筆驗測紀錄屬於哪個情境(用跟挑 run 時同一套比對:plan_id → 方案的 env_id)。"""
    for scenario, conf in (settings.FIELD_TEST_TARGETS or {}).items():
        plan_id = (conf or {}).get("plan_id")
        if not plan_id:
            continue
        try:
            if _runs_of_plan([run], plan_id):
                return scenario
        except client.PerfTesterError as exc:
            logger.info("對不到 %s 的方案(%s)", scenario, exc.detail)
    return None


# 載具影像的上游路徑:AMR 與 UAV 是兩組端點。
#   AMR(B6) /camera        先查再開 → /camera/stream(MJPEG)、/camera/snapshot(單張)
#   UAV     /camera/info   能力查詢 → /camera/mjpeg(MJPEG);沒有 MJPEG 時上游才有
#                          /camera/hls/{subpath},目前實測 mjpeg=true,HLS 先不接。
_CAMERA_PATHS = {
    "indoor": {"status": "/camera", "stream": "/camera/stream", "snapshot": "/camera/snapshot"},
    "outdoor": {"status": "/camera/info", "stream": "/camera/mjpeg", "snapshot": None},
}


def _camera_path(scenario: str, kind: str) -> str | None:
    return _CAMERA_PATHS.get(scenario, _CAMERA_PATHS["indoor"]).get(kind)


class ReplayView(WallReadView):
    """GET /api/field-tests/replay/<scenario>/ —— 這次驗測的影像回放索引。

    顯示歷史紀錄時載具早就不在跑了,即時串流沒有意義(而且多半也連不上)。
    平台在 validation run 期間有存逐格畫面,這裡把索引轉給前端:哪些鏡頭、
    各有幾張、每張屬於哪一趟(優化前 / 優化後)、間隔幾秒。

    ⚠ 目前上游只有車載鏡頭(onboard)真的有 frames,三支固定攝影機都是 0 張
      (平台端的問題,不是這裡漏拿)。沒有 frames 的鏡頭一律不回,前端就不會
      去要那幾格的圖。

    run_id 的挑法與 /missions 一致(平台指定的 > 最新一次),兩邊看到的才是同一次。
    """

    def get(self, request, scenario: str):
        run_id = request.query_params.get("run_id")
        try:
            conf = target(scenario)
            if not run_id:
                run_id = _run_id_for(scenario, conf.get("plan_id"))
            if not run_id:
                return Response({"detail": "目前沒有可顯示的驗測紀錄"}, status=404)
            payload = client.get(f"/validation-runs/{run_id}/replay")
        except client.PerfTesterError as exc:
            return _error(exc)

        frames = payload.get("frames") or {}
        names = {c.get("key"): c.get("name") for c in (payload.get("cameras") or [])}
        cameras = [
            {
                "key": key,
                "name": names.get(key) or key,
                # 只回索引與所屬趟次,圖片本身走下面那支逐張代理
                "frames": [
                    {"i": f.get("i"), "phase": f.get("phase")}
                    for f in rows
                    if f.get("i") is not None
                ],
            }
            for key, rows in frames.items()
            if rows
        ]
        return Response(
            {"runId": run_id, "periodS": payload.get("period_s"), "cameras": cameras}
        )


class ReplayFrameView(WallReadView):
    """GET /api/field-tests/replay/<scenario>/<cam>/<i>.jpg —— 回放的單張畫面。

    前端連不到場域網段,所以圖片也要經這裡代理。單張 JPEG(實測約 120 KB),
    不是長連線 —— 與 CameraStreamView 不同,這裡可以讓瀏覽器快取:同一次驗測
    的同一張畫面不會變。
    """

    def get(self, request, scenario: str, cam: str, index: int):
        run_id = request.query_params.get("run_id")
        try:
            conf = target(scenario)
            if not run_id:
                run_id = _run_id_for(scenario, conf.get("plan_id"))
            if not run_id:
                return Response({"detail": "目前沒有可顯示的驗測紀錄"}, status=404)
            content_type, chunks = client.stream(
                f"/validation-runs/{run_id}/replay/{cam}/{index}.jpg"
            )
        except client.PerfTesterError as exc:
            return _error(exc)
        resp = StreamingHttpResponse(chunks, content_type=content_type)
        # 歷史畫面不會再變,讓瀏覽器留著,播放時不用每輪重抓
        resp["Cache-Control"] = "public, max-age=86400"
        return resp


class CameraStreamView(WallReadView):
    """GET /api/field-tests/camera/<scenario>/stream —— 載具影像(MJPEG)。

    這是長連線:nginx 那段要 proxy_buffering off,否則畫面出不來。
    AMR 上游同時最多 3 路,前端不看就要把 <img> 移除。
    """

    kind = "stream"

    def get(self, request, scenario: str):
        path = _camera_path(scenario, self.kind)
        if not path:
            return Response({"detail": f"{scenario} 沒有這種影像"}, status=404)
        try:
            content_type, chunks = client.stream(ctrl_path(scenario, path))
        except client.PerfTesterError as exc:
            return _error(exc)
        resp = StreamingHttpResponse(chunks, content_type=content_type)
        resp["Cache-Control"] = "no-store"
        # 給 nginx 的提示,免得被 buffer 住
        resp["X-Accel-Buffering"] = "no"
        return resp


class CameraSnapshotView(CameraStreamView):
    """GET /api/field-tests/camera/<scenario>/snapshot —— 單張 JPEG(只有 AMR 有)。"""

    kind = "snapshot"


class CameraStatusView(WallReadView):
    """GET /api/field-tests/camera/<scenario>/ —— 先查再開。

    AMR 回的是推流狀態(streaming / viewers / config),UAV 回的是能力
    ({"state","mjpeg","hls"})。兩種都原樣透出,再補上我們自己的代理位址 ——
    前端只看有沒有 stream_url、名額有沒有滿。
    """

    def get(self, request, scenario: str):
        try:
            payload = client.get(ctrl_path(scenario, _camera_path(scenario, "status")))
        except client.PerfTesterError as exc:
            return _error(exc)
        # 前端要的是「能不能播」與播放位址,位址一律走我們自己的代理
        if not isinstance(payload, dict):
            payload = {"camera": payload}
        # UAV 只有在上游說得出 MJPEG 時才給位址(沒有 MJPEG 只有 HLS 的話我們還沒接)
        has_stream = "mjpeg" not in payload or bool(payload.get("mjpeg"))
        if has_stream:
            payload["stream_url"] = f"/api/field-tests/camera/{scenario}/stream"
        if _camera_path(scenario, "snapshot"):
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
