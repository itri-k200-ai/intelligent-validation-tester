"""場域測試小助理 → 網管 agent(Infrastructure Operator Co-pilot,nmagent 架構)的轉送。

為什麼要經過我們的後端,不讓瀏覽器直接打 agent:
  - agent 在 10.194.87.115:8002,手機 / 院外瀏覽器連不到
  - 它的認證是關掉的(/api/auth/me 回 auth: disabled),不能直接暴露出去
  - 它回的是 Claude CLI 原始的 stream-json,前端不該知道這些細節

agent 的介面(實測,與本機 nmagent 同一份程式):
  POST /api/sessions/                 {title, runner} → {id, ...}
  POST /api/sessions/<id>/chat        {message}       → SSE
       event: start | msg | raw | error | done ;msg 的 data 是 Claude CLI 的 stream-json 物件:
         stream_event  逐字(event.type == content_block_delta, delta.type == text_delta)
         assistant     一整則訊息(content 裡的 text / tool_use)
         result        這一輪的最終答案(result 字串)

我們對前端只吐四種事件(SSE):
  session {sessionId}   之後送訊息帶著它,agent 才記得前文
  delta   {text}        逐字,讓畫面先動起來(agent 一輪常要十幾秒)
  status  {text}        agent 在呼叫工具時的提示
  final   {text, suggestions}  最終答案(以 agent 的 result 為準,會蓋掉中途的逐字內容);
                        suggestions 是 agent 建議的下一個問題(它自己的介面用
                        <!--suggest: [...]--> 標在答案最後,我們拆出來,不讓它被顯示或念出來)
  error   {message}
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from collections.abc import Iterator

import httpx
from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

# 前置說明:agent 本身是網管用途,不認識場域測試,所以每次都把頁面上的資料一起送過去
PREAMBLE = (
    "你現在是 IVT「智慧網路場域測試」頁面上的小助理,使用者在電腦或手機上看室內 AMR / 室外 UAV 的"
    "場域測試,畫面是手機寬度的對話泡泡。請用繁體中文、精簡地回答。可以用 Markdown(粗體、清單、"
    "小表格);要說明流程、架構或比較時,可以用 ```mermaid 程式碼區塊畫圖(圖要小、節點文字要短)。"
    "回答會被念出來,所以重點請寫在文字裡,不要只放在表格或圖中。"
    "下面是頁面上目前顯示的即時資料,回答測試相關問題時以它為準;資料裡沒有的就直說不知道。"
)
CONNECT_TIMEOUT_S = 5.0
# agent 一輪最多會連續呼叫十幾次工具;它每 15 秒送一次心跳,所以 read 逾時只是「完全沒動靜」的上限
READ_TIMEOUT_S = 180.0


SUGGEST_RE = re.compile(r"<!--\s*suggest:\s*(\[.*?\])\s*-->", re.S)


def _split_suggestions(text: str) -> tuple[str, list[str]]:
    """把 agent 答案最後的 <!--suggest: [...]--> 拆出來。格式不對就整段丟掉,不要讓它露出來。"""
    suggestions: list[str] = []
    for raw in SUGGEST_RE.findall(text):
        try:
            suggestions += [str(x) for x in json.loads(raw) if str(x).strip()]
        except (json.JSONDecodeError, TypeError):
            pass
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S).strip()
    return text, suggestions[:4]


def _base() -> str:
    return (settings.ASSISTANT_AGENT_BASE or "").rstrip("/")


def _sse(event: str, data: dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode()


def _create_session(client: httpx.Client) -> str:
    res = client.post(
        f"{_base()}/api/sessions/",
        json={"title": "IVT 場域測試小助理", "runner": settings.ASSISTANT_AGENT_RUNNER},
    )
    res.raise_for_status()
    return str(res.json()["id"])


def _upstream_events(resp: httpx.Response) -> Iterator[tuple[str, dict]]:
    """把上游的 SSE 拆成 (event, data)。心跳(: ping)回 ("ping", {}),讓我們也能往下游送心跳。"""
    event, data = "message", []
    for line in resp.iter_lines():
        if line.startswith(":"):
            yield "ping", {}
            continue
        if not line:
            if data:
                try:
                    yield event, json.loads("\n".join(data))
                except json.JSONDecodeError:
                    pass
            event, data = "message", []
            continue
        field, _, value = line.partition(":")
        value = value.lstrip(" ")
        if field == "event":
            event = value
        elif field == "data":
            data.append(value)


def _relay(sid: str, message: str, created: bool) -> Iterator[bytes]:
    yield _sse("session", {"sessionId": sid})
    final = None
    streamed = ""
    timeout = httpx.Timeout(READ_TIMEOUT_S, connect=CONNECT_TIMEOUT_S)
    try:
        with httpx.Client(timeout=timeout) as client:
            with client.stream("POST", f"{_base()}/api/sessions/{sid}/chat", json={"message": message}) as resp:
                if resp.status_code == 404 and not created:
                    # 對方把 session 刪了(或重建過資料庫):開一個新的再送一次
                    resp.read()
                    yield from _relay(_create_session(client), message, created=True)
                    return
                if resp.status_code >= 400:
                    resp.read()
                    raise httpx.HTTPStatusError(f"HTTP {resp.status_code}", request=resp.request, response=resp)
                for event, data in _upstream_events(resp):
                    if event == "ping":
                        yield b": ping\n\n"
                    elif event == "error":
                        yield _sse("error", {"message": str(data.get("message") or "agent 發生錯誤")})
                    elif event == "msg":
                        kind = data.get("type")
                        if kind == "stream_event":
                            ev = data.get("event") or {}
                            delta = ev.get("delta") or {}
                            if ev.get("type") == "content_block_delta" and delta.get("type") == "text_delta":
                                streamed += delta.get("text", "")
                                yield _sse("delta", {"text": delta.get("text", "")})
                        elif kind == "assistant":
                            for block in (data.get("message") or {}).get("content") or []:
                                if block.get("type") == "tool_use":
                                    yield _sse("status", {"text": f"正在查詢({block.get('name', '工具')})…"})
                        elif kind == "result" and isinstance(data.get("result"), str):
                            final = data["result"]
                    elif event == "done":
                        break
    except httpx.HTTPError as exc:
        logger.warning("網管 agent 呼叫失敗:%s", exc)
        yield _sse("error", {"message": "連不上網管 agent"})
        return
    text, suggestions = _split_suggestions(final if final is not None else streamed)
    if text:
        yield _sse("final", {"text": text, "suggestions": suggestions})
    else:
        yield _sse("error", {"message": "agent 沒有回覆內容"})


class EventStreamRenderer(BaseRenderer):
    """讓 DRF 接受 Accept: text/event-stream。

    沒有這個,瀏覽器帶著 SSE 的 Accept 來,DRF 的內容協商找不到對應的 renderer 會直接回 406
    (實際踩過)。成功時回的是 StreamingHttpResponse,不經 renderer;這裡只處理錯誤時的 dict。
    """

    media_type = "text/event-stream"
    format = "sse"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return json.dumps(data, ensure_ascii=False).encode()


class AssistantChatView(APIView):
    """POST /api/assistant/chat/  {text, context?, sessionId?} → SSE(見模組說明)。

    要登入(JWT):/field 會在背景自動登入,一般使用者感覺不到;但沒帶 token 的請求打不進來,
    不會讓外面的人直接拿我們當跳板去用那台沒有認證的 agent。
    """

    renderer_classes = [JSONRenderer, EventStreamRenderer]

    def post(self, request):
        if not _base():
            return Response({"detail": "沒有設定網管 agent(ASSISTANT_AGENT_BASE)"}, status=503)
        text = str(request.data.get("text") or "").strip()
        if not text:
            return Response({"detail": "empty text"}, status=400)
        context = str(request.data.get("context") or "").strip()[:4000]
        # 第一行放「來源 + 問題」:對方的系統會拿第一則訊息的第一行當 session 標題(會蓋掉我們建立時給的),
        # 這樣在它的 session 清單上看得出是 IVT 來的、問了什麼
        message = (
            f"【IVT 場域小助理】{text[:2000]}\n\n{PREAMBLE}\n\n"
            f"【頁面資料】\n{context or '(沒有)'}\n\n【使用者的問題】\n{text[:2000]}"
        )

        sid = request.data.get("sessionId")
        try:
            sid = str(uuid.UUID(str(sid))) if sid else None
        except ValueError:
            sid = None
        created = False
        if sid is None:
            try:
                with httpx.Client(timeout=httpx.Timeout(10.0, connect=CONNECT_TIMEOUT_S)) as client:
                    sid = _create_session(client)
                created = True
            except (httpx.HTTPError, KeyError, ValueError) as exc:
                logger.warning("建立 agent session 失敗:%s", exc)
                return Response({"detail": "連不上網管 agent"}, status=502)

        resp = StreamingHttpResponse(_relay(sid, message, created), content_type="text/event-stream")
        resp["Cache-Control"] = "no-cache"
        resp["X-Accel-Buffering"] = "no"
        return resp
