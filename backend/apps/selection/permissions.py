"""左 app(別團隊)的後端用一個服務金鑰(header `X-Service-Token`)存取
目錄與設定選擇;我們自己登入的 admin 也放行,方便手動測試 / 後台操作。
"""

from django.conf import settings
from rest_framework.permissions import BasePermission


class HasServiceTokenOrAdmin(BasePermission):
    message = "需要有效的 X-Service-Token 或管理員身分。"

    def has_permission(self, request, view) -> bool:
        token = request.headers.get("X-Service-Token")
        if token and settings.WALL_SERVICE_TOKEN and token == settings.WALL_SERVICE_TOKEN:
            return True
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.is_staff)
