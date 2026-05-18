"""HTTP endpoints for the turn-based chat protocol.

  POST /api/sessions/<sid>/chat     → kick off a turn, return {turn_id}
  GET  /api/turns/<id>/events       → SSE tail-follower (replay since=seq + tail)
  GET  /api/turns/                  → list turns (filterable by session / status)

Only HTTP concerns live here: request parsing, response shaping, SSE
framing, and dispatching the worker. Subprocess + DB persistence work
is delegated to .worker.
"""

import json
import threading
import time

from django.db import close_old_connections, transaction
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from ..models import Message, Session, Turn, TurnEvent
from .worker import run_turn


# SSE tail-follower tuning
_POLL_INTERVAL = 0.3
_HEARTBEAT_EVERY = 15.0
_MAX_RUN_SEC = 30 * 60  # safety cap per tail connection


def _sse(event_name: str, data) -> bytes:
    payload = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    return f"event: {event_name}\ndata: {payload}\n\n".encode("utf-8")


@csrf_exempt
@require_http_methods(["POST"])
def chat_start(request, session_id):
    """Start a Turn. Returns immediately with `{turn_id, status}`;
    events stream from `/api/turns/<turn_id>/events`.

    Behavior:
      - Saves the user Message synchronously.
      - Derives session title from the first user message (one-time).
      - Spawns a daemon thread to run the claude subprocess; the
        subprocess outlives this HTTP request.
    """
    try:
        session = Session.objects.get(id=session_id)
    except Session.DoesNotExist:
        return JsonResponse({"error": "session not found"}, status=404)

    try:
        body = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "bad json"}, status=400)

    user_message = (body.get("message") or "").strip()
    attachments = body.get("attachments") or []
    if not isinstance(attachments, list):
        attachments = []
    if not user_message and not attachments:
        return JsonResponse({"error": "empty message"}, status=400)

    if not session.messages.exists() and user_message:
        derived = user_message.strip().splitlines()[0][:60].rstrip()
        if derived and derived != session.title:
            session.title = derived
            session.save(update_fields=["title", "updated_at"])

    Message.objects.create(
        session=session,
        role="user",
        content={"text": user_message, "attachments": attachments},
    )

    with transaction.atomic():
        turn = Turn.objects.create(
            session=session,
            status="running",
            user_message_text=user_message,
            attachments=attachments,
            claude_session_id_in=session.claude_session_id,
        )

    threading.Thread(target=run_turn, args=(str(turn.id),), daemon=False).start()
    return JsonResponse({"turn_id": str(turn.id), "status": turn.status})


@require_GET
def turn_events(request, turn_id):
    """SSE tail-follower over TurnEvent log.

    Replays every event with `seq > since`, then polls for new ones
    while the turn is `running`. On `status != running` (done / error /
    interrupted), drains the remaining events and sends `event: end`.

    Reconnect-safe: pass `?since=<last_seq>` to resume mid-stream. The
    worker is unaffected by clients connecting / disconnecting.
    """
    try:
        turn = Turn.objects.get(id=turn_id)
    except Turn.DoesNotExist:
        return JsonResponse({"error": "turn not found"}, status=404)

    try:
        since = int(request.GET.get("since", "0"))
    except ValueError:
        since = 0

    def stream():
        last_seq = since
        last_heartbeat = time.time()
        deadline = time.time() + _MAX_RUN_SEC
        while time.time() < deadline:
            new_events = list(
                TurnEvent.objects.filter(turn_id=turn.id, seq__gt=last_seq)
                .order_by("seq")
                .values("seq", "type", "data", "ts")
            )
            for ev in new_events:
                yield _sse("msg", {
                    "seq": ev["seq"],
                    "type": ev["type"],
                    "data": ev["data"],
                    "ts": ev["ts"].isoformat() if ev["ts"] else None,
                })
                last_seq = ev["seq"]
                if ev["type"] in ("done", "error"):
                    return

            close_old_connections()
            status = (
                Turn.objects.filter(id=turn.id)
                .values_list("status", flat=True)
                .first()
            )
            if status and status != "running":
                # Drain any events that landed during the status check.
                final = list(
                    TurnEvent.objects.filter(turn_id=turn.id, seq__gt=last_seq)
                    .order_by("seq")
                    .values("seq", "type", "data")
                )
                for ev in final:
                    yield _sse("msg", {
                        "seq": ev["seq"], "type": ev["type"], "data": ev["data"],
                    })
                    last_seq = ev["seq"]
                yield _sse("end", {"status": status})
                return

            now = time.time()
            if now - last_heartbeat >= _HEARTBEAT_EVERY:
                yield b": keepalive\n\n"
                last_heartbeat = now
            time.sleep(_POLL_INTERVAL)

        yield _sse("end", {"status": "still_running"})

    response = StreamingHttpResponse(stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@require_GET
def list_turns(request):
    """Filterable turn listing — used by the frontend to resume any
    in-flight turn when a session is opened in a new tab / after refresh."""
    qs = Turn.objects.all()
    sid = request.GET.get("session")
    if sid:
        qs = qs.filter(session_id=sid)
    status = request.GET.get("status")
    if status:
        qs = qs.filter(status=status)
    rows = qs.order_by("-started_at").values(
        "id", "session_id", "status", "started_at", "ended_at", "user_message_text"
    )[:50]
    items = [{
        "id": str(r["id"]),
        "session": str(r["session_id"]),
        "status": r["status"],
        "started_at": r["started_at"].isoformat() if r["started_at"] else None,
        "ended_at": r["ended_at"].isoformat() if r["ended_at"] else None,
        "user_message_text": (r["user_message_text"] or "")[:120],
    } for r in rows]
    return JsonResponse({"items": items})
