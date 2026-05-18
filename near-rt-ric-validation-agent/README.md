# Near-RT RIC Validation Agent

**O-RAN Near-Real-Time RAN Intelligent Controller 驗測助手，基於 [Claude Code](https://docs.anthropic.com/claude-code) 與 `claude-agent-app-template` scaffold。**

Drop your domain into `domain/`, run `docker-compose up`, get a working chat UI with conversation persistence, knowledge surfacing, growth timeline, single-password auth, and Cloudflare-tunnel-ready deployment.

```
┌──────────────┐    HTTPS / SSE      ┌──────────────┐    subprocess   ┌──────────────┐
│  Next.js     │ ─────────────────► │  Django      │ ─────────────► │  Claude CLI  │
│  Chat UI     │                    │  REST + SSE  │                │  + sub-agents│
│  + sidebar   │ ◄───────────────── │  Worker pool │ ◄───────────── │  (Task tool) │
└──────────────┘    stream replies   └──────┬───────┘    stream out   └──────────────┘
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │  Postgres    │
                                     │  Sessions /  │
                                     │  Turns /     │
                                     │  TurnEvents  │
                                     └──────────────┘
```

## What this is

A **template** (use the green ⌜Use this template⌝ button on GitHub) for apps where:

- One **main agent** chats with the user.
- It may **delegate** sub-tasks to specialised sub-agents defined in `.claude/agents/*.md` (Claude Code's `Task` tool).
- Long-running work survives client disconnects (worker thread is decoupled from the HTTP connection).
- The operator can see **what they taught the agent** (Knowledge tab) and **how it learned over time** (Growth timeline).

**Not** a multi-agent orchestration framework — no parallel agents, no agent-to-agent messaging. Hierarchical delegation only, which is the pattern Claude Code itself uses.

## What's already built

| Capability                                | Where                                     |
|-------------------------------------------|-------------------------------------------|
| Streaming chat with SSE                   | `backend/api/agent/`, `frontend/components/Chat/` |
| Worker decoupled from HTTP (survives disconnect) | `backend/api/agent/worker.py` — `Turn` + `TurnEvent` log |
| Auto-reconnect with 30 s watchdog         | `frontend/components/Chat/hooks/useTurn.ts` |
| Single-password auth + HMAC cookie        | `backend/api/auth.py`, `backend/app/auth_middleware.py` |
| Cloudflare quick tunnel (ephemeral URL)   | `docker-compose.yml` → `cloudflared` service |
| Knowledge surfacing (system prompt + sub-agents + memory) | `backend/api/knowledge.py`, `frontend/app/knowledge/` |
| Growth timeline (memory + rule commits + milestones + artifacts) | `backend/api/growth.py`, `frontend/app/growth/` |
| Per-turn timestamp & duration on every message | `backend/api/agent/worker.py`, `frontend/components/Chat/Bubble.tsx` |
| File upload + workspace file read         | `backend/api/uploads.py`, `backend/api/files_domain/` |
| i18n (en / zh) with run-time language toggle | `frontend/lib/i18n.ts`, `LangContext` |

## Quickstart (3 steps + maybe 5 minutes)

1. **Click "Use this template"** on this repo's GitHub page → create your private project.
2. Clone your new repo and run the initializer:

       git clone git@github.com:YOUR/your-app.git
       cd your-app
       ./init.sh                # answer the prompts; rewrites placeholders, self-deletes

3. Edit `domain/prompt.md` (the agent's system prompt) and bring it up:

       docker-compose up -d --build
       open http://localhost:3010

First time you start it, run `claude auth login` inside the backend container (or set `ANTHROPIC_API_KEY` in `.env`).

## Repo layout

```
.
├── README.md                          # this file
├── init.sh                            # interactive setup (run once, self-removes)
├── docker-compose.yml                 # 4 services: db / backend / frontend / cloudflared
├── .env.example
│
├── domain/                            # ★ everything you customise lives here
│   ├── config.json                    # app name, slug, language, features, hero copy
│   ├── prompt.md                      # agent system prompt
│   ├── templates/                     # starter artifacts the agent forks (optional)
│   ├── samples/                       # demo input files (optional)
│   └── personas/                      # pre-built behavior overlays (optional)
│
├── backend/                           # engine: Django + agent runtime
│   ├── app/                           # Django project package
│   └── api/                           # REST + SSE endpoints + worker + models
│
├── frontend/                          # engine: Next.js (app router)
│   ├── app/                           # routes: chat / login / knowledge / growth
│   ├── components/                    # Chat, Sidebar, AppHeader, primitives
│   └── lib/                           # i18n, types, format, useAppConfig
│
├── .claude/                           # Claude Code settings + sub-agent definitions
│   ├── agents/                        # ← drop <slug>.md sub-agents here
│   └── settings.json
│
├── generated/                         # runtime: artifacts the agent produces (gitignored)
└── uploads/                           # runtime: files the user attaches (gitignored)
```

The split is sharp: **everything domain-specific is under `domain/`**, with the one exception of sub-agents (which live in `.claude/agents/` because Claude Code expects them there). Engine code never references your domain by name.

## What to customise

The deep dive is in [`docs/CUSTOMIZE.md`](docs/CUSTOMIZE.md). In short:

- **`domain/prompt.md`** — the agent's system prompt. Role, knowledge, rules, output format.
- **`domain/config.json`** — app name, default language, feature flags, hero copy.
- **`.claude/agents/<slug>.md`** — sub-agent definitions (optional).
- **`domain/templates/`** — starter files the agent copies when producing an artifact (optional, only if `features.artifacts=true`).

You should not need to touch `backend/` or `frontend/` for a typical new domain.

## Upgrading to newer engine versions

See [`docs/UPGRADE.md`](docs/UPGRADE.md). TL;DR: `git pull` from upstream; conflicts only happen in `domain/`, which is yours to resolve.

## License / Status

Internal / research. No published version yet.
