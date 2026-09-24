"""外部平台形狀 → 中牆前端形狀。

前端(components/FieldTest)吃的是 camelCase 的 FieldMission / FieldSample,
外部平台是 snake_case 且單位不同(kbps、弧度)。轉換全部集中在這裡:
外部 API 改版只動這個檔與 client,畫面不必跟著改。

只映射上游真的有的欄位 —— /live 沒有 SNR / RSSI / 丟包,就不要假造。
"""

from __future__ import annotations

import math
from collections.abc import Iterable
from typing import Any

from django.conf import settings


def _num(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def rate_kbps(value: Any) -> float | None:
    """吞吐量一律用上游的 kbps 原值 —— 實測室內是 70~5000 kbps 這個量級,
    先除成 Mbps 會變成 0.0,單位讓前端依數值大小決定。"""
    return _num(value)


def yaw_deg(value: Any) -> float | None:
    """SLAM 的 yaw(弧度)→ 度,維持上游的表示法(-180~180,0 = 朝 +x)。

    畫面上的「yaw」欄位要跟對方系統對得起來,所以不要轉成 0~360 ——
    對方顯示 -0°,我們顯示 358° 會讓人以為兩邊不一致。
    """
    n = _num(value)
    if n is None:
        return None
    deg = math.degrees(n)
    deg = (deg + 180) % 360 - 180
    return round(deg, 1)


def heading_from_yaw(value: Any) -> float | None:
    """SLAM yaw → 地圖箭頭的旋轉角。

    兩邊慣例不同:SLAM 是 0 = 朝右(+x)、逆時針為正;我們的箭頭圖形朝上、
    SVG rotate 順時針為正(0 = 正北)。所以 heading = 90 - yaw。
    """
    deg = yaw_deg(value)
    return None if deg is None else round((90 - deg) % 360, 1)


def phase_key(name: str | None, seen: list[str]) -> str:
    """上游的階段名稱(部署前 / 部署後 …)→ before / after。

    設定裡沒對到的名稱,就按出現順序分配 —— 外部改了用詞也不會整個壞掉。
    """
    mapping = dict(getattr(settings, "PERF_TESTER_PHASE_MAP", {}) or {})
    if name in mapping:
        return mapping[name]
    if name not in seen:
        seen.append(name or "")
    return "before" if seen.index(name or "") == 0 else "after"


def link(ue: dict | None) -> dict | None:
    """UE 訊號 → 前端 LinkQuality(只放上游有的欄位)。"""
    if not ue:
        return None
    return {
        "sinrDb": _num(ue.get("sinr")),
        "rsrpDbm": _num(ue.get("rsrp")),
        "rsrqDb": _num(ue.get("rsrq")),
        "rttMs": _num(ue.get("rtt_ms")),
        "dlKbps": rate_kbps(ue.get("thp_dl_kbps")),
        "ulKbps": rate_kbps(ue.get("thp_ul_kbps")),
        "cqi": _num(ue.get("cqi")),
        "pci": _num(ue.get("pci")),
        "cellId": _num(ue.get("cell_id")),
        "band": ue.get("band") or "",
        "nrMode": ue.get("nr_mode") or "",
        "connected": bool(ue.get("connected", True)),
        "linkState": ue.get("link_state") or "",
    }


def sample(raw: dict, progress: float) -> dict:
    """A4 的一筆 → 前端 FieldSample。progress 是後端估的(見 build_runs)。"""
    ue = raw.get("ue") or {}
    out: dict[str, Any] = {
        "progress": round(progress, 1),
        "sinrDb": _num(ue.get("sinr")),
        # 歷史回放要能逐格重現當下的數值,所以訊號欄位要跟著每一筆帶走,
        # 不能只靠 /live(那是「現在」,對跑完的驗測沒有意義)。
        "rsrpDbm": _num(ue.get("rsrp")),
        "rsrqDb": _num(ue.get("rsrq")),
        "dlKbps": rate_kbps(ue.get("thp_dl_kbps")),
        "ulKbps": rate_kbps(ue.get("thp_ul_kbps")),
        # yaw 同理(行駛狀態那張卡要顯示);headingDeg 是地圖箭頭用的換算值
        "yawDeg": yaw_deg(ue.get("yaw")),
        "headingDeg": heading_from_yaw(ue.get("yaw")),
        # 絕對時間 —— 回放影像的每一格也有 wall,兩邊靠它對齊
        "wall": _num(raw.get("wall")),
        # 上游沒有路徑進度,留相對秒數給圖表之後改用時間軸
        "elapsedS": _num(raw.get("t")),
        # 每一筆都有位置 —— 兩趟的實際軌跡就是這些點連起來。
        # AMR 是 SLAM 公尺座標(x / y);UAV 是 GPS(lat / lon),原樣交給前端換算。
        "x": _num(ue.get("x")),
        "y": _num(ue.get("y")),
        "lat": _geo(ue.get("lat"), 90),
        "lon": _geo(ue.get("lon"), 180),
    }
    return {k: v for k, v in out.items() if v is not None}


def _geo(value: Any, limit: float) -> float | None:
    """經緯度:超出範圍或剛好 0(GPS 還沒定位時常見的 0,0)都當作沒有。"""
    n = _num(value)
    if n is None or n == 0 or abs(n) > limit:
        return None
    return n


def geo(live: dict) -> dict | None:
    """UAV 目前的 GPS 位置(/live 的 lat / lon)。缺一個就當沒有。"""
    lat, lon = _geo(live.get("lat"), 90), _geo(live.get("lon"), 180)
    return None if lat is None or lon is None else {"lat": lat, "lon": lon}


def _battery_from_targets(targets: dict | None) -> float | None:
    """UAV 的電量在 /targets 的第一個目標。

    文件寫的是 battery(百分比);實測離線時這欄不會出現,所以拿不到就不給。
    也容忍包成物件({remaining / percent / pct})的寫法。
    """
    items = (targets or {}).get("targets") or []
    if not items or not isinstance(items[0], dict):
        return None
    battery = items[0].get("battery")
    if isinstance(battery, dict):
        for key in ("remaining", "percent", "pct"):
            if battery.get(key) is not None:
                return _num(battery.get(key))
        return None
    return _num(battery)


def vehicle(
    scenario: str,
    live: dict,
    robot: dict | None,
    localization: dict | None,
    targets: dict | None = None,
) -> dict:
    """載具即時狀態。AMR 的速度 / 電量 / 定位品質在 B4、B5;UAV 的姿態與速度在 /live,
    電量在 /targets。衛星數與飛行模式上游沒有提供,不給(畫面顯示「—」)。"""
    out: dict[str, Any] = {}
    if scenario == "indoor":
        # 位置與 yaw 在 /live;速度 / 電量 / 定位品質在 /robot(它慢,可能拿不到)。
        # 拿不到就整個不給 —— 給 0 會讓牆上看起來「車停著」,那是假資訊。
        # yawDeg 給數值欄位(與上游同一種表示法)、headingDeg 給地圖箭頭
        out["yawDeg"] = yaw_deg(live.get("yaw"))
        out["headingDeg"] = heading_from_yaw(live.get("yaw"))
        if robot:
            speed = robot.get("speed") or {}
            vx, vy = _num(speed.get("vx")), _num(speed.get("vy"))
            if vx is not None or vy is not None:
                out["speedMps"] = round(math.hypot(vx or 0.0, vy or 0.0), 2)
            power = robot.get("power") or {}
            out["batteryPct"] = _num(power.get("batteryPercentage"))
            if "isCharging" in power:
                out["charging"] = bool(power.get("isCharging"))
            quality = (robot.get("localization") or {}).get("quality")
            if quality is None:
                quality = (localization or {}).get("quality")
            out["localizationPct"] = _num(quality)
    else:
        out.update(
            {
                "headingDeg": _num(live.get("heading")),
                "altitudeM": _num(live.get("alt_rel")),
                # 地速 / 垂直速度:上游 /live 的 gspeed、vspeed(m/s)
                "speedMps": _num(live.get("gspeed")),
                "verticalSpeedMps": _num(live.get("vspeed")),
                "batteryPct": _battery_from_targets(targets),
            }
        )
    return {k: v for k, v in out.items() if v is not None}


def position(scenario: str, live: dict, pose: dict | None) -> dict | None:
    """AMR:SLAM 公尺座標(優先用 /pose,它比 /live 新)。UAV:GPS 交給前端處理。"""
    if scenario != "indoor":
        return None
    src = (pose or {}).get("pose") or live
    x, y = _num(src.get("x")), _num(src.get("y"))
    return None if x is None or y is None else {"x": x, "y": y}


def build_runs(status: dict, samples: Iterable[dict]) -> list[dict]:
    """A3 狀態 + A4 樣本 → 前端的兩趟(啟用前 / 啟用後)。

    上游沒有「路徑進度」,只有取樣序號與相對秒數,所以 progress 用該趟的取樣
    位置估:跑完那趟就是準的;還在跑的那趟以兩趟中較多的筆數當分母。
    """
    seen: list[str] = []
    grouped: dict[str, list[dict]] = {"before": [], "after": []}
    for raw in samples:
        key = phase_key(raw.get("phase"), seen)
        grouped.setdefault(key, []).append(raw)

    expected = max([len(v) for v in grouped.values()] or [0])
    # 用同一份 seen 判斷目前階段,順序分配才會跟上面分組一致
    current_key = phase_key(status.get("phase"), seen)
    upstream_status = str(status.get("status") or "")

    runs = []
    for key in ("before", "after"):
        raws = grouped.get(key) or []
        is_running_phase = key == current_key and upstream_status == "running"
        # 還在跑的那趟不知道總長,拿兩趟中較多的筆數當分母;跑完的那趟就是自己的筆數
        denom = max(expected - 1, 1) if is_running_phase else max(len(raws) - 1, 1)
        converted = [sample(raw, min(i / denom * 100, 100)) for i, raw in enumerate(raws)]
        if not raws:
            run_status = "pending"
        elif is_running_phase:
            run_status = "running"
        elif upstream_status == "error":
            run_status = "error"
        else:
            run_status = "finished"
        runs.append(
            {
                "phase": key,
                "status": run_status,
                "progress": round(converted[-1]["progress"], 1) if converted else 0,
                "link": link((raws[-1] or {}).get("ue")) if raws else None,
                "samples": converted,
                # 走到第幾個路徑點由前端比對(路徑幾何在前端 config,不在上游)
                "reachedWaypoints": 0,
                "position": None,
            }
        )
    return runs


# ── 驗測流程進度(整個方案走到第幾步)──────────────────────────────────

_XAPP_ACTION = {
    "install": "安裝 xApp",
    "start": "啟動 xApp",
    "stop": "停止 xApp",
    "uninstall": "解除安裝 xApp",
}


def step_label(step: dict) -> str:
    """方案的一個步驟 → 牆上顯示的短名稱(一行放得下,不寫腳本代號)。"""
    kind = step.get("type")
    if kind == "phase":
        return f"階段:{step.get('name') or ''}".rstrip(":")
    if kind == "ue_control":
        # collect=false 的是「移到起點」這類就位動作;其餘是沿測試路線移動、同時收資料
        return "移動到起點" if step.get("collect") is False else "沿測試路線移動"
    if kind == "xapp_action":
        action = str(step.get("action") or "")
        return _XAPP_ACTION.get(action, f"xApp {action}".strip())
    if kind == "wait":
        seconds = _num(step.get("seconds"))
        return f"等待 {seconds:g} 秒" if seconds is not None else "等待"
    if kind == "compare":
        return "前後比較"
    return str(step.get("label") or kind or "步驟")


def _step_failed(result: dict) -> bool:
    done = result.get("done") or {}
    return result.get("ok") is False or bool(result.get("error")) or done.get("state") == "failed"


def _step_running(result: dict) -> bool:
    return (result.get("done") or {}).get("state") in {"running", "pending"}


def process(steps: list[dict], results: list[dict], status: str, cursor: int | None = None) -> dict:
    """整個驗測流程的進度:共幾步、完成幾步、現在在哪一步。

    steps 與 results 是一對一、照順序對應的(實測 /validation-runs:12 步對 12 筆)。
    cursor 是執行中 pipeline 的游標(目前在跑 steps[cursor]),有就以它為準。
    """
    total = len(steps)
    failed_at = next((i for i, r in enumerate(results) if _step_failed(r)), None)
    if status in {"done"} and failed_at is None:
        return {"total": total, "done": total, "current": None, "label": "已完成", "failed": False}
    if failed_at is not None or status in {"error", "aborted"}:
        at = failed_at if failed_at is not None else min(len(results), max(total - 1, 0))
        name = step_label(steps[at]) if 0 <= at < total else ""
        word = "已中止" if status == "aborted" else "失敗"
        return {
            "total": total,
            "done": at,
            "current": at,
            "label": f"{name}{word}".strip(),
            "failed": True,
        }

    if cursor is not None:
        current = cursor
    elif results and _step_running(results[-1]):
        current = len(results) - 1
    else:
        current = len(results)
    current = max(0, min(current, total - 1)) if total else 0
    label = step_label(steps[current]) if total else ""
    return {"total": total, "done": current, "current": current, "label": label, "failed": False}
