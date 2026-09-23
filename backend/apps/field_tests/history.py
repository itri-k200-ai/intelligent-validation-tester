"""平台指定「牆上要顯示哪一次歷史驗測」的暫存。

共通性測試平台要看某幾次的歷史結果時,會打 IM adapter 的
POST /autoTest/test/notifyHisShow(body 是一串 runningId = 我們的 run_id);
adapter 原樣轉發到 POST /api/field-tests/history/,結果就存在這裡。

牆面的 HTTP(backend-web)可能有多個 worker,狀態不能放 process 記憶體,
所以跟 apps/selection 一樣放共享的 Redis。Redis 不通時一律當作「沒有指定」
(牆面照舊挑最新一次),不要讓它把唯讀的牆面弄成 500。
"""

from __future__ import annotations

import logging

import redis
from django.conf import settings

logger = logging.getLogger(__name__)

# hash:情境(outdoor / indoor)→ run_id
_KEY = "field-tests:history-show"

_client: redis.Redis | None = None


def _redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(settings.WALL_STATE_REDIS_URL, decode_responses=True)
    return _client


def pinned(scenario: str) -> str | None:
    """這個情境被指定要顯示的 run_id(沒有就 None)。"""
    try:
        return _redis().hget(_KEY, scenario)
    except redis.RedisError as exc:
        logger.warning("讀不到歷史指定(%s),當作沒有指定", exc)
        return None


def all_pinned() -> dict[str, str]:
    try:
        return _redis().hgetall(_KEY) or {}
    except redis.RedisError as exc:
        logger.warning("讀不到歷史指定(%s)", exc)
        return {}


# 已經處理過的 adapter 通知:runId → 那次通知的時間(notified_at)
# 存時間而不只是存 ID —— adapter 新版重複通知同一筆會更新 notified_at,
# 比對時間才分得出「平台又要求顯示同一筆」。
_SEEN_KEY = "field-tests:history-seen"


def seen_notices() -> dict[str, str] | None:
    """已經處理過的通知(runId → notified_at)。

    回 None = 這個 key 還不存在(第一次開機)。呼叫端要把當下的全部記起來、
    但**不要**切畫面 —— 不然重開後端就會跳到某一次很久以前的通知。
    """
    try:
        r = _redis()
        if not r.exists(_SEEN_KEY):
            return None
        return r.hgetall(_SEEN_KEY) or {}
    except redis.RedisError as exc:
        logger.warning("讀不到已處理的通知(%s)", exc)
        return {}


def remember_notices(notices: dict[str, str]) -> None:
    try:
        r = _redis()
        if notices:
            r.hset(_SEEN_KEY, mapping=notices)
        else:
            # 空的也要建出 key,下次才知道「不是第一次」
            r.hset(_SEEN_KEY, "", "")
    except redis.RedisError as exc:
        logger.warning("記不住已處理的通知(%s)", exc)


def pin(scenario: str, run_id: str) -> None:
    _redis().hset(_KEY, scenario, run_id)


def clear(scenario: str | None = None) -> None:
    """清掉指定(不給情境就全部清掉)。清不掉只記錄,不往外丟。"""
    try:
        if scenario:
            _redis().hdel(_KEY, scenario)
        else:
            _redis().delete(_KEY)
    except redis.RedisError as exc:
        logger.warning("清不掉歷史指定(%s)", exc)
