"""左 app(別團隊)與中/右牆之間的契約端點,全部收在這個 app,
不動現有的 DutViewSet。

  GET  /api/selection/catalog/   服務金鑰  → 可測項目清單(精簡欄位)
  GET  /api/selection/current/   公開      → 目前檢視(中牆初次補水)
  POST /api/selection/current/   服務金鑰  → 設定檢視 + 廣播

「目前檢視」就是左螢幕選單點的那一項。`href` 現在的語意是「要顯示哪一種
內容」而不是「導航到哪個路由」—— 中牆固定停在 /wall,依這個值切換渲染。

除了 href / label / dutId,還會原樣保留 RICtester 的識別欄位,中牆靠它們
決定要顯示哪一套 tester 的哪個 DUT / 介面 / 測項,以及要輪詢哪些 runningId:

  source dutName scenarioId interface testcaseId runnings runStartedAt

觸發測試不經過這裡 —— 由左螢幕直接呼叫該套 tester adapter 的 API,
再把拿到的 runnings 寫進來;中牆只讀,不驅動。

右副牆是靜態內容,不讀這裡。
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
from .permissions import HasServiceTokenOrAdmin


# 左螢幕可以帶、且會原樣保留的 RICtester 識別欄位。
WALL_FIELDS = (
    "source",       # near / non —— 哪一套 tester
    "dutName",      # adapter 的 dutName(= back_end 的 dut_name)
    "scenarioId",
    "interface",    # E2 / A1 / O1 / R1 ...
    "testcaseId",
    "runnings",     # [{testcaseId, runningId}] —— 左螢幕驅動後回填
    "runStartedAt",
)


def _to_card(dut: Dut) -> dict:
    """給左 app 顯示用的精簡卡片 —— 只露身分欄位,不漏內部設定。"""
    return {
        "dutId": str(dut.id),
        "name": dut.name,
        "type": dut.type,
        "status": dut.status,
    }


class CatalogView(APIView):
    """我們提供「有哪些可測項目」給左 app。"""

    permission_classes = [HasServiceTokenOrAdmin]

    def get(self, request):
        duts = Dut.objects.all().order_by("type", "name")
        return Response([_to_card(d) for d in duts])


class CurrentSelectionView(APIView):
    def get_permissions(self):
        # 讀取(中/右牆補水)公開;寫入(左 app 回報)要服務金鑰。
        if self.request.method == "POST":
            return [HasServiceTokenOrAdmin()]
        return [AllowAny()]

    def get(self, request):
        return Response(state.get_current())

    def post(self, request):
        href = request.data.get("href")
        dut_id = request.data.get("dutId")

        if href:
            if not isinstance(href, str) or not href.startswith("/"):
                return Response(
                    {"detail": "href 必須是以 / 開頭的路徑。"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            selection = {
                "href": href,
                "label": request.data.get("label", ""),
            }
            # 選單點的是某台 DUT 時,一併帶 dutId → 中牆導航後自動選中那台。
            if dut_id:
                selection["dutId"] = dut_id
        elif dut_id:
            try:
                dut = Dut.objects.get(id=dut_id)
            except (Dut.DoesNotExist, ValueError, DjangoValidationError):
                return Response(
                    {"detail": f"找不到 DUT {dut_id}。"},
                    status=status.HTTP_404_NOT_FOUND,
                )
            selection = _to_card(dut)
        elif any(k in request.data for k in WALL_FIELDS):
            # 只更新 RICtester 識別(例如同一頁內換介面 / 回填 runnings),
            # 沿用目前的 href / label,不強迫左端每次都重帶。
            selection = dict(state.get_current() or {})
        else:
            return Response(
                {"detail": "需要 href、dutId,或至少一個 RICtester 識別欄位。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # RICtester 識別欄位原樣帶過(白名單,避免左端塞任意內容進共享狀態)。
        for key in WALL_FIELDS:
            if key in request.data:
                selection[key] = request.data[key]

        selection["updatedAt"] = timezone.now().isoformat()
        state.set_current(selection)
        broadcast_selection(selection)
        return Response(selection, status=status.HTTP_200_OK)
