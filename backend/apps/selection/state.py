"""戰情牆「目前選擇」的單一全域狀態。

左 app(別團隊)選了哪個 DUT,寫進這裡;中/右牆讀這裡做初次補水。
backend-web(HTTP)和 backend-ws(WebSocket)是不同 process,所以狀態
必須放共享的 Redis,不能放 process 記憶體。
"""

import json

import redis
from django.conf import settings

_KEY = "wall:current_selection"

_client = redis.Redis.from_url(settings.WALL_STATE_REDIS_URL, decode_responses=True)


def get_current() -> dict | None:
    raw = _client.get(_KEY)
    return json.loads(raw) if raw else None


def set_current(selection: dict) -> None:
    _client.set(_KEY, json.dumps(selection))


def clear_current() -> None:
    _client.delete(_KEY)
