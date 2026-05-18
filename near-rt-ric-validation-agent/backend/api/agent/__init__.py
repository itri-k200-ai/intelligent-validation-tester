"""Agent runtime: turn-based wrapper around the Claude Code CLI.

Layout (single-responsibility per file):
  cli.py     — claude CLI invocation builder (pure config)
  events.py  — claude stream-json → structured (type, data) events (pure)
  worker.py  — daemon-thread worker that owns subprocess + DB writes
  views.py   — HTTP endpoints (chat_start / turn_events / list_turns)

Public surface intentionally narrow: callers should depend on views (for
URL wiring) and at most worker.run_turn (for tests / out-of-band kicks).
"""

from .views import chat_start, list_turns, turn_events

__all__ = ["chat_start", "turn_events", "list_turns"]
