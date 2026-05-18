"""Build the claude CLI invocation. Pure config — no I/O side effects.

Why this module exists:
  Subprocess command construction is fiddly (flags, tool whitelists,
  --append-system-prompt content, --resume) and changes often. Pulling
  it out lets us unit-test the command shape without spawning claude.
"""

import shutil
from pathlib import Path

from django.conf import settings


PROMPT_FILE = "domain/prompt.md"

# Tools the agent may invoke. Restricting to a whitelist (rather than
# --dangerously-skip-permissions) keeps the agent safe under root in the
# container while still letting it edit files and run common shell utils.
ALLOWED_TOOLS = (
    "Read Glob Grep Write Edit "
    "Bash(mkdir:*) Bash(cp:*) Bash(mv:*) Bash(sed:*) Bash(ls:*) Bash(cat:*) "
    "Bash(rm:*) Bash(chmod:*) Bash(find:*) Bash(grep:*) Bash(jq:*) "
    "Bash(python3:*) Bash(tar:*) Bash(head:*) Bash(tail:*) Bash(wc:*) "
    "Bash(echo:*) Bash(touch:*) Bash(diff:*) Bash(awk:*) Bash(tr:*) "
    "Bash(pdftotext:*) Bash(pdfinfo:*) Bash(zip:*) Bash(unzip:*) Bash(file:*) "
    "Task"
)

# AskUserQuestion is interactive-only; under --print there is no UI to
# resolve it, so banning it forces the agent to ask in text and stop.
DISALLOWED_TOOLS = "AskUserQuestion"


# A generic engine-level reminder injected every turn. Survives --resume
# even if the original prompt has been edited since the session started.
#
# To override or extend per domain, create `domain/reminders.txt` — its
# contents replace the default below.
_DEFAULT_REMINDER_LINES = (
    "[System reminder — injected every turn, not typed by the user]",
    "🛑 Anti-cliffhanger: if the user replied with a short confirmation",
    "  (OK / yes / sure / go / 直接做), you MUST in this same turn:",
    "  (a) start the work via tool_use, (b) finish it, (c) report results.",
    "  Do NOT end a turn with just 'OK I'll do it' — the user sees you stop",
    "  and waits forever. That is the worst UX bug in a streaming chat app.",
    "[end system reminder]",
    "",
)


def _reminder_lines() -> tuple[str, ...]:
    """Read domain/reminders.txt if present, else use engine defaults."""
    p = Path(settings.REPO_ROOT) / "domain" / "reminders.txt"
    if p.is_file():
        try:
            return tuple(p.read_text(encoding="utf-8").splitlines() + [""])
        except OSError:
            pass
    return _DEFAULT_REMINDER_LINES


def build_command(claude_session_id: str, user_message: str) -> list[str]:
    """Return argv for `claude --print` with our agreed flag profile.

    Pass an empty `claude_session_id` to start a fresh conversation.
    """
    claude_bin = shutil.which("claude") or "claude"
    cmd: list[str] = [
        claude_bin,
        "--print",
        "--output-format", "stream-json",
        "--verbose",
        # `medium` effort emits reasoning text in thinking blocks.
        "--effort", "medium",
        # Stream partial deltas so the UI can render token-by-token.
        "--include-partial-messages",
        "--permission-mode", "acceptEdits",
        "--allowedTools", ALLOWED_TOOLS,
        "--disallowedTools", DISALLOWED_TOOLS,
    ]

    prompt_path = Path(settings.REPO_ROOT) / PROMPT_FILE
    if prompt_path.is_file():
        cmd += ["--append-system-prompt", prompt_path.read_text()]
    if claude_session_id:
        cmd += ["--resume", claude_session_id]

    cmd.append(user_message)
    return cmd


def build_prefixed_user_message(user_message: str, attachments: list[str]) -> str:
    """Prepend per-turn reminders + attachment paths to the user's text.

    The reminder block goes to every turn (incl. --resume sessions) so the
    naming rule and anti-cliffhanger rule survive long conversations even
    if the session was started before they were authored.
    """
    parts: list[str] = ["\n".join(_reminder_lines())]
    if attachments:
        parts.append("使用者剛上傳以下檔案（絕對路徑，可用 Read 工具讀）：")
        for a in attachments:
            abs_path = a if a.startswith("/") else str(Path(settings.REPO_ROOT) / a)
            parts.append(f"- {abs_path}")
        parts.append("")
    parts.append(user_message)
    return "\n".join(parts)


# Backwards-compatible alias for tests that import the constant directly.
REMINDER_LINES = _DEFAULT_REMINDER_LINES
