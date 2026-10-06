"""小助理 → 網管 agent 轉送(apps.assistant)。agent 用 httpx.MockTransport 假造。"""

import json

import httpx
import pytest
from rest_framework.test import APIClient

from apps.assistant import views


def _sse(event, data):
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


AGENT_STREAM = (
    _sse("start", {"ts": 1})
    + ": ping\n\n"
    + _sse("msg", {"type": "stream_event", "event": {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "我查一下"}}})
    + _sse("msg", {"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "list_containers"}]}})
    + _sse("msg", {"type": "stream_event", "event": {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "進度 8%"}}})
    + _sse("msg", {"type": "result", "result": '目前進度是 8%。\n<!--suggest: ["電量多少?", "通訊品質如何?"]-->'})
    + _sse("done", {"exit_code": 0})
)


def _events(body: bytes):
    out = []
    for block in body.decode().split("\n\n"):
        lines = [l for l in block.splitlines() if not l.startswith(":")]
        if not lines:
            continue
        ev = lines[0].removeprefix("event: ")
        out.append((ev, json.loads(lines[1].removeprefix("data: "))))
    return out


@pytest.fixture
def agent(monkeypatch, settings):
    settings.ASSISTANT_AGENT_BASE = "http://agent.test"
    settings.ASSISTANT_AGENT_RUNNER = "claude"
    calls = []

    def handler(request: httpx.Request):
        calls.append((request.method, request.url.path, json.loads(request.content or b"{}")))
        if request.url.path == "/api/sessions/":
            return httpx.Response(201, json={"id": "11111111-1111-1111-1111-111111111111"})
        if request.url.path.endswith("/chat"):
            if "22222222" in request.url.path:  # 已經被刪掉的舊 session
                return httpx.Response(404, json={"error": "session not found"})
            return httpx.Response(200, stream=httpx.ByteStream(AGENT_STREAM.encode()),
                                  headers={"content-type": "text/event-stream"})
        return httpx.Response(404)

    real = httpx.Client
    monkeypatch.setattr(views.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    return calls


@pytest.fixture
def client(db, django_user_model):
    user = django_user_model.objects.create_user(email="u@example.com", password="p")
    c = APIClient()
    c.force_authenticate(user)
    return c


def test_轉送_agent_的回覆並以_result_為最終答案(agent, client):
    # 帶瀏覽器實際送的 Accept —— 少了這個,DRF 的 406 測不出來
    res = client.post("/api/assistant/chat/", {"text": "進度?", "context": "進度 8%"}, format="json",
                      HTTP_ACCEPT="text/event-stream")
    assert res.status_code == 200
    ev = _events(b"".join(res.streaming_content))
    kinds = [e for e, _ in ev]
    assert kinds[0] == "session" and ev[0][1]["sessionId"].startswith("1111")
    assert ("delta", {"text": "我查一下"}) in ev
    assert any(e == "status" and "list_containers" in d["text"] for e, d in ev)
    # 建議問題要拆出來,不能留在要顯示 / 朗讀的文字裡
    assert ev[-1] == ("final", {"text": "目前進度是 8%。", "suggestions": ["電量多少?", "通訊品質如何?"]})
    # 建 session 用設定的 runner;訊息要帶著頁面資料
    assert agent[0] == ("POST", "/api/sessions/", {"title": "IVT 場域測試小助理", "runner": "claude"})
    sent = agent[1][2]["message"]
    assert "進度 8%" in sent and "進度?" in sent


def test_舊_session_不見了就重開一個再送(agent, client):
    res = client.post(
        "/api/assistant/chat/",
        {"text": "嗨", "sessionId": "22222222-2222-2222-2222-222222222222"},
        format="json",
    )
    ev = _events(b"".join(res.streaming_content))
    sessions = [d["sessionId"] for e, d in ev if e == "session"]
    assert sessions[-1].startswith("1111")
    assert ev[-1][0] == "final"


def test_沒登入不能用(agent):
    res = APIClient().post("/api/assistant/chat/", {"text": "嗨"}, format="json")
    assert res.status_code == 401


def test_agent_連不上回錯誤事件而不是整個爆掉(monkeypatch, settings, client):
    settings.ASSISTANT_AGENT_BASE = "http://agent.test"

    def boom(request):
        if request.url.path == "/api/sessions/":
            return httpx.Response(201, json={"id": "11111111-1111-1111-1111-111111111111"})
        raise httpx.ConnectError("refused")

    real = httpx.Client
    monkeypatch.setattr(views.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(boom), **kw))
    res = client.post("/api/assistant/chat/", {"text": "嗨"}, format="json")
    ev = _events(b"".join(res.streaming_content))
    assert ev[-1] == ("error", {"message": "連不上網管 agent"})
