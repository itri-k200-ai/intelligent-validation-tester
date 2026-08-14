"""左 app(別團隊)與中/右牆之間的契約端點,全部收在這個 app,
不動現有的 DutViewSet。

  GET  /api/selection/catalog/   服務金鑰  → 可測項目清單(精簡欄位)
  GET  /api/selection/current/   公開      → 目前檢視(中/右牆初次補水)
  POST /api/selection/current/   服務金鑰  → 設定檢視 + 廣播

「目前檢視」就是左 app 選單點的那一項,以導覽目標表示:
  { "href": "/overview", "label": "總覽" }
中牆收到後導航到該頁,右牆內容隨頁面切換。也相容舊的 { "dutId": ... }
(會補上該 DUT 身分欄位),方便之後做到 DUT 細粒度選擇。
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.duts.models import Dut

from . import state
from .broadcast import broadcast_selection


def _to_card(dut: Dut) -> dict:
    """給左 app 顯示用的精簡卡片 —— 只露身分欄位,不漏內部設定。"""
    return {
        "dutId": str(dut.id),
        "name": dut.name,
        "type": dut.type,
        "status": dut.status,
    }


class CatalogView(APIView):
    """我們提供「有哪些可測項目」給左 app。內網部署:公開。"""

    permission_classes = [AllowAny]

    def get(self, request):
        duts = Dut.objects.all().order_by("type", "name")
        return Response([_to_card(d) for d in duts])


class CurrentSelectionView(APIView):
    def get_permissions(self):
        # 內網部署:讀寫皆公開,左 app 直接打 POST 切換,不需服務金鑰。
        return [AllowAny()]

    def get(self, request):
        return Response(state.get_current())

    def post(self, request):
        href = request.data.get("href")
        dut_id = request.data.get("dutId")

        dut_name = request.data.get("dutName")

        # 需要至少一種選擇識別:href(導覽)/ dutId(IVT)/ dutName(RICtester)
        if href is not None and (not isinstance(href, str) or not href.startswith("/")):
            return Response(
                {"detail": "href 必須是以 / 開頭的路徑。"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not (href or dut_id or dut_name):
            return Response(
                {"detail": "需要 href / dutId / dutName 其中之一。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 舊路徑:只給 dutId(IVT DUT)→ 補上身分卡片欄位
        if dut_id and not href and not dut_name:
            try:
                dut = Dut.objects.get(id=dut_id)
            except (Dut.DoesNotExist, ValueError, DjangoValidationError):
                return Response(
                    {"detail": f"找不到 DUT {dut_id}。"},
                    status=status.HTTP_404_NOT_FOUND,
                )
            selection = _to_card(dut)
        else:
            # 一般路徑:pass-through 左 app / 牆用的所有欄位(RICtester 相容)
            selection = {}
            for k in ("href", "label", "dutId", "dutName", "interface",
                      "testcaseId", "scenarioId", "runnings", "runStartedAt"):
                v = request.data.get(k)
                if v is not None:
                    selection[k] = v

        selection["updatedAt"] = timezone.now().isoformat()
        state.set_current(selection)
        broadcast_selection(selection)
        return Response(selection, status=status.HTTP_200_OK)
