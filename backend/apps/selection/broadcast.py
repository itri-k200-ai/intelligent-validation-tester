"""把「目前選擇」透過 Channels group 廣播給所有連著 /ws/selection/ 的牆。

group_send 走 channels_redis,所以即使是從 WSGI(backend-web)呼叫,
也能送達 daphne(backend-ws)上的 consumer —— 跟 validations/tasks.py 同模式。
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

GROUP = "wall_selection"


def broadcast_selection(selection: dict | None) -> None:
    async_to_sync(get_channel_layer().group_send)(
        GROUP,
        {"type": "selection_changed", "payload": selection},
    )
