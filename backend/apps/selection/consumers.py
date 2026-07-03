"""中/右牆訂閱這條 WS,左 app 一改選擇就即時收到 selection_changed。

選擇只是「現在牆上要顯示哪個 DUT」,不是機密,所以連線不擋(公開讀)。
寫入端(POST /api/selection/current/)才需要服務金鑰。
"""

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .broadcast import GROUP
from .state import get_current


class WallSelectionConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add(GROUP, self.channel_name)
        await self.accept()
        # 一連上就先推目前選擇,牆不用另外打 GET 補水。
        await self.send_json({"type": "selection_changed", "payload": get_current()})

    async def disconnect(self, code):
        await self.channel_layer.group_discard(GROUP, self.channel_name)

    async def selection_changed(self, event):
        await self.send_json({"type": "selection_changed", "payload": event["payload"]})
