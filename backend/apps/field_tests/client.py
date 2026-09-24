"""Performance_tester(外部場域測試平台)HTTP client。

對接文件:docs/外部文件/後端規格/2026-09-17_Performance_tester_對外整合API.md
Base URL 與金鑰只在後端(settings.PERF_TESTER_*)—— 前端永遠不直打這台,
一方面金鑰不能進瀏覽器,一方面只有後端那台連得到場域網段。

上游端點都集中在這裡,外部 API 改版只要動這個檔。
"""

from __future__ import annotations

import logging
import time
from collections.abc import Iterator
from typing import Any

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


class PerfTesterError(Exception):
    """上游錯誤 —— view 直接轉成同樣的 status 與 detail 回前端。"""

    def __init__(self, detail: str, status: int = 502):
        super().__init__(detail)
        self.detail = detail
        self.status = status


def _headers() -> dict[str, str]:
    key = getattr(settings, "PERF_TESTER_API_KEY", "")
    # 平台未設 API_KEY 時要免帶(帶空字串會被當成錯誤金鑰)
    return {"X-API-Key": key} if key else {}


def _base() -> str:
    return str(getattr(settings, "PERF_TESTER_BASE", "")).rstrip("/")


def _timeout() -> float:
    return float(getattr(settings, "PERF_TESTER_TIMEOUT", 5.0))


# ── 熔斷 ──────────────────────────────────────────────────────────────
# 某台載具的 relay 不通時,上游要 12 秒才回(實測 UAV 就是這樣)。牆面兩個情境
# 都在輪詢,壞的那台會把連線與 worker 佔住,連好的那台都拿不到資料。
# 所以同一個控制器剛失敗過,短時間內直接回錯,不要再去敲。
# 冷卻別太長:期間畫面只能顯示「—」,15 秒夠擋住連續輪詢又不會空白太久
_FAIL_COOLDOWN_S = 15.0
_failed_at: dict[str, float] = {}


def _breaker_key(path: str) -> str:
    """同一個控制器共用一個狀態(/ctrl-conns/<cid>/controllers/<ref>/…)。"""
    head, sep, _ = path.partition("/controllers/")
    return f"{head}/controllers" if sep else path.split("?")[0]


def _cooling(key: str) -> float:
    left = _FAIL_COOLDOWN_S - (time.monotonic() - _failed_at.get(key, 0.0))
    return left if left > 0 else 0.0


def get(
    path: str,
    params: dict[str, Any] | None = None,
    timeout: float | None = None,
) -> dict:
    """timeout:這一次呼叫的上限,省略則用 settings.PERF_TESTER_TIMEOUT。

    給「附帶的」呼叫用 —— 例如牆面撈驗測數據時順便抓即時遙測,載具不通時
    不該讓整支 API 陪著等滿全域 timeout(實測會把 /missions 拖到 12 秒)。
    """
    key = _breaker_key(path)
    left = _cooling(key)
    if left:
        raise PerfTesterError(f"這台載具剛連不上,{left:.0f} 秒後再試(避免拖慢其他畫面)", status=503)
    try:
        payload = _request("GET", path, params=params, timeout=timeout)
    except PerfTesterError:
        _failed_at[key] = time.monotonic()
        raise
    _failed_at.pop(key, None)
    return payload


def post(path: str, json: dict[str, Any] | None = None) -> dict:
    return _request("POST", path, json=json)


def _request(method: str, path: str, timeout: float | None = None, **kwargs) -> dict:
    url = f"{_base()}/{path.lstrip('/')}"
    try:
        with httpx.Client(timeout=timeout or _timeout(), headers=_headers()) as client:
            resp = client.request(method, url, **kwargs)
    except httpx.HTTPError as exc:
        logger.warning("Performance_tester %s %s failed: %s", method, path, exc)
        raise PerfTesterError(f"連不上場域測試平台:{exc}", status=503) from exc

    if resp.status_code >= 400:
        detail = _detail(resp)
        # 上游的 401/404/422 是對接問題,原樣透出比包成 502 好查
        status = resp.status_code if resp.status_code in (401, 404, 422) else 502
        raise PerfTesterError(detail, status=status)
    try:
        return resp.json()
    except ValueError as exc:
        raise PerfTesterError("場域測試平台回的不是 JSON", status=502) from exc


def _detail(resp: httpx.Response) -> str:
    try:
        return str(resp.json().get("detail", resp.text))[:500]
    except ValueError:
        return resp.text[:500]


def stream(path: str, chunk_size: int = 8192) -> tuple[str, Iterator[bytes]]:
    """轉送上游的長連線內容(B6 的 MJPEG / snapshot)。

    回 (content_type, chunk 產生器)。呼叫端要把產生器交給 StreamingHttpResponse,
    這裡不先讀完 —— MJPEG 是不會結束的。
    """
    url = f"{_base()}/{path.lstrip('/')}"
    client = httpx.Client(timeout=None, headers=_headers())
    try:
        ctx = client.stream("GET", url)
        resp = ctx.__enter__()
    except httpx.HTTPError as exc:
        client.close()
        raise PerfTesterError(f"連不上場域測試平台:{exc}", status=503) from exc

    if resp.status_code >= 400:
        detail = _detail(resp)
        ctx.__exit__(None, None, None)
        client.close()
        raise PerfTesterError(
            detail, status=resp.status_code if resp.status_code in (401, 404) else 502
        )

    content_type = resp.headers.get("content-type", "application/octet-stream")

    def chunks() -> Iterator[bytes]:
        try:
            yield from resp.iter_bytes(chunk_size)
        finally:
            ctx.__exit__(None, None, None)
            client.close()

    return content_type, chunks()
