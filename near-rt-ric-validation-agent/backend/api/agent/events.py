"""Pure-function translator: claude stream-json object → (type, data) events.

Stateless on purpose: anything that needs cross-line memory (dedup of
text deltas vs final text block, captured session_id, etc.) lives in
the worker. This module just describes what one upstream message means.

Event types yielded (must mirror the choices in `TurnEvent.TYPE_CHOICES`):
  system          claude init / status payloads carrying session_id
  text            full assistant text block (use only if no text_delta seen)
  text_delta      incremental token chunk from --include-partial-messages
  thinking_delta  reasoning chunk (from `medium` effort)
  tool_use        a tool the agent decided to call (Bash / Read / Write / ...)
  tool_result     the result Claude saw for an earlier tool_use
  result          final summary block (duration, cost, session_id, ...)
"""

from collections.abc import Iterator


def parse_event(obj: dict) -> Iterator[tuple[str, dict]]:
    """Yield zero or more (event_type, data) pairs for one upstream object.

    Multiple events per call are possible — e.g. an `assistant` block can
    carry text + tool_use + thinking parts simultaneously.
    """
    mt = obj.get("type")

    if mt == "system":
        sid = obj.get("session_id")
        yield ("system", {
            "subtype": obj.get("subtype"),
            "session_id": sid or "",
        })
        return

    if mt == "assistant":
        for part in obj.get("message", {}).get("content", []):
            pt = part.get("type")
            if pt == "text":
                yield ("text", {"text": part.get("text", "")})
            elif pt == "thinking":
                t = part.get("thinking") or part.get("text") or ""
                if t:
                    yield ("thinking_delta", {"thinking": t})
            elif pt == "tool_use":
                yield ("tool_use", {
                    "name": part.get("name"),
                    "input": part.get("input"),
                    "id": part.get("id"),
                })
        return

    if mt == "user":
        for part in obj.get("message", {}).get("content", []):
            if part.get("type") == "tool_result":
                yield ("tool_result", {
                    "tool_use_id": part.get("tool_use_id"),
                    "is_error": part.get("is_error", False),
                })
        return

    if mt == "stream_event":
        delta = obj.get("event", {}).get("delta") or {}
        if delta.get("type") == "thinking_delta" and delta.get("thinking"):
            yield ("thinking_delta", {"thinking": delta["thinking"]})
        elif delta.get("type") == "text_delta" and delta.get("text"):
            yield ("text_delta", {"text": delta["text"]})
        return

    if mt == "result":
        yield ("result", {
            "subtype": obj.get("subtype"),
            "duration_ms": obj.get("duration_ms"),
            "is_error": obj.get("is_error"),
            "session_id": obj.get("session_id") or "",
        })
        return
