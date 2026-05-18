"""Background worker thread that runs one Turn to completion.

The worker owns the claude subprocess and writes every event to the
TurnEvent log. It is intentionally detached from any HTTP request: the
browser can disconnect, reconnect, or open in another tab; the worker
keeps going until claude exits.

State machine handled here (kept out of events.py so the parser stays pure):
  - dedup text deltas vs full text blocks (--include-partial-messages
    emits both; using both would double the response)
  - capture session_id from system/result events
  - accumulate assistant_text to commit as a Message at end-of-stream
"""

import json
import os
import subprocess
import time
from pathlib import Path

from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone

from ..models import Message, Session, Turn, TurnEvent
from .cli import build_command, build_prefixed_user_message
from .events import parse_event


_KILL_GRACE_SEC = 5


def run_turn(turn_id: str) -> None:
    """Entry point for the worker thread. Idempotent on already-ended turns."""
    close_old_connections()
    try:
        turn = Turn.objects.select_related("session").get(id=turn_id)
    except Turn.DoesNotExist:
        return
    if turn.status != "running":
        return

    session = turn.session
    seq_counter = _SeqCounter(turn)
    emit = seq_counter.emit

    cmd = build_command(
        session.claude_session_id,
        build_prefixed_user_message(turn.user_message_text, list(turn.attachments)),
    )
    env = os.environ.copy()
    env.setdefault("CLAUDE_CONFIG_DIR", str(Path(settings.REPO_ROOT) / ".claude"))

    emit("system", {"phase": "starting", "ts": time.time()})

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(settings.REPO_ROOT),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
    except FileNotFoundError:
        emit("error", {"message": "claude CLI not found in PATH"})
        _mark_error(turn, "claude binary missing")
        return

    accumulator = _StreamAccumulator()

    try:
        for raw_line in proc.stdout or []:
            line = raw_line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                emit("error", {"raw": line[:500]})
                continue
            for event_type, data in parse_event(obj):
                if not accumulator.accept(event_type, data):
                    continue
                emit(event_type, data)

        proc.wait()
        stderr_out = proc.stderr.read() if proc.stderr else ""
        _finalize(turn, session, accumulator, proc.returncode, stderr_out)
        emit("done", {
            "exit_code": proc.returncode,
            "session_id": accumulator.session_id,
        })
    except Exception as e:  # noqa: BLE001 — must catch all to mark turn
        emit("error", {"message": repr(e)})
        _kill_subprocess(proc)
        _finalize_error(turn, session, accumulator, repr(e))
    finally:
        close_old_connections()


# ────────── helpers ──────────


class _SeqCounter:
    """Append-only writer to TurnEvent, monotonically incrementing seq.
    Swallow individual write failures so one bad row doesn't kill the loop."""

    def __init__(self, turn: Turn):
        self._turn = turn
        self._seq = 0

    def emit(self, event_type: str, data: dict) -> None:
        self._seq += 1
        try:
            TurnEvent.objects.create(
                turn=self._turn, seq=self._seq, type=event_type, data=data
            )
        except Exception:
            close_old_connections()


class _StreamAccumulator:
    """Per-turn streaming state. Mutates `data` in place where useful
    (e.g. promoting a text_delta to carry the running snapshot).

    Returns False from `accept()` to skip events that would double-count
    (e.g. the full `text` block when text_deltas have already streamed).
    """

    def __init__(self):
        self.assistant_text: str = ""
        self.session_id: str = ""
        self._seen_text_delta = False

    def accept(self, event_type: str, data: dict) -> bool:
        if event_type == "system":
            sid = data.get("session_id")
            if sid:
                self.session_id = sid
            return True
        if event_type == "text":
            if self._seen_text_delta:
                return False
            self.assistant_text += data.get("text", "")
            data["text"] = self.assistant_text  # carry running snapshot
            return True
        if event_type == "text_delta":
            self._seen_text_delta = True
            self.assistant_text += data.get("text", "")
            data["snapshot"] = self.assistant_text
            return True
        if event_type == "result":
            sid = data.get("session_id")
            if sid:
                self.session_id = sid
            return True
        return True


def _finalize(
    turn: Turn,
    session: Session,
    acc: _StreamAccumulator,
    returncode: int,
    stderr_out: str,
) -> None:
    ended = timezone.now()
    duration_ms = int((ended - turn.started_at).total_seconds() * 1000)
    if acc.session_id and acc.session_id != session.claude_session_id:
        session.claude_session_id = acc.session_id
        session.save(update_fields=["claude_session_id", "updated_at"])
        turn.claude_session_id_out = acc.session_id
    if acc.assistant_text.strip():
        Message.objects.create(
            session=session, role="assistant",
            content={"text": acc.assistant_text, "duration_ms": duration_ms},
        )
    turn.status = "done" if returncode == 0 else "error"
    if returncode != 0:
        turn.error_text = stderr_out[-2000:]
    turn.ended_at = ended
    turn.save(update_fields=[
        "status", "error_text", "ended_at", "claude_session_id_out",
    ])


def _finalize_error(
    turn: Turn,
    session: Session,
    acc: _StreamAccumulator,
    error_msg: str,
) -> None:
    ended = timezone.now()
    duration_ms = int((ended - turn.started_at).total_seconds() * 1000)
    if acc.assistant_text.strip():
        try:
            Message.objects.create(
                session=session, role="assistant",
                content={
                    "text": acc.assistant_text,
                    "duration_ms": duration_ms,
                    "interrupted": True,
                },
            )
        except Exception:
            pass
    turn.status = "error"
    turn.error_text = error_msg[:2000]
    turn.ended_at = ended
    turn.save(update_fields=["status", "error_text", "ended_at"])


def _mark_error(turn: Turn, msg: str) -> None:
    turn.status = "error"
    turn.error_text = msg
    turn.ended_at = timezone.now()
    turn.save(update_fields=["status", "error_text", "ended_at"])


def _kill_subprocess(proc: subprocess.Popen) -> None:
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=_KILL_GRACE_SEC)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
