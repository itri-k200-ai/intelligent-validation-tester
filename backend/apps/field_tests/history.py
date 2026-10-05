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
import time

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


# 指定的時間(scenario → epoch 秒)。牆面要跟「驗測開跑」比先後 ——
# 規則是「最後一次操作決定顯示什麼」,沒有時間就比不出來。
_AT_KEY = "field-tests:history-at"


def pin(scenario: str, run_id: str) -> None:
    r = _redis()
    r.hset(_KEY, scenario, run_id)
    r.hset(_AT_KEY, scenario, repr(time.time()))


def pinned_at(scenario: str) -> float | None:
    """這個情境是什麼時候被指定的(epoch 秒);沒有指定就 None。"""
    try:
        v = _redis().hget(_AT_KEY, scenario)
        return float(v) if v else None
    except (redis.RedisError, ValueError) as exc:
        logger.warning("讀不到歷史指定的時間(%s)", exc)
        return None


# 第一次看到某個情境有驗測在跑的時間(scenario → "run_id epoch秒")。
#
# 刻意不用平台給的 run.created:那是平台的時鐘,與我們的 Redis、瀏覽器各走各的,
# 機器間有時差就會比錯先後(例如平台的錶快 30 秒,驗測一開跑就永遠贏過剛剛的指定)。
# 「我們什麼時候知道的」同一個時鐘,也更貼近「最後一次操作」的語意。
_RUN_SEEN_KEY = "field-tests:run-seen"


# 「這個情境我們觀察過了」。與上面那筆分開存,是因為「現在沒有東西在跑」也算
# 一次觀察,但它**不該**覆蓋 _RUN_SEEN_KEY 裡那筆驗測 —— 見 mark_running。
_OBSERVED_KEY = "field-tests:run-observed"


def mark_running(scenario: str, run_id: str) -> float:
    """每次輪詢都呼叫:記下這個情境現在在跑哪一筆(沒有就傳空字串),
    回「那一筆是什麼時候開始跑的」。

    同一筆重複呼叫回原本的時間,不會每次輪詢都刷新。

    ⚠ 傳空字串(現在沒有東西在跑)時**保留**上一次那筆的紀錄,只回它的時間。
    以前這裡會把空字串連同「現在」寫進去,於是驗測一跑完就留下一筆
    「run_id 是空的、時間是剛剛」的紀錄 —— 牆面比時間時它贏過使用者的歷史指定,
    但真的要挑 run_id 時又挑不出東西,結果就跳到某一筆很舊的歷史去。
    驗測跑完要停在那一筆上,所以那筆的開跑時間必須留著。

    ⚠ 這個情境**從來沒被觀察過**時(後端剛啟動)記 0,不是現在:那時我們不知道
    它是什麼時候開跑的,記成「現在」會讓一個早就在跑的驗測憑空變成「最新的操作」,
    壓過使用者剛剛指定的歷史紀錄。記 0 的語意是「已經在跑了,但不知道何時開始」——
    沒有指定時它照樣會被選中,有指定時則讓指定贏。
    """
    try:
        r = _redis()
        cur = r.hget(_RUN_SEEN_KEY, scenario)
        rid, _, at = (cur or "").partition(" ")
        observed = bool(cur) or bool(r.hget(_OBSERVED_KEY, scenario))
        r.hset(_OBSERVED_KEY, scenario, "1")
        if not run_id:
            # 沒有在跑:上一次那筆留著(跑完的那筆仍代表「最後一次驅動」)
            return float(at) if rid else 0.0
        if rid == run_id:
            return float(at)
        at_new = time.time() if observed else 0.0
        r.hset(_RUN_SEEN_KEY, scenario, f"{run_id} {at_new!r}")
        return at_new
    except (redis.RedisError, ValueError) as exc:
        logger.warning("記不住執行中的驗測(%s)", exc)
        return 0.0


def running_seen_at(scenario: str) -> tuple[str, float] | None:
    """(最後一次看到在跑的 run_id, 看到它開跑的時間);沒看過就 None。

    驗測跑完之後這筆還在 —— 它就是「最後一次驅動」那個操作。
    """
    try:
        cur = _redis().hget(_RUN_SEEN_KEY, scenario)
        if not cur:
            return None
        rid, _, at = cur.partition(" ")
        if not rid:  # 舊格式留下的空紀錄
            return None
        return rid, float(at)
    except (redis.RedisError, ValueError) as exc:
        logger.warning("讀不到執行中的驗測(%s)", exc)
        return None


def clear(scenario: str | None = None) -> None:
    """清掉指定(不給情境就全部清掉)。清不掉只記錄,不往外丟。"""
    try:
        if scenario:
            _redis().hdel(_KEY, scenario)
        else:
            _redis().delete(_KEY)
    except redis.RedisError as exc:
        logger.warning("清不掉歷史指定(%s)", exc)
