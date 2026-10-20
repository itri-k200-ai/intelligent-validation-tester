"""平台回應的共用快取(Redis,三個 gunicorn worker 共用)。

為什麼要有:Performance_tester 本身就慢(實測驗測清單 1.7 秒、單筆驗測 0.8 秒),
/missions 一次要依序打好幾支,牆面開頁或切換時要等 2~4 秒才有東西。而牆面、/field
每個分頁都在每秒輪詢同樣的東西 —— 大家各自去敲平台,平台被敲得更慢。

做法是「先給舊的、背景換新的」(stale-while-revalidate):
  - 還新鮮(fresh_s 內):直接回快取。
  - 過了新鮮期但還留著(keep_s 內):**立刻回舊的**,同時在背景重抓一次;
    下一次輪詢(一般 1 秒後)就是新的。頁面不會因為平台慢而卡住。
  - 完全沒有:當場抓。同一個 key 同時只讓一個人去抓,其他人等它的結果。
重抓有鎖(Redis SET NX),多個 worker、多個分頁同時輪詢也只會有一個去敲平台。

Redis 不通時一律退回直接打平台(慢,但功能照舊)。
settings.FIELD_TEST_CACHE = False 整個關掉(測試環境用)。
"""

from __future__ import annotations

import logging
import pickle
import threading
import time
from collections.abc import Callable
from typing import TypeVar

import redis
from django.conf import settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

_PREFIX = "ivt:field:cache:"
_LOCK_S = 30
# 沒搶到鎖的人等別人抓完,最多等這麼久就自己抓(對方可能卡在平台逾時)
_WAIT_S = 15.0

_client: redis.Redis | None = None


def _redis() -> redis.Redis:
    global _client
    if _client is None:
        # 快取拿不到就退回直接打平台,不要讓 Redis 卡住請求
        _client = redis.Redis.from_url(
            settings.WALL_STATE_REDIS_URL, socket_timeout=0.5, socket_connect_timeout=0.5
        )
    return _client


def enabled() -> bool:
    return bool(getattr(settings, "FIELD_TEST_CACHE", True))


def _store(key: str, value: object, keep_s: float) -> None:
    _redis().set(_PREFIX + key, pickle.dumps((time.time(), value)), ex=max(1, int(keep_s)))


def _load(key: str) -> tuple[float, object] | None:
    raw = _redis().get(_PREFIX + key)
    return pickle.loads(raw) if raw else None


def _lock(key: str) -> bool:
    return bool(_redis().set(_PREFIX + "lock:" + key, b"1", nx=True, ex=_LOCK_S))


def _unlock(key: str) -> None:
    try:
        _redis().delete(_PREFIX + "lock:" + key)
    except redis.RedisError:
        pass


def _refresh_in_background(key: str, fetch: Callable[[], T], keep_s: float) -> None:
    if not _lock(key):
        return  # 已經有人在重抓

    def run() -> None:
        try:
            _store(key, fetch(), keep_s)
        except Exception as exc:  # noqa: BLE001 —— 背景重抓失敗就留著舊的,下次再試
            logger.info("背景更新 %s 失敗:%s", key, exc)
        finally:
            _unlock(key)

    threading.Thread(target=run, name=f"cache:{key}", daemon=True).start()


def swr(key: str, fetch: Callable[[], T], fresh_s: float, keep_s: float = 600.0) -> T:
    """先給舊的、背景換新的(見檔頭)。fetch 丟的例外(平台錯誤)照樣往外丟。"""
    if not enabled():
        return fetch()
    try:
        hit = _load(key)
        if hit is not None:
            at, value = hit
            if time.time() - at >= fresh_s:
                _refresh_in_background(key, fetch, keep_s)
            return value  # type: ignore[return-value]
        if not _lock(key):
            # 別人正在抓同一個:等它的結果
            until = time.monotonic() + _WAIT_S
            while time.monotonic() < until:
                time.sleep(0.05)
                hit = _load(key)
                if hit is not None:
                    return hit[1]  # type: ignore[return-value]
            return fetch()
    except redis.RedisError as exc:
        logger.info("快取不通(%s),直接打平台", exc)
        return fetch()
    try:
        value = fetch()
        try:
            _store(key, value, keep_s)
        except redis.RedisError:
            pass
        return value
    finally:
        _unlock(key)


def get_bytes(key: str) -> object | None:
    """不會變的東西(回放影格):有就回,沒有回 None。"""
    if not enabled():
        return None
    try:
        hit = _load(key)
    except redis.RedisError:
        return None
    return hit[1] if hit else None


def put_bytes(key: str, value: object, keep_s: float) -> None:
    if not enabled():
        return
    try:
        _store(key, value, keep_s)
    except redis.RedisError:
        pass
