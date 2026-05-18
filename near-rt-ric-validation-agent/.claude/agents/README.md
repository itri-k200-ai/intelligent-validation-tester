# Sub-agents

Drop named sub-agent definitions in this directory as `<slug>.md` files.
Claude Code will load them automatically and let the main agent delegate
to them via the `Task` tool.

Sub-agent file format (YAML frontmatter + Markdown body):

```markdown
---
name: <slug>
description: One-line summary shown when the main agent decides whether to delegate.
tools: Read, Write, Edit, Bash, Glob, Grep
---

You are <Role>. You handle <specific task type>.

[Body: rules, examples, constraints. Same shape as domain/prompt.md, but
for one specific sub-task this agent is responsible for.]
```

Sub-agents are optional. A simple app might not need any — the main agent
handles everything. Use a sub-agent when a clearly distinct sub-task
benefits from its own focused system prompt (e.g. "code generator" vs
"code reviewer", "researcher" vs "writer").

This README is engine documentation and does not affect runtime; you can
leave it alone, edit it, or delete it.
