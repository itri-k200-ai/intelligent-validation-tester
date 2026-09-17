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
        "dlKbps": rate_kbps(ue.get("thp_dl_kbps")),
        "ulKbps": rate_kbps(ue.get("thp_ul_kbps")),
        # 上游沒有路徑進度,留相對秒數給圖表之後改用時間軸
        "elapsedS": _num(raw.get("t")),
        # 每一筆都有位置 —— 兩趟的實際軌跡就是這些點連起來(AMR 是 SLAM 公尺座標)
        "x": _num(ue.get("x")),
        "y": _num(ue.get("y")),
    }
    return {k: v for k, v in out.items() if v is not None}


def vehicle(scenario: str, live: dict, robot: dict | None, localization: dict | None) -> dict:
    """載具即時狀態。AMR 的速度 / 電量 / 定位品質在 B4、B5,UAV 只有 /live。"""
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
