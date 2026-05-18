# Customising your domain

Everything you change to make this template into *your* app lives under `domain/` (plus `.claude/agents/` for sub-agents). This guide walks each file.

## `domain/config.json`

Single source of truth for app metadata, feature toggles, and hero copy. The engine reads this on startup and exposes it to the frontend via `GET /api/app/config`.

```json
{
  "app": {
    "name":        { "en": "Contract Reviewer", "zh": "合約審查助理" },
    "slug":        "contract",
    "description": { "en": "Reviews vendor contracts against company policy.",
                     "zh": "依公司政策審查供應商合約。" }
  },
  "default_lang": "zh",
  "features": {
    "knowledge_tab":   true,
    "growth_timeline": true,
    "file_upload":     true,
    "artifacts":       true,
    "personas":        false
  },
  "hero": {
    "title":    { "en": "Paste a contract or describe the question.",
                  "zh": "貼合約進來，或描述問題。" },
    "subtitle": { "en": "", "zh": "" },
    "features": [
      { "title": { "en": "Clause review",   "zh": "條款檢查" },
        "desc":  { "en": "Flag risky / non-standard clauses.",
                   "zh": "標記高風險或非標準條款。" } },
      { "title": { "en": "Diff against template",
                   "zh": "和模板比對差異" },
        "desc":  { "en": "Highlight what changed from our standard agreement.",
                   "zh": "標出和我們標準合約的差別。" } }
    ],
    "prompts": [
      { "en": "Review this NDA against our template.",
        "zh": "拿這份 NDA 跟我們的模板比對。" },
      { "en": "Summarize the payment terms in plain language.",
        "zh": "用白話總結這份合約的付款條件。" }
    ]
  }
}
```

### `app`

| Field         | Where it shows                                                 |
|---------------|----------------------------------------------------------------|
| `name`        | Browser tab title, sidebar brand, login footer                 |
| `slug`        | Container names, DB name, env vars — set by `init.sh`, rarely changed manually |
| `description` | Sidebar subtitle, capabilities-tab intro paragraph             |

### `default_lang`

`"en"` or `"zh"`. The user can flip live via the language toggle; this is just the first-paint default.

### `features`

| Flag              | When `false` …                                                |
|-------------------|---------------------------------------------------------------|
| `knowledge_tab`   | Hides the Knowledge sidebar tab + `/knowledge` route          |
| `growth_timeline` | Hides the Growth CTA + `/growth` route                        |
| `file_upload`     | Hides the paperclip icon + drag-drop                          |
| `artifacts`       | Hides the Outputs tab + `/api/generated/*` returns empty      |
| `personas`        | Hides persona-related UI + `/api/personas/` returns empty     |

Default for a fresh template is `artifacts: false`, `personas: false`. Turn them on only if your domain produces downloadable outputs or pre-built behaviour variants.

### `hero`

`title` / `subtitle` render at the top of the empty-state. `features` is a list of cards underneath (recommend 2–4). `prompts` is a list of clickable starter prompts that fill the composer when clicked — the user still has to press Send.

## `domain/prompt.md`

The agent's system prompt. Appended via `--append-system-prompt` on every turn (including resumed sessions).

The shipped template has placeholder sections. Fill them in plain language — the agent reads this as instructions, not documentation.

Strong recommendations:

- Keep the **Anti-cliffhanger** rule. It exists because users see streaming chat and assume silence = working. Letting the agent end a turn with "OK I'll do that" and no tool calls is the worst UX bug a streaming chat app can have.
- Keep **Verify before claiming** if your agent has shell tools. Over-promising on tools you don't actually have is the most common loss-of-trust on first turn.
- Replace the **Domain knowledge** section with concrete terms (project IDs, product names, customer types) — the more specific, the less the agent invents.

## `.claude/agents/<slug>.md`

Optional sub-agent definitions. Format:

```markdown
---
name: <slug>
description: One-sentence summary the main agent reads to decide whether to delegate.
tools: Read, Write, Edit, Bash, Glob, Grep
---

You are <Role>. You handle <specific task type>.
[Body: rules, examples, constraints.]
```

Sub-agents only kick in when the main agent decides to use the `Task` tool, which it does based on the sub-agent's `description`. Write descriptions that make the trigger obvious ("Handles SQL query writing and explanation").

Most apps need zero or one sub-agent. If you find yourself reaching for three, consider whether you can fold them into a single sub-agent with branches, or whether your main agent's prompt is doing too much.

## `domain/templates/` (only if `features.artifacts=true`)

Starter files the agent copies into `generated/<name>/` when producing an artifact. The agent is told about this directory via your `prompt.md` ("when you need to produce X, start by copying `domain/templates/<base>/`").

## `domain/samples/` (optional)

Demo inputs. Useful for two reasons:

1. The agent can read them when the user asks "show me an example".
2. You can drop them into the chat via the file-upload UI to drive demos without typing them out.

## `domain/personas/` (only if `features.personas=true`)

Persona overlays — pre-built behaviour modes the user can pick. Each persona is a `.json` file with:

```json
{
  "meta": {
    "id":              "strict",
    "label_en":        "Strict reviewer",
    "label_zh":        "嚴格審查",
    "description_en":  "Flags every deviation. Slower, more thorough.",
    "description_zh":  "標記每個偏離。較慢、較完整。"
  },
  "controls_overlay": {
    "threshold": 0.95,
    "expand_clauses": true
  }
}
```

`controls_overlay` is free-form JSON your prompt can reference ("the user selected persona X with controls Y; apply them"). The engine doesn't interpret it.

Personas are the right abstraction when your domain has 3–6 discrete behaviour modes that operators want to switch between quickly. They are overkill for "one agent, one mode" apps.

## Sanity check

After editing, restart docker-compose and open the app:

```bash
docker-compose restart backend frontend
```

Verify:

- Sidebar header shows your `app.name`.
- Hero shows your `hero.title` / `hero.subtitle`.
- Clicking a starter prompt fills the composer.
- Knowledge tab (if enabled) shows your `prompt.md`.
- Growth page (if enabled) shows a "Generated" event for the first artifact you produce.

If any of those still show the template defaults, check the browser console: `GET /api/app/config` should return your edited values. The endpoint is cached for 60 s on the client; hard-reload to bypass.
