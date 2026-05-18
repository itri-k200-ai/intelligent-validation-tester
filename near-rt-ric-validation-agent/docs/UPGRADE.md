# Pulling engine updates

Your repo started life as a fork of `claude-agent-app-template`. When the upstream gets bug fixes or new engine features (better chat reconnect, new endpoint, refactored Sidebar), here's how to pull them in.

## One-time setup

Add the template as a second remote:

```bash
git remote add upstream https://github.com/jych1a0/claude-agent-app-template.git
git fetch upstream
```

## Routine upgrade

```bash
git fetch upstream
git merge upstream/main   # or rebase, your preference
```

### What conflicts are expected

The split `engine vs domain` is sharp on purpose:

| File area              | Owns it    | Merge conflict?               |
|------------------------|------------|-------------------------------|
| `backend/api/*.py`     | engine     | Should not conflict           |
| `backend/app/*.py`     | engine     | Should not conflict           |
| `frontend/app/*`       | engine     | Should not conflict           |
| `frontend/components/*` | engine    | Should not conflict           |
| `frontend/lib/*.ts`    | engine     | Should not conflict           |
| `docker-compose.yml`   | engine + slug | Possible conflict on container names — keep your `${APP_SLUG}` substitution |
| `domain/config.json`   | you        | Possible conflict if the engine added a new feature flag — accept yours then add the new flag |
| `domain/prompt.md`     | you        | Should not conflict (engine never touches it) |
| `.claude/agents/*.md`  | you        | Should not conflict           |

If a merge touches any file under `backend/` or `frontend/`, that's normal — engine improvements. Accept upstream unless you've manually patched the engine (in which case, capture your patch as a separate commit before merging so it's easy to re-apply).

## Engine extension points

The engine reads these from `domain/`:

| Engine module          | Reads from                          |
|------------------------|-------------------------------------|
| `backend/api/agent/cli.py`     | `domain/prompt.md`, `domain/reminders.txt` (optional) |
| `backend/api/app_config.py`    | `domain/config.json`               |
| `backend/api/knowledge.py`     | `domain/prompt.md`, `.claude/agents/*.md` |
| `backend/api/growth.py`        | `domain/`, `.claude/agents/`, git log |
| `backend/api/personas.py`      | `domain/personas/*.json`           |

If you need the engine to read a new file under `domain/`, you have two choices:

1. **Add it via the upstream template** (open a PR) — keeps upgrade trivial for you and everyone else.
2. **Patch locally** — record your patch as a clearly-named commit so you can re-apply it after each upgrade. Wrap the patched logic in a `try / except` that falls back to engine default when the file is absent, so upstream commits don't break.

## Adding a new feature flag

When upstream adds a flag like `features.cost_tracking`:

1. Pull the engine update.
2. Open `domain/config.json` and add the new flag with your preferred default:
   ```json
   "features": {
     "knowledge_tab": true,
     "growth_timeline": true,
     "file_upload": true,
     "artifacts": false,
     "personas": false,
     "cost_tracking": true   // ← new
   }
   ```
3. Restart `docker-compose`.

The engine merges missing flags with `DEFAULT_CONFIG`, so an older `config.json` keeps working — just without the new feature visible — but it's cleaner to add it explicitly.

## Breaking-change policy

Engine releases that change the `domain/` contract (rename a config key, change a directory path, drop a feature) ship with a `MIGRATION-<version>.md` note. Search upstream for `MIGRATION-` before merging across a major version boundary.
